<script lang="ts">
  import type { SimulationControls } from "@shared/controls";
  import type { Run } from "@shared/run";

  let {
    mode,
    run,
    visualSpeed = $bindable(),
    runControls = $bindable(),
    onStartRun,
    onStopRun,
  } = $props<{
    mode: "live" | "replay";
    run: Run | null;
    visualSpeed: number;
    runControls: SimulationControls;
    onStartRun: () => void;
    onStopRun: () => void;
  }>();

  const updateControls = (next: Partial<SimulationControls>) => {
    runControls = { ...runControls, ...next };
  };
</script>

<div class="border-b border-white/5 bg-slate-900/60 px-6 py-4">
  <div class="flex flex-wrap items-start gap-6">
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
      {#if run?.status === "running"}
        <button
          class="rounded-full bg-emerald-400 px-4 py-1 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/30 disabled:text-emerald-200"
          onclick={onStartRun}
          disabled
        >
          Runned
        </button>
      {:else}
      <button
        class="rounded-full bg-emerald-400 px-4 py-1 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/30 disabled:text-emerald-200"
        onclick={onStartRun}
        disabled={mode !== "live" || run?.status === "running"}
      >
        Start Run
      </button>
      {/if}
      <button
        class="rounded-full border border-white/20 px-4 py-1 font-semibold text-slate-100 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
        onclick={onStopRun}
        disabled={mode !== "live" || !run || run.status !== "running"}
      >
        Stop
      </button>
    </div>
  </div>

  <div class="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
    <label class="grid gap-1">
      <span class="text-[10px] uppercase tracking-[0.32em] text-slate-400">
        Rate (req/s)
      </span>
      <input
        type="number"
        min="20"
        max="200"
        step="1"
        value={runControls.requestRate}
        placeholder="20-200"
        class="rounded-lg border border-white/10 bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed"
        disabled={mode !== "live" || run?.status === "running"}
        oninput={(event) =>
          updateControls({
            requestRate: Number((event.target as HTMLInputElement).value),
          })}
      />
    </label>

    <label class="grid gap-1">
      <span class="text-[10px] uppercase tracking-[0.32em] text-slate-400">
        Complexity
      </span>
      <input
        type="number"
        min="1"
        max="5"
        step="1"
        value={runControls.payloadComplexity}
        placeholder="1-5"
        class="rounded-lg border border-white/10 bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed"
        disabled={mode !== "live" || run?.status === "running"}
        oninput={(event) =>
          updateControls({
            payloadComplexity: Number((event.target as HTMLInputElement).value),
          })}
      />
    </label>

    <label class="grid gap-1">
      <span class="text-[10px] uppercase tracking-[0.32em] text-slate-400">
        Concurrency
      </span>
      <input
        type="number"
        min="1"
        max="8"
        step="1"
        value={runControls.nodeConcurrency}
        placeholder="1-8"
        class="rounded-lg border border-white/10 bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed"
        disabled={mode !== "live" || run?.status === "running"}
        oninput={(event) =>
          updateControls({
            nodeConcurrency: Number((event.target as HTMLInputElement).value),
          })}
      />
    </label>

    <label class="grid gap-1">
      <span class="text-[10px] uppercase tracking-[0.32em] text-slate-400">
        Failure Rate (%)
      </span>
      <input
        type="number"
        min="0"
        max="20"
        step="0.5"
        value={runControls.failureRate}
        placeholder="0-20"
        class="rounded-lg border border-white/10 bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed"
        disabled={mode !== "live" || run?.status === "running"}
        oninput={(event) =>
          updateControls({
            failureRate: Number((event.target as HTMLInputElement).value),
          })}
      />
    </label>

    <label class="grid gap-1">
      <span class="text-[10px] uppercase tracking-[0.32em] text-slate-400">Seed</span>
      <input
        type="number"
        step="1"
        value={runControls.seed}
        placeholder="int"
        class="rounded-lg border border-white/10 bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed"
        disabled={mode !== "live" || run?.status === "running"}
        oninput={(event) =>
          updateControls({
            seed: Number((event.target as HTMLInputElement).value),
          })}
      />
    </label>

    <label class="grid gap-1">
      <span class="text-[10px] uppercase tracking-[0.32em] text-slate-400">
        Time Limit (sec)
      </span>
      <input
        type="number"
        min="0"
        max="3600"
        step="5"
        value={Math.round(runControls.runDurationMs / 1000)}
        placeholder="0-3600"
        class="rounded-lg border border-white/10 bg-slate-950/40 px-2.5 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed"
        disabled={mode !== "live" || run?.status === "running"}
        oninput={(event) =>
          updateControls({
            runDurationMs: Math.max(
              0,
              Math.round(Number((event.target as HTMLInputElement).value) * 1000),
            ),
          })}
      />
    </label>
  </div>
</div>
