import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';
import { HealthSchema, ErrorSchema } from '../schemas.js';

export default async function healthRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Service health check',
      response: {
        200: HealthSchema,
        503: HealthSchema.merge(ErrorSchema.partial()),
      },
    },
  }, opts.controller.getHealth.bind(opts.controller));
}
