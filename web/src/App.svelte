<script lang="ts">
  import { onMount } from "svelte";
  import type { Graph } from "@shared/graph";
  import type { MetricsSnapshot } from "@shared/metrics";
  import type { Run } from "@shared/run";
  import ThreeOverview from "./lib/components/ThreeOverview.svelte";
  import { RuntimeClient } from "./lib/runtimeClient";

  const runtimeUrl = import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";
  const client = new RuntimeClient(runtimeUrl);

  let graph = $state<Graph | null>(null);
  let snapshot = $state<MetricsSnapshot | null>(null);
  let run = $state<Run | null>(null);
  let status = $state<"connecting" | "connected" | "disconnected">(
    "connecting",
  );
  let wsError = $state<{ code: string; message: string } | null>(null);
  let visualSpeed = $state(1);

  let inflightTotal = $state(0);
  let throughputTotal = $state(0);

  $effect(() => {
    if (snapshot) {
      inflightTotal = snapshot.nodes.reduce(
        (sum, node) => sum + node.inflight,
        0,
      );
      throughputTotal = snapshot.nodes.reduce(
        (sum, node) => sum + node.throughput,
        0,
      );
    } else {
      inflightTotal = 0;
      throughputTotal = 0;
    }
  });

  const connect = () => {
    status = "connecting";
    wsError = null;
    client.connect();
  };

  const startRun = () => {
    client.send({
      type: "run.start",
      controls: {},
    });
  };

  const stopRun = () => {
    client.send({ type: "run.stop" });
  };

  onMount(() => {
    const handleOpen = () => {
      status = "connected";
    };
    const handleClose = () => {
      status = "disconnected";
    };
    const handleSnapshot = (event: CustomEvent<MetricsSnapshot>) => {
      snapshot = event.detail;
    };
    const handleGraph = (event: CustomEvent<Graph>) => {
      graph = event.detail;
    };
    const handleState = (event: CustomEvent<{ run: Run | null }>) => {
      run = event.detail.run;
    };
    const handleError = (event: CustomEvent<{ code: string; message: string }>) => {
      wsError = event.detail;
    };

    client.addEventListener("open", handleOpen);
    client.addEventListener("close", handleClose);
    client.addEventListener("snapshot", handleSnapshot as EventListener);
    client.addEventListener("graph", handleGraph as EventListener);
    client.addEventListener("state", handleState as EventListener);
    client.addEventListener("wsError", handleError as EventListener);

    connect();

    return () => {
      client.removeEventListener("open", handleOpen);
      client.removeEventListener("close", handleClose);
      client.removeEventListener("snapshot", handleSnapshot as EventListener);
      client.removeEventListener("graph", handleGraph as EventListener);
      client.removeEventListener("state", handleState as EventListener);
      client.removeEventListener("wsError", handleError as EventListener);
      client.disconnect();
    };
  });
</script>

<main class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
  <header class="border-b border-white/5 bg-slate-950/80 backdrop-blur">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div>
        <p class="text-xs uppercase tracking-[0.35em] text-emerald-300">Continuum</p>
        <h1 class="text-xl font-semibold text-white">Runtime Overview</h1>
      </div>
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-2 text-sm text-slate-300">
          <span
            class="inline-flex h-2.5 w-2.5 rounded-full"
            class:bg-emerald-400={status === "connected"}
            class:bg-amber-300={status === "connecting"}
            class:bg-rose-400={status === "disconnected"}
          ></span>
          {status}
        </span>
        <button
          class="rounded-full border border-white/20 px-4 py-1 text-sm font-semibold text-slate-100 transition hover:border-emerald-400 hover:text-white"
          onclick={connect}
        >
          Reconnect
        </button>
      </div>
    </div>
  </header>

  <section class="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[3fr_1fr]">
    <div class="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-emerald-500/10">
      <div class="border-b border-white/5 bg-slate-900/60 px-6 py-4">
        <div class="flex flex-wrap items-center gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-emerald-300">Visual Speed</p>
            <div class="mt-1 flex items-center gap-3 text-sm text-slate-300">
              <input
                type="range"
                min="0.25"
                max="4"
                step="0.25"
                bind:value={visualSpeed}
                class="w-48 accent-emerald-400"
              />
              <span>{visualSpeed.toFixed(2)}x</span>
            </div>
          </div>
          <div class="ml-auto flex items-center gap-3 text-sm text-slate-300">
            <button
              class="rounded-full bg-emerald-400 px-4 py-1 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/30 disabled:text-emerald-200"
              onclick={startRun}
              disabled={run?.status === "running"}
            >
              Start Run
            </button>
            <button
              class="rounded-full border border-white/20 px-4 py-1 font-semibold text-slate-100 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
              onclick={stopRun}
              disabled={!run || run.status !== "running"}
            >
              Stop
            </button>
          </div>
        </div>
      </div>
      <div class="h-[70vh]">
        <ThreeOverview {graph} {snapshot} {visualSpeed} />
      </div>
    </div>

    <aside class="space-y-4">
      <div class="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p class="text-xs uppercase tracking-[0.45em] text-emerald-300">Run Status</p>
        {#if run}
          <div class="mt-4 space-y-2 text-sm text-slate-300">
            <p>
              <span class="text-slate-400">Run ID:</span> {run.runId.slice(0, 8)}…
            </p>
            <p>
              <span class="text-slate-400">State:</span> {run.status}
            </p>
            <p>
              <span class="text-slate-400">Rate:</span> {run.config.requestRate} req/s
            </p>
            <p>
              <span class="text-slate-400">Complexity:</span> {run.config.payloadComplexity}
            </p>
          </div>
        {:else}
          <p class="mt-4 text-sm text-slate-400">Waiting for runtime state…</p>
        {/if}
      </div>

      <div class="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <p class="text-xs uppercase tracking-[0.45em] text-emerald-300">Live Metrics</p>
        {#if snapshot}
          <dl class="mt-4 space-y-2 text-sm text-slate-200">
            <div class="flex items-center justify-between">
              <dt class="text-slate-400">Inflight</dt>
              <dd class="font-semibold text-white">{inflightTotal}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-slate-400">Throughput</dt>
              <dd class="font-semibold text-white">{throughputTotal.toFixed(1)} /s</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-slate-400">Snapshot #</dt>
              <dd class="font-semibold text-white">{snapshot.seq}</dd>
            </div>
          </dl>
        {:else}
          <p class="mt-4 text-sm text-slate-400">Waiting for metrics snapshot…</p>
        {/if}
      </div>

      {#if wsError}
        <div class="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-100">
          <p class="font-semibold uppercase tracking-[0.3em] text-rose-200">WebSocket Error</p>
          <p class="mt-2">{wsError.message}</p>
        </div>
      {/if}
    </aside>
  </section>
</main>
