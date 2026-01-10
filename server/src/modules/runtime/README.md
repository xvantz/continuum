## Runtime Module

The runtime module owns the Continuum simulation loop:

- `graphRegistryService` exposes the canonical graph definition so other
  packages render the same topology.
- `runtimeService` controls the run lifecycle (start/stop), generates load at
  the configured RPS, and pushes tokens through the node scheduler. Each node
  handler performs real CPU work (Zod validation, numeric transforms, hashing)
  to reflect actual processing time; no artificial sleeps are used.
- `PipelineScheduler` coordinates per-node queues with configurable concurrency,
  ensuring that handlers obey the requested worker limits. `getSchedulerSnapshot`
  exposes queue/inflight counters for downstream metrics (`threejsCosmos-0iz.3`).
- `metricsService` attaches to the scheduler observer to generate 200 ms metrics
  snapshots, track EMA latency/error rates, maintain node trace buffers, and
  store recent span timelines with TTL cleanup for trace subscriptions.
- `wsController` exposes the SPEC-compliant WebSocket endpoint (`/ws`) that
  streams metrics snapshots, handles run start/stop commands, node inspect
  requests, and trace subscribe/unsubscribe events.
- `replayRecorderService` listens to metrics snapshots and runtime lifecycle to
  build replay bundles and automatically write `demos/*.json` files for the
  static replay mode.

Consumers (controllers, metrics services, WebSocket adapters) should depend on
`runtimeService` to start/stop runs, inspect active/persisted traces, and read
node snapshot data instead of duplicating scheduling logic.
