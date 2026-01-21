Continuum v1 — Technical Specification

1. Project Overview & Philosophy
   Continuum is a backend-first simulator and visualizer of request processing within a modular system (nodes). It focuses on observable metrics and distributed tracing (spans).

Key Principles
Authoritative Server: The server generates load, manages processing logic, calculates metrics, and emits trace/span events. It is the single source of truth.

Visualizer Client: The client renders the graph/flows based on server data. It supports "Visual Speed" (slowing down playback) without affecting the actual server processing speed.

Real Workload (No Fake Sleeps): Time consumption must originate from actual operations:

Queues / Scheduler limits.

Real CPU work (validation, transformation, serialization, hashing).

Concurrency policies (rate limits).

Strictly NO setTimeout or artificial delays "for aesthetics".

2. Operating Modes
   2.1 Live Mode (Local Development)
   Command: pnpm dev

Architecture: apps/server (Node.js) + apps/web (Svelte/React).

Communication: WebSocket.

Data Flow:

Server pushes periodic Metric Snapshots.

Server pushes Recent Trace Lists per node.

Client can subscribeTrace(traceId) to receive granular Span events for a specific trace.

2.2 Replay Mode (Public Demo / GitHub Pages)
Command: pnpm build:web → Deploy to Static Host.

Architecture: Client-only (No active WebSocket connection).

Data Flow:

Client fetches static JSON files from demos/\*.json.

Playback logic simulates time progression based on recorded snapshots.

Constraint: Trace View is optional/limited in v1 Replay (pre-recorded samples only).

3. Core Entities (Domain Model)
   3.1 Run
   Represents a single simulation session.

runId: string (UUID)

status: idle | running | stopped

startedAtServerMs: number (Monotonic relative time)

config: See Controls (Section 5).

3.2 Graph
The topology of the system.

graphId: string

nodes: NodeDef[]

edges: EdgeDef[]

layout: 3D coordinates (fixed or computed).

3.3 Node
A processing module in the pipeline.

nodeId: string

kind: receive | validate | transform | router | persist | sink

concurrency: number (Max concurrent workers).

queue: FIFO<TokenRef>

handler: Function (token) -> output (performs the real CPU work).

3.4 Token / Trace
In v1, 1 Request = 1 Trace = 1 Token.

traceId: string

seed: number (For deterministic payload generation).

createdAtServerMs: number.

location: Current nodeId or edgeId.

status: active | finished | failed.

3.5 Span
The atomic unit of observability.

spanId: string

traceId: string

nodeId: string (or edge/stage).

name: string (e.g., receive, validate, process).

startTime: number

endTime: number | null

status: running | ok | error

error: { code, message } (optional).

4. Visual Model (Three.js / Svelte)
   4.1 Overview (Default View)
   Entities: Nodes (Spheres) + Edges (Lines).

Aggregated Visualization (Not 1:1 particles):

Node Size/Brightness: Represents inflight count.

Node Aura/Ring: Represents queueLen.

Red Pulse: Represents errorRate.

Edge Thickness/Intensity: Represents throughput.

Particles: "Flow particles" are visual effects only. Limit ≤ 300 total. They reflect density/rate, not individual traces.

4.2 Node Inspect Panel
Triggered by clicking a Node.

Real-time metrics.

Recent Traces: List of last 20-50 traceIds (Ring Buffer).

Filters: Latest / Errors / Slow.

4.3 Trace View (Live Mode Only)
Triggered by clicking a traceId.

Action: Client sends trace.subscribe(traceId).

Visuals:

Active Span on Node = Blinking Node.

Transition (Edge) = Moving point + growing line.

Timeline: Compact list sidebar (Span Name + Duration + Status).

4.4 Controls
Camera: Orbit (default), Focus Node, Follow Trace (optional).

Visual Speed: 0.25x to 4x.

Note: Affects UI playback/interpolation only. Server always runs at 1.0x.

5. Simulation Control & Load Generation
   5.1 Controls (Server Params)
   requestRate: 20-200 req/sec.

payloadComplexity: 1-5 (Affects CPU time).

nodeConcurrency: 1-8 (Worker slots per node).

failureRate: 0-20% (Probability of error).

seed: int (For deterministic randomness).

runDurationMs: 0 or positive ms (0 = no limit, otherwise auto-stop).

5.2 Deterministic Load Generation
No sleep(). Duration comes from:

Queue: Waiting for a free worker slot.

Payload Generation: generate(seed, complexity) creates data structures.

Validation: Zod schema parsing.

Crypto/IO: Hashing, Fingerprinting, Serialization.

5.3 Pipeline Behavior (v1 Preset)
Receive: Parse input, assign TraceID -> Enqueue.

Validate: Zod check + Normalization (Can fail).

Transform: Modifies payload. Fan-out logic (Trace contains N tasks).

Route: Logic to choose next path (Main or Fallback).

Process: Heavy CPU work (Aggregation/Transformation).

Persist: Memory store write + Snapshotting.

Sink: Finalize trace.

6. Metrics & Data Storage
   6.1 Server-Side Aggregation
   Snapshots: Sent every 200ms.

Node Metrics: inflight, queueLen, throughput, avgLatency (EMA), errorRate (EMA).

Edge Metrics: rate, errorRate.

6.2 Trace Storage (Live)
Per Node: Ring Buffers (Size 50) for recent, errors, slow.

Trace Logs: SpanEvent[] stored with TTL (60-120s). Auto-cleanup of finished traces.

7. API Protocol (WebSocket)
   Client → Server
   run.start(params)

run.stop()

node.inspect(nodeId)

trace.subscribe(traceId) / unsubscribe

Server → Client
All messages include: runId, seq, tServerMs.

metrics.snapshot({ nodes[], edges[] })

node.inspect.response({ metrics, recentTraceIds... })

trace.span.started / trace.span.ended

8. Replay Format (JSON)
   Meta: Config, date, duration.

Timeline: Array of Frames.

Frame = { t: number, nodesMetrics[], edgesMetrics[] }

TraceSamples: (Optional) Array of 1-3 full trace logs for demo purposes.

9. Definition of Done (v1)
   Graph Overview: Nodes/Edges rendered via Three.js.

Live Mode: Start/Stop, Breathing Overview (Metrics), Node Inspect.

Trace View: Visualize 1 active trace (Life of a request).

Replay Mode: GitHub Pages demo reading static JSON.

Constraint: Smooth 60fps UI, Server handles up to 200 RPS.

10. Implementation Plan
    Phase 1: Core Runtime (Server)

Graph registry, Scheduler (Queues/Concurrency).

Span lifecycle & Storage (Ring buffers).

WS API skeleton.

Phase 2: UI Overview

Three.js Graph setup.

Parsing Metric Snapshots -> Visual updates.

Client-side Time/Speed control logic.

Phase 3: Node Inspect

Click interaction.

Data fetching for specific nodes.

Phase 4: Trace View (Live)

Subscription logic.

Path visualization & Timeline sidebar.

Phase 5: Replay & Polish

Recorder -> JSON.

Replay Loader logic.

GitHub Pages deployment.
