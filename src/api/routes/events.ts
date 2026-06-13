import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';
import { EventQuerySchema, PaginatedEventSchema } from '../schemas.js';

export default async function eventRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/events', {
    schema: {
      tags: ['Events'],
      summary: 'List event logs with optional filters',
      querystring: EventQuerySchema,
      response: {
        200: PaginatedEventSchema,
      },
    },
  }, opts.controller.getEvents.bind(opts.controller));
}
