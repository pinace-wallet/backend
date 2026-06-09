import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';

export default async function healthRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/health', opts.controller.getHealth.bind(opts.controller));
}
