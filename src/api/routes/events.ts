import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';

export default async function eventRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/events', opts.controller.getEvents.bind(opts.controller));
}
