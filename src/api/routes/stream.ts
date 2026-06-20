import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ssePublisher, type SsePayload } from '../../shared/sse/publisher.js';

const StreamQuerySchema = z.object({
  owner: z.string().optional(),
  poolId: z.string().optional(),
  agentAddress: z.string().optional(),
});

/**
 * Server-Sent Events stream of indexed Pinace events.
 *
 * GET /stream?owner=0x...&poolId=0x...&agentAddress=0x...
 *
 * All filters are optional and AND-ed. If none are supplied, every
 * event is delivered (admin/diagnostic mode). Heartbeat ping every 15s
 * so reverse proxies don't kill idle connections.
 *
 * Wire format:
 *   event: <kind>
 *   data: {"kind":"...","owner":"0x...","poolId":"0x...","ts":...,"data":{...}}
 *   \n
 *
 * Clients use EventSource on the browser side, or any SSE-aware reader
 * on the server side. Reconnect is the client's responsibility (the
 * EventSource default exponential backoff is enough for our needs).
 */
interface StreamQuery {
  owner?: string;
  poolId?: string;
  agentAddress?: string;
}

export default async function streamRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/stream',
    {
      schema: {
        tags: ['Events'],
        summary:
          'Live SSE feed of indexed Pinace events (pool / agent / policy / action).',
        querystring: StreamQuerySchema,
      },
    },
    async (req: FastifyRequest<{ Querystring: StreamQuery }>, reply: FastifyReply) => {
      const { owner, poolId, agentAddress } = req.query;
      const wantOwner = owner?.toLowerCase();
      const wantPool = poolId;
      const wantAgent = agentAddress?.toLowerCase();

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Disable nginx/reverse-proxy buffering — events must flush
        // immediately or browsers see one event then nothing.
        'X-Accel-Buffering': 'no',
      });

      // Send an initial comment so the client knows the connection
      // opened and any reverse proxy actually flushes.
      reply.raw.write(`: connected\n\n`);

      const writeEvent = (e: SsePayload) => {
        // Per-connection filter: skip if any supplied filter doesn't
        // match.
        if (wantOwner && e.owner && e.owner !== wantOwner) return;
        if (wantPool && e.poolId && e.poolId !== wantPool) return;
        if (wantAgent && e.agentAddress && e.agentAddress.toLowerCase() !== wantAgent)
          return;
        try {
          reply.raw.write(`event: ${e.kind}\n`);
          reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
        } catch {
          /* socket closed mid-write — let the close handler tear down */
        }
      };

      const unsubscribe = ssePublisher.subscribe(writeEvent);

      // Heartbeat — 15s ping keeps proxies + browser-side EventSource
      // from killing the idle connection.
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`: ping ${Date.now()}\n\n`);
        } catch {
          /* will be cleaned by close */
        }
      }, 15_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.raw.on('close', cleanup);
      req.raw.on('error', cleanup);

      // Returning the reply tells fastify "hands off, I own the
      // connection". Without this, fastify would try to serialize the
      // return value and double-write the body.
      return reply;
    },
  );
}
