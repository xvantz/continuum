<script lang="ts">
  import type { MetricsSnapshot } from "@shared/metrics";

  const { snapshot, inflightTotal, throughputTotal } = $props<{
    snapshot: MetricsSnapshot | null;
    inflightTotal: number;
    throughputTotal: number;
  }>();
</script>

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
      {#if snapshot.endToEndLatency && snapshot.endToEndLatency.sampleCount > 0}
        <div class="flex items-center justify-between">
          <dt class="text-slate-400">E2E p50</dt>
          <dd class="font-semibold text-white">
            {snapshot.endToEndLatency.p50Ms.toFixed(1)} ms
          </dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="text-slate-400">E2E p95</dt>
          <dd class="font-semibold text-white">
            {snapshot.endToEndLatency.p95Ms.toFixed(1)} ms
          </dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="text-slate-400">E2E p99</dt>
          <dd class="font-semibold text-white">
            {snapshot.endToEndLatency.p99Ms.toFixed(1)} ms
          </dd>
        </div>
      {/if}
      <div class="flex items-center justify-between">
        <dt class="text-slate-400">Snapshot #</dt>
        <dd class="font-semibold text-white">{snapshot.seq}</dd>
      </div>
    </dl>
  {:else}
    <p class="mt-4 text-sm text-slate-400">Waiting for metrics snapshot…</p>
  {/if}
</div>
