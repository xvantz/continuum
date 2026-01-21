## Shared Domain Contracts

The `shared` package provides a single source of truth for Continuum's domain
schemas. Zod defines each structure, while `z.infer` exposes the matching
TypeScript types so `server` and `web` stay in sync. Every parser helper returns
a `Result` from `neverthrow` to comply with the global error-handling policy.

### Modules derived from SPEC.md

| Module | Description | SPEC reference |
| --- | --- | --- |
| `controls.ts` | Simulation config fields (`requestRate`, `payloadComplexity`, `nodeConcurrency`, `failureRate`, `seed`, `runDurationMs`). Includes range validation and helpers to parse run start payloads. | §5.1 |
| `graph.ts` | Static graph description (`graphId`, node definitions with `kind`/`concurrency`, edge list, optional layout coordinates). | §3.2–3.3 |
| `trace.ts` | Trace/token state, enums for `TraceStatus`, `SpanStatus`, and basic span metadata. | §3.4–3.5 |
| `metrics.ts` | Node/edge metric payloads, per-frame snapshot format (200 ms cadence), and inspect payload snippets. | §6 |
| `replay.ts` | Replay JSON bundle schema (`meta`, `timeline` frames, optional samples). | §8 |
| `index.ts` | Barrel file that re-exports schemas, inferred types, and helpers for consumers. | n/a |

Each module keeps serialization-centric data (IDs, timestamps, metrics, enums).
Execution-specific items (e.g., actual handler functions) continue to live in
`server`, but they must shape their inputs/outputs via these schemas.
