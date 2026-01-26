<svelte:options runes={false} />

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Span } from "@shared/trace";
  import type { TraceSample } from "@shared/replay";

  export let traceId: string | null = null;
  export let spans: Span[] = [];
  export let status: "idle" | "loading" | "ready" = "idle";
  export let playbackTimeMs = 0;
  export let runStartMs: number | null = null;
  export let traceSamples: TraceSample[] = [];
  export let mode: "live" | "replay" = "live";

  const dispatch = createEventDispatcher<{
    close: void;
    sampleSelect: { traceId: string };
  }>();

  const formatDuration = (ms: number) => {
    const clamped = Math.max(0, ms);
    if (clamped < 1000) {
      return `${clamped.toFixed(0)} ms`;
    }
    return `${(clamped / 1000).toFixed(2)} s`;
  };

  const formatTraceLabel = (id: string) => `${id.slice(0, 8)}…`;
  const formatDigest = (digest: string) =>
    digest.length > 12 ? `${digest.slice(0, 12)}…` : digest;

  $: timeline = spans.map((span) => {
    const reference = runStartMs ?? span.startTime;
    const relativeStart = Math.max(0, span.startTime - reference);
    const relativeEnd = span.endTime ? Math.max(0, span.endTime - reference) : null;
    const currentDuration =
      span.endTime !== null
        ? Math.max(0, span.endTime - span.startTime)
        : Math.max(0, playbackTimeMs - relativeStart);
    const state =
      span.status === "running"
        ? {
            label: "Running",
            tone: "text-amber-300",
            badge: "bg-amber-400/20 text-amber-200",
          }
        : span.status === "error"
          ? {
              label: span.error?.code ?? "Error",
              tone: "text-rose-300",
              badge: "bg-rose-400/20 text-rose-200",
            }
          : {
              label: "OK",
              tone: "text-emerald-300",
              badge: "bg-emerald-400/20 text-emerald-200",
            };
    return {
      spanId: span.spanId,
      name: span.name,
      nodeId: span.nodeId,
      status: span.status,
      durationMs: currentDuration,
      state,
      relativeStart,
      relativeEnd,
      error: span.error?.message ?? null,
      payload: span.payload ?? null,
    };
  });
</script>

<div class="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-xs uppercase tracking-[0.45em] text-emerald-300">Trace View</p>
      {#if traceId}
        <h3 class="mt-1 font-semibold text-white">{formatTraceLabel(traceId)}</h3>
      {:else}
        <p class="mt-1 text-sm text-slate-400">Click a trace ID to subscribe</p>
      {/if}
    </div>
    <button
      class="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-slate-400 transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-600"
      onclick={() => dispatch("close")}
      disabled={!traceId}
    >
      Close
    </button>
  </div>

  {#if mode === "replay"}
    <div class="mt-4 space-y-2">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Trace Samples</p>
      {#if traceSamples.length === 0}
        <p class="text-xs text-slate-500">No recorded samples bundled with this replay.</p>
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each traceSamples as sample}
            <button
              class="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-indigo-400"
              onclick={() => dispatch("sampleSelect", { traceId: sample.traceId })}
            >
              {formatTraceLabel(sample.traceId)}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if traceId}
    {#if status === "loading"}
      <p class="mt-4 text-sm text-slate-400">Subscribing to trace events…</p>
    {/if}
    <div class="mt-4 space-y-2">
      {#if timeline.length === 0 && status === "ready"}
        <p class="text-sm text-slate-500">Waiting for span activity…</p>
      {:else}
        {#each timeline as entry (entry.spanId)}
          <div class="rounded-xl border border-white/10 bg-slate-950/50 p-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-white">{entry.name}</p>
                <p class="text-xs uppercase tracking-wide text-slate-400">{entry.nodeId}</p>
              </div>
              <div class="text-right">
                <span
                  class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${entry.state.badge}`}
                >
                  {entry.state.label}
                </span>
                <p class={`mt-1 text-sm font-mono ${entry.state.tone}`}>{formatDuration(entry.durationMs)}</p>
              </div>
            </div>
            {#if entry.error}
              <p class="mt-2 text-xs text-rose-200">{entry.error}</p>
            {/if}
            {#if entry.payload}
              <p class="mt-2 text-xs text-slate-300">
                payload {formatDigest(entry.payload.digest)} | tasks {entry.payload.taskCount} |
                matrix {entry.payload.matrixRows}x{entry.payload.matrixCols} | vector {entry.payload.vectorSize}
              </p>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {:else if mode === "replay"}
    <p class="mt-4 text-sm text-slate-500">Select a trace sample above to preview its timeline.</p>
  {/if}
</div>
