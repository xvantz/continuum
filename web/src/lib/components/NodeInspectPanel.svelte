<svelte:options runes={false} />

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { NodeInspectPayload } from "@shared/metrics";

  export let node: NodeInspectPayload | null = null;

  const dispatch = createEventDispatcher<{
    clear: void;
    focus: void;
    traceSelect: { traceId: string };
  }>();

  let filter: "recent" | "errors" | "slow" = "recent";

  $: traceList =
    node?.[
      filter === "recent"
        ? "recentTraceIds"
        : filter === "errors"
          ? "errorTraceIds"
          : "slowTraceIds"
    ] ?? [];
</script>

<div class="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-xs uppercase tracking-[0.45em] text-emerald-300">Node Inspect</p>
      {#if node}
        <h3 class="mt-1 text-lg font-semibold text-white">{node.nodeId}</h3>
      {:else}
        <p class="mt-1 text-sm text-slate-400">Select a node from the graph</p>
      {/if}
    </div>
    <div class="flex gap-2">
      <button
        class="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 transition hover:border-emerald-400"
        onclick={() => dispatch("focus")}
        disabled={!node}
      >
        Focus
      </button>
      <button
        class="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-slate-400 transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-600"
        onclick={() => dispatch("clear")}
        disabled={!node}
      >
        Clear
      </button>
    </div>
  </div>

  {#if node}
    <div class="mt-4 grid gap-3 text-sm text-slate-100">
      <div class="flex justify-between">
        <span class="text-slate-400">Inflight</span>
        <span class="font-semibold">{node.metrics.inflight}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-400">Queue</span>
        <span class="font-semibold">{node.metrics.queueLen}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-400">Throughput</span>
        <span class="font-semibold">{node.metrics.throughput.toFixed(2)} /s</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-400">Latency</span>
        <span class="font-semibold">{node.metrics.avgLatencyMs.toFixed(1)} ms</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-400">Errors</span>
        <span class="font-semibold">{(node.metrics.errorRate * 100).toFixed(1)}%</span>
      </div>
    </div>

    <div class="mt-6">
      <div class="flex gap-2">
        {#each ["recent", "errors", "slow"] as key}
          <button
            class={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
              filter === key
                ? "border-emerald-400 text-emerald-300"
                : "border-white/15 text-slate-400"
            }`}
            onclick={() => (filter = key as typeof filter)}
          >
            {key}
          </button>
        {/each}
      </div>
      <div class="mt-3 max-h-40 overflow-y-auto rounded-xl border border-white/5 bg-slate-950/40 p-3 text-xs text-slate-200">
        {#if traceList.length === 0}
          <p class="text-slate-500">No traces in this filter.</p>
        {:else}
          <ul class="space-y-1">
            {#each traceList as traceId}
              <li>
                <button
                  class="w-full truncate rounded bg-white/5 px-2 py-1 font-mono text-[11px] text-emerald-200 text-left transition hover:bg-emerald-500/20"
                  onclick={() => dispatch("traceSelect", { traceId })}
                >
                  {traceId}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>
