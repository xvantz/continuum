<script lang="ts">
  import type { Run } from "@shared/run";

  const { run } = $props<{ run: Run | null }>();
</script>

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
      <p>
        <span class="text-slate-400">Time Limit:</span>
        {run.config.runDurationMs > 0
          ? `${Math.round(run.config.runDurationMs / 1000)}s`
          : "Unlimited"}
      </p>
    </div>
  {:else}
    <p class="mt-4 text-sm text-slate-400">Waiting for runtime state…</p>
  {/if}
</div>
