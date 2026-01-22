<script lang="ts">
  let {
    mode,
    status,
    onSwitchMode,
    onReconnect,
  } = $props<{
    mode: "live" | "replay";
    status: "connecting" | "connected" | "disconnected" | "replay";
    onSwitchMode: (nextMode: "live" | "replay") => void;
    onReconnect: () => void;
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
        class="rounded-full border border-white/20 px-4 py-1 text-sm font-semibold text-slate-100 transition hover:border-emerald-400 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
        onclick={onReconnect}
        disabled={mode === "replay"}
      >
        Reconnect
      </button>
    </div>
  </div>
</header>
