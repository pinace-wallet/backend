import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';

export default async function timelineRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/agents/:agentId/timeline', opts.controller.getAgentTimeline.bind(opts.controller));
}
