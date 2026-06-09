import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';

export default async function agentRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/agents', opts.controller.getAgents.bind(opts.controller));
  fastify.get('/agents/:agentId', opts.controller.getAgent.bind(opts.controller));
}
