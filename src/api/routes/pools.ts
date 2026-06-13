import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';
import { PoolParamsSchema, PoolDtoSchema, ErrorSchema } from '../schemas.js';

export default async function poolRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/pools/:poolId', {
    schema: {
      tags: ['Pools'],
      summary: 'Get a pool by ID',
      params: PoolParamsSchema,
      response: {
        200: PoolDtoSchema,
        404: ErrorSchema,
      },
    },
  }, opts.controller.getPool.bind(opts.controller));
}
