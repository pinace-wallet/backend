import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiService } from '../services/api.service.js';

export class ApiController {
  private service: ApiService;

  constructor(service: ApiService) {
    this.service = service;
  }

  /**
   * Handler: GET /pools/:poolId
   * Requirement: 7.1, 7.7
   */
  async getPool(
    req: FastifyRequest<{ Params: { poolId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { poolId } = req.params;
    const pool = await this.service.getPool(poolId);
    if (!pool) {
      reply.status(404).send({ error: 'not_found', message: `Pool ${poolId} not found` });
      return;
    }
    reply.send(pool);
  }

  /**
   * Handler: GET /agents
   * Requirement: 7.2, 7.6, 7.8
   */
  async getAgents(
    req: FastifyRequest<{
      Querystring: { owner?: string; poolId?: string; status?: string; page?: string; limit?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { owner, poolId, status, page: rawPage, limit: rawLimit } = req.query;

    // Normalize pagination params
    let page = Number(rawPage ?? 1);
    if (isNaN(page) || page < 1) page = 1;

    let limit = Number(rawLimit ?? 20);
    if (isNaN(limit) || limit < 1) limit = 20;

    const result = await this.service.getAgents({ owner, poolId, status }, page, limit);
    reply.send(result);
  }

  /**
   * Handler: GET /agents/:agentId
   * Requirement: 7.3, 7.7
   */
  async getAgent(
    req: FastifyRequest<{ Params: { agentId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { agentId } = req.params;
    const agent = await this.service.getAgent(agentId);
    if (!agent) {
      reply.status(404).send({ error: 'not_found', message: `Agent ${agentId} not found` });
      return;
    }
    reply.send(agent);
  }

  /**
   * Handler: GET /actions
   * Requirement: 7.4, 7.6, 7.8
   */
  async getActions(
    req: FastifyRequest<{
      Querystring: { poolId?: string; agentAddress?: string; status?: string; kind?: string; page?: string; limit?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { poolId, agentAddress, status, kind, page: rawPage, limit: rawLimit } = req.query;

    let page = Number(rawPage ?? 1);
    if (isNaN(page) || page < 1) page = 1;

    let limit = Number(rawLimit ?? 20);
    if (isNaN(limit) || limit < 1) limit = 20;
    // Cap actions limit at 100
    if (limit > 100) limit = 100;

    const result = await this.service.getActions({ poolId, agentAddress, status, kind }, page, limit);
    reply.send(result);
  }

  /**
   * Handler: GET /actions/:actionId
   * Requirement: 8.3, 7.7
   */
  async getAction(
    req: FastifyRequest<{ Params: { actionId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { actionId } = req.params;
    const action = await this.service.getAction(actionId);
    if (!action) {
      reply.status(404).send({ error: 'not_found', message: `Action ${actionId} not found` });
      return;
    }
    reply.send(action);
  }

  /**
   * Handler: GET /events
   * Requirement: 7.5, 7.6, 7.8
   */
  async getEvents(
    req: FastifyRequest<{
      Querystring: { poolId?: string; agentAddress?: string; eventType?: string; page?: string; limit?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { poolId, agentAddress, eventType, page: rawPage, limit: rawLimit } = req.query;

    let page = Number(rawPage ?? 1);
    if (isNaN(page) || page < 1) page = 1;

    let limit = Number(rawLimit ?? 50);
    if (isNaN(limit) || limit < 1) limit = 50;
    // Cap events limit at 200
    if (limit > 200) limit = 200;

    const result = await this.service.getEvents({ poolId, agentAddress, eventType }, page, limit);
    reply.send(result);
  }

  /**
   * Handler: GET /agents/:agentId/timeline
   * Requirement: 8.1, 8.5, 7.7
   */
  async getAgentTimeline(
    req: FastifyRequest<{ Params: { agentId: string }; Querystring: { before?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { agentId } = req.params;
    const { before } = req.query;

    let beforeCursor: Date | undefined = undefined;
    if (before) {
      const parsedDate = new Date(before);
      if (!isNaN(parsedDate.getTime())) {
        beforeCursor = parsedDate;
      }
    }

    const timeline = await this.service.getAgentTimeline(agentId, beforeCursor);
    if (!timeline) {
      reply.status(404).send({ error: 'not_found', message: `Agent ${agentId} not found` });
      return;
    }
    reply.send(timeline);
  }

  /**
   * Handler: GET /health
   * Requirement: 9.3
   */
  async getHealth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const health = await this.service.getHealthStatus();
    
    if (health.status === 'ok') {
      reply.status(200).send(health);
    } else {
      reply.status(503).send(health);
    }
  }
}
