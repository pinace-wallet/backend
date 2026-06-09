# Pinace Backend: REST API & Onchain Event Indexer

Pinace Backend is a modular TypeScript backend application for the Pinace Wallet. It is divided into two primary sub-services connected via a shared PostgreSQL database:
1. **Onchain Event Indexer**: A stateful, singleton background worker that polls Sui blockchain events, processes them atomically, and persists pool balances, agents, policies, actions, and audit logs.
2. **REST API Server**: A stateless, horizontally scalable Fastify web server that exposes endpoints queried by the Frontend browser extension.

---

## 1. Architecture: Service-Worker Split (CQRS)

To support production scaling and avoid monolithic bottlenecks, the backend is split into two distinct paths:
* **The Command/Write Path (Event Indexer)**: Ingests data sequentially. It must run as a single process (Singleton) to prevent double-writes and write locks.
* **The Query/Read Path (Fastify REST Server)**: Stateless and lightweight, allowing it to scale out horizontally behind a load balancer to handle client traffic.
* **Shared Modules (`src/shared/`)**: Keeps database clients, schemas, environment configurations, and blockchain connections modular so both services import from a single source of truth without importing from each other.

---

## 2. Directory Layout

```
backend/
├── prisma/
│   └── schema.prisma           # Prisma schema definition (Models, Relations, PKs, indices)
├── src/
│   ├── shared/                 # Common components used by API and Indexer
│   │   ├── config.ts           # Zod schema env validation and default loader
│   │   ├── mappers.ts          # Kind/status integer mappers, agent run status logic
│   │   ├── db/
│   │   │   └── client.ts       # Prisma Client instance and child-process migration deployer
│   │   └── sui/
│   │       └── client.ts       # SuiClient RPC query wrapper with exponential retry logic
│   │
│   ├── indexer/                # Blockchain Ingestion Ingestor (Command side)
│   │   ├── main.ts             # Indexer worker process bootstrap
│   │   ├── polling/
│   │   │   └── loop.ts         # Cursor-based polling scheduler
│   │   ├── processor/          # Event type processors (pool, agent, policy, action)
│   │   │   ├── index.ts
│   │   │   ├── pool.ts
│   │   │   ├── agent.ts
│   │   │   ├── policy.ts
│   │   │   └── action.ts
│   │   └── repository/
│   │       └── indexer.repository.ts # Ingestion database write methods
│   │
│   ├── api/                    # REST HTTP Server (Query side)
│   │   ├── main.ts             # API server process bootstrap
│   │   ├── server.ts           # Fastify app instantiation and route registrations
│   │   ├── controllers/
│   │   │   └── api.controller.ts # Route input validation and status routers
│   │   ├── services/
│   │   │   └── api.service.ts  # Timeline calculations and query business logic
│   │   ├── repository/
│   │   │   └── api.repository.ts # Read-only database query methods
│   │   ├── mappers.ts          # Mappers formatting Prisma outputs to camelCase DTOs
│   │   └── routes/             # Fastify route endpoints
│   │       ├── health.ts
│   │       ├── pools.ts
│   │       ├── agents.ts
│   │       ├── timeline.ts
│   │       ├── actions.ts
│   │       └── events.ts
│   │
│   └── index.ts                # Dev concurrent bootstrap entrypoint (runs both side-by-side)
├── Dockerfile                  # Production multi-stage Docker build
└── docker-compose.yml          # Container configuration for postgres and backend services
```

---

## 3. Environment Variables

Create a `.env` file in the root `backend/` directory:

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUI_RPC_URL` | Yes | - | Sui Testnet RPC endpoint URL |
| `PACKAGE_ID` | Yes | - | 0x-prefixed 64-character hex ID of Pinace core package |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `PORT` | No | `3001` | REST API HTTP port (range: `1024-65535`) |
| `POLL_INTERVAL_MS` | No | `2000` | Indexer polling interval in ms (range: `1000-60000`) |
| `BATCH_SIZE` | No | `50` | Max Sui events fetched per query (range: `1-200`) |
| `LOG_LEVEL` | No | `info` | Logger severity level (`debug`, `info`, `warn`, `error`) |

*Note: If optional numerics fall out of range, the validator logs a warning and falls back to default values instead of crashing.*

---

## 4. Development & Running

### Installation & Client Generation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Generate the Prisma Client types:
   ```bash
   npm run prisma:generate
   ```

### Running Locally
* **Run API and Indexer together (Dev mode)**:
  ```bash
  npm run dev
  ```
* **Run API Server standalone**:
  ```bash
  npx tsx src/api/main.ts
  ```
* **Run Indexer Background Worker standalone**:
  ```bash
  npx tsx src/indexer/main.ts
  ```

---

## 5. Database Management (Prisma)

* **Generate Client**: `npm run prisma:generate` (rebuilds TypeScript models).
* **Create Migrations**: `npm run prisma:migrate` (during development).
* **Deploy Migrations**: `npm run prisma:deploy` (applies pending schema changes in production).

---

## 6. Docker Deployment

Launch PostgreSQL and the unified backend container concurrently:
```bash
docker-compose up --build
```
* The unified container will automatically execute migrations (`prisma migrate deploy`) and generate the Client before starting up.

---

## 7. REST API Endpoints

All endpoints support CORS for Chrome Extension origins (`chrome-extension://*`) and return camelCase JSON.

### GET `/health`
Returns indexing status and lag time. Returns HTTP `503` if lag exceeds 60 seconds.
```json
{ "status": "ok", "lastCheckpoint": 4208000, "lagMs": 1400 }
```

### GET `/pools/:poolId`
Returns pool status and coin balance array.
```json
{
  "poolId": "0xabc...",
  "owner": "0xdef...",
  "status": "active",
  "protocolVersion": 1,
  "createdAt": "2026-06-09T07:31:52.000Z",
  "balances": [
    { "coinType": "0x2::sui::SUI", "amount": "1500000000" }
  ]
}
```

### GET `/agents`
Returns paginated list of agents. Filters: `owner`, `poolId`, `status`. Page size: `20`.
```json
{
  "data": [
    {
      "id": "uuid-string",
      "address": "0xagent...",
      "poolId": "0xpool...",
      "owner": "0xowner...",
      "name": "0xagent...",
      "status": "active",
      "runStatus": "running",
      "expiresMs": 0,
      "connectedAt": 1700000000000,
      "revokedAt": null,
      "actionCount": 12,
      "lastActiveAt": 1700005000000
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### GET `/agents/:agentId`
Returns an agent details joined with active policies (`status = 'attached'`).

### GET `/agents/:agentId/timeline`
Returns chronologically sorted events list, milestone checkpoints, and volume statistics summary for an agent address. Supports `before` ISO timestamp string cursor for pagination.
```json
{
  "events": [...],
  "milestones": [
    {
      "id": "action-uuid",
      "agentId": "agent-uuid",
      "action": "swap",
      "amount": "1000000",
      "coinType": "",
      "timestamp": 1700005000000,
      "status": "success",
      "txDigest": "0xtx..."
    }
  ],
  "summary": {
    "actionCount": 12,
    "successRate": 91.6,
    "lastActiveAt": 1700005000000,
    "totalVolumeByKind": { "swap": "5000000" }
  },
  "hasMore": false
}
```

### GET `/actions`
Returns actions history. Filters: `poolId`, `agentAddress`, `status`, `kind`. Page size limit capped at `100`.

### GET `/events`
Returns raw event log logs. Filters: `poolId`, `agentAddress`, `eventType`. Page size limit capped at `200`.
