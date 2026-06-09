import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';

export default async function poolRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/pools/:poolId', opts.controller.getPool.bind(opts.controller));
}
