import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod';
import { PrismaClient } from '@prisma/client';
import { AppConfig } from '../shared/config.js';
import { ApiRepository } from './repository/api.repository.js';
import { ApiService } from './services/api.service.js';
import { ApiController } from './controllers/api.controller.js';

// Route imports
import healthRoutes from './routes/health.js';
import poolRoutes from './routes/pools.js';
import agentRoutes from './routes/agents.js';
import ownerRoutes from './routes/owners.js';
import timelineRoutes from './routes/timeline.js';
import actionRoutes from './routes/actions.js';
import eventRoutes from './routes/events.js';
import streamRoutes from './routes/stream.js';

/**
 * Builds the Fastify application instance.
 * Requirement: 12.2, 10.4
 */
export function buildApp(config: AppConfig, prisma: PrismaClient): FastifyInstance {
  const app = fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // Use Zod for request validation and response serialization
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Collects route schemas to power the generate:openapi script.
  // jsonSchemaTransform converts Zod schemas → OpenAPI-compatible JSON Schema.
  app.register(swagger, {
    transform: jsonSchemaTransform,
    openapi: {
      info: {
        title: 'Pinace API',
        version: '0.1.0',
        description: 'REST API for Pinace Wallet — pools, agents, actions, and event logs.',
      },
      tags: [
        { name: 'Health', description: 'Service health and indexer lag' },
        { name: 'Pools', description: 'Liquidity pool data' },
        { name: 'Agents', description: 'Agent accounts and policies' },
        { name: 'Actions', description: 'Agent-initiated on-chain actions' },
        { name: 'Events', description: 'Raw on-chain event logs' },
      ],
    },
  });

  // Register CORS to allow chrome extension origins
  app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or local testing)
      if (!origin) {
        cb(null, true);
        return;
      }

      // Allow Chrome Extension origins
      if (origin.startsWith('chrome-extension://')) {
        cb(null, true);
        return;
      }

      // Localhost dev (any port) — fenik POC, wallet popup, ad-hoc tools.
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        cb(null, true);
        return;
      }

      // Pinace web origins: production agent POC + landing.
      const allowed = new Set([
        "https://fenik.one",
        "https://www.fenik.one",
        "https://pinace.xyz",
        "https://www.pinace.xyz",
      ]);
      if (allowed.has(origin)) {
        cb(null, true);
        return;
      }

      // Default fallback
      cb(null, false);
    },
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });

  // Wires up the Controller-Service-Repository architecture
  const repo = new ApiRepository(prisma);
  const service = new ApiService(repo);
  const controller = new ApiController(service);

  // Register routes with the controller passed as options
  app.register(healthRoutes, { controller });
  app.register(poolRoutes, { controller });
  app.register(agentRoutes, { controller });
  app.register(ownerRoutes, { controller });
  app.register(timelineRoutes, { controller });
  app.register(actionRoutes, { controller });
  app.register(eventRoutes, { controller });
  app.register(streamRoutes);

  return app;
}

/**
 * Starts the Fastify server.
 */
export async function startServer(app: FastifyInstance, port: number): Promise<string> {
  return app.listen({ port, host: '0.0.0.0' });
}
