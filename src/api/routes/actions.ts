import { FastifyInstance } from 'fastify';
import { ApiController } from '../controllers/api.controller.js';
import {
  ActionParamsSchema,
  ActionQuerySchema,
  ActionDtoSchema,
  PaginatedActionSchema,
  ErrorSchema,
} from '../schemas.js';

export default async function actionRoutes(
  fastify: FastifyInstance,
  opts: { controller: ApiController }
) {
  fastify.get('/actions', {
    schema: {
      tags: ['Actions'],
      summary: 'List actions with optional filters',
      querystring: ActionQuerySchema,
      response: {
        200: PaginatedActionSchema,
      },
    },
  }, opts.controller.getActions.bind(opts.controller));

  fastify.get('/actions/:actionId', {
    schema: {
      tags: ['Actions'],
      summary: 'Get a single action by ID',
      params: ActionParamsSchema,
      response: {
        200: ActionDtoSchema,
        404: ErrorSchema,
      },
    },
  }, opts.controller.getAction.bind(opts.controller));
}
