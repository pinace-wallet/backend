import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';
import { AgentParamsSchema, TimelineQuerySchema, TimelineDtoSchema, ErrorSchema } from '../schemas.js';

export default async function timelineRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/agents/:agentId/timeline', {
    schema: {
      tags: ['Agents'],
      summary: 'Get an agent\'s event timeline with milestones and summary stats',
      params: AgentParamsSchema,
      querystring: TimelineQuerySchema,
      response: {
        200: TimelineDtoSchema,
        404: ErrorSchema,
      },
    },
  }, opts.controller.getAgentTimeline.bind(opts.controller));
}
