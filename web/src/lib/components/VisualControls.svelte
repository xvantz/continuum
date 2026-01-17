<script lang="ts">
  import type { Run } from "@shared/run";

  let {
    mode,
    run,
    visualSpeed = $bindable(),
    onStartRun,
    onStopRun,
  } = $props<{
    mode: "live" | "replay";
    run: Run | null;
    visualSpeed: number;
    onStartRun: () => void;
    onStopRun: () => void;
  }>();
</script>

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
        onclick={onStartRun}
        disabled={mode !== "live" || run?.status === "running"}
      >
        Start Run
      </button>
      <button
        class="rounded-full border border-white/20 px-4 py-1 font-semibold text-slate-100 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
        onclick={onStopRun}
        disabled={mode !== "live" || !run || run.status !== "running"}
      >
        Stop
      </button>
    </div>
  </div>
</div>
