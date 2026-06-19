import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';
import { OwnerParamsSchema, OwnerStatsDtoSchema } from '../schemas.js';

export default async function ownerRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController },
) {
  fastify.get('/owners/:address/stats', {
    schema: {
      tags: ['Owners'],
      summary: 'Aggregate exec stats across every agent the owner controls',
      params: OwnerParamsSchema,
      response: { 200: OwnerStatsDtoSchema },
    },
  }, opts.controller.getOwnerStats.bind(opts.controller));
}
