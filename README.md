# threejsCosmos

## Running in Live Mode

- `pnpm dev` – starts both the Fastify backend and the Svelte client with a WebSocket bridge for real-time metrics, node inspect, and trace playback.
- The UI automatically connects to `ws://localhost:4000/ws`. Use the Start/Stop buttons to control the simulation and click nodes or trace IDs to inspect live data.

## Generating Replay Bundles

1. `pnpm replay:record` – runs the simulation headlessly for ~10 s and writes `demos/latest.json` (plus a timestamped copy) via the runtime replay recorder.
2. Repeat the command whenever you want to refresh the static bundle. Optional span samples from the most recent traces are embedded automatically (max 3 per SPEC).

## Building the Replay UI

1. `pnpm --filter web build` – runs `tsc`/`vite build` and copies any files under the repository-level `demos/` directory into `web/dist/demos`.
2. The Replay toggle in the UI loads `demos/latest.json` by default. Adjust the path in the header controls or drop additional JSON files into the same folder.
3. Deploy the contents of `web/dist/` (including the `demos/` subdirectory) to GitHub Pages or any static host. No backend is required in this mode.

The Replay mode reuses the same Three.js visualization, Node Inspect metrics, and Trace View timeline. Trace samples drive the panel in Replay mode, while live spans (with node/edge animation) remain exclusive to the WebSocket connection per SPEC v1.
