<script lang="ts">
  import type { ReplayBundle } from "@shared/replay";

  let {
    mode,
    status,
    replaySource = $bindable(),
    replayStatus,
    replayError,
    replayBundle,
    onSwitchMode,
    onReconnect,
    onLoadReplay,
  } = $props<{
    mode: "live" | "replay";
    status: "connecting" | "connected" | "disconnected" | "replay";
    replaySource: string;
    replayStatus: "idle" | "loading" | "ready" | "error";
    replayError: string | null;
    replayBundle: ReplayBundle | null;
    onSwitchMode: (nextMode: "live" | "replay") => void;
    onReconnect: () => void;
    onLoadReplay: () => void;
  }>();
</script>

<header class="border-b border-white/5 bg-slate-950/80 backdrop-blur">
  <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
    <div>
      <p class="text-xs uppercase tracking-[0.35em] text-emerald-300">Continuum</p>
      <h1 class="text-xl font-semibold text-white">Runtime Overview</h1>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-xs uppercase tracking-[0.3em] text-slate-300">
        <button
          class="rounded-full px-3 py-1 transition"
          class:bg-emerald-400={mode === "live"}
          class:text-slate-900={mode === "live"}
          class:text-slate-100={mode !== "live"}
          onclick={() => onSwitchMode("live")}
        >
          Live
        </button>
        <button
          class="rounded-full px-3 py-1 transition"
          class:bg-indigo-400={mode === "replay"}
          class:text-slate-900={mode === "replay"}
          class:text-slate-100={mode !== "replay"}
          onclick={() => onSwitchMode("replay")}
        >
          Replay
        </button>
      </div>
      <span class="flex items-center gap-2 text-sm text-slate-300">
        <span
          class="inline-flex h-2.5 w-2.5 rounded-full"
          class:bg-emerald-400={status === "connected"}
          class:bg-amber-300={status === "connecting"}
          class:bg-rose-400={status === "disconnected"}
          class:bg-indigo-400={status === "replay"}
        ></span>
        {#if status === "replay"}
          replay
        {:else}
          {status}
        {/if}
      </span>
      <button
        class="rounded-full border border-white/20 px-4 py-1 text-sm font-semibold text-slate-100 transition hover:border-emerald-400 hover:text-white"
        onclick={onReconnect}
        disabled={mode === "replay"}
      >
        Reconnect
      </button>
    </div>
  </div>
  {#if mode === "replay"}
    <div class="mx-auto mt-3 w-full max-w-6xl px-6">
      <div class="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <div class="flex flex-wrap items-center gap-3">
          <label class="text-xs uppercase tracking-[0.3em] text-emerald-300" for="replay-source">
            Replay Source
          </label>
          <input
            type="text"
            class="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            id="replay-source"
            bind:value={replaySource}
            placeholder="demos/latest.json"
          />
          <button
            class="rounded-full bg-indigo-400 px-4 py-1 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:bg-indigo-400/30 disabled:text-indigo-200"
            onclick={onLoadReplay}
            disabled={replayStatus === "loading"}
          >
            {replayStatus === "loading" ? "Loading…" : "Load Replay"}
          </button>
        </div>
        {#if replayError}
          <p class="mt-2 text-sm text-rose-300">{replayError}</p>
        {:else if replayBundle}
          <p class="mt-2 text-xs text-slate-400">
            Recorded {new Date(replayBundle.meta.recordedAt).toLocaleString()} —
            {(replayBundle.meta.durationMs / 1000).toFixed(1)}s
          </p>
        {/if}
      </div>
    </div>
  {/if}
</header>
