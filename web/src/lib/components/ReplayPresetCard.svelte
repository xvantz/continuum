<script lang="ts">
  import type { ReplayBundle } from "@shared/replay";

  let {
    replayPresetId,
    replayStatus,
    replayError,
    replayBundle,
    onLoadReplay,
  } = $props<{
    replayPresetId: "easy" | "mid" | "hard";
    replayStatus: "idle" | "loading" | "ready" | "error";
    replayError: string | null;
    replayBundle: ReplayBundle | null;
    onLoadReplay: (presetId: "easy" | "mid" | "hard") => void;
  }>();

  const presets = [
    { id: "easy", label: "Easy" },
    { id: "mid", label: "Mid" },
    { id: "hard", label: "Hard" },
  ];
</script>

<div class="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
  <div class="flex items-center justify-between">
    <p class="text-xs uppercase tracking-[0.35em] text-emerald-300">
      Replay Preset
    </p>
  </div>
  <div class="mt-3 flex flex-wrap gap-2">
    {#each presets as preset}
      <button
        class="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-indigo-300 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
        class:border-indigo-300={replayPresetId === preset.id}
        class:text-indigo-200={replayPresetId === preset.id}
        onclick={() => onLoadReplay(preset.id as "easy" | "mid" | "hard")}
        disabled={replayStatus === "loading"}
      >
        {preset.label}
      </button>
    {/each}
  </div>
  {#if replayError}
    <p class="mt-2 text-xs text-rose-300">{replayError}</p>
  {:else if replayBundle}
    <p class="mt-2 text-[11px] text-slate-400">
      {new Date(replayBundle.meta.recordedAt).toLocaleString()} ·
      {(replayBundle.meta.durationMs / 1000).toFixed(1)}s
    </p>
  {/if}
</div>
