-- Migrating event polling off deprecated Sui JSON-RPC (queryEvents) onto the
-- Sui GraphQL events(filter:{module}) API. GraphQL uses opaque Relay-style
-- cursors instead of JSON-RPC's {txDigest, eventSeq} EventId, so the resume
-- point can no longer be reconstructed from event_logs.raw_payload.id — it
-- must be persisted explicitly.
-- See: src/shared/sui/client.ts queryEvents() + src/indexer/polling/loop.ts.
ALTER TABLE "checkpoints" ADD COLUMN "last_cursor" TEXT;
