import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';

export default async function actionRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/actions', opts.controller.getActions.bind(opts.controller));
  fastify.get('/actions/:actionId', opts.controller.getAction.bind(opts.controller));
}
