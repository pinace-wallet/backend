import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';
import {
  AgentParamsSchema,
  AgentQuerySchema,
  AgentDtoSchema,
  PaginatedAgentSchema,
  ErrorSchema,
} from '../schemas.js';

export default async function agentRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/agents', {
    schema: {
      tags: ['Agents'],
      summary: 'List agents with optional filters',
      querystring: AgentQuerySchema,
      response: {
        200: PaginatedAgentSchema,
      },
    },
  }, opts.controller.getAgents.bind(opts.controller));

  fastify.get('/agents/:agentId', {
    schema: {
      tags: ['Agents'],
      summary: 'Get a single agent with policies',
      params: AgentParamsSchema,
      response: {
        200: AgentDtoSchema,
        404: ErrorSchema,
      },
    },
  }, opts.controller.getAgent.bind(opts.controller));
}
