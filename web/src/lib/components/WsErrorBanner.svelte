<script lang="ts">
  const { wsError } = $props<{
    wsError: { code: string; message: string; details?: unknown } | null;
  }>();

  let dismissed = $state(false);
  let activeErrorId = "";
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const nextId = wsError ? `${wsError.code}:${wsError.message}` : "";
    if (nextId !== activeErrorId) {
      activeErrorId = nextId;
      dismissed = false;
    }
    if (dismissTimer) {
      clearTimeout(dismissTimer);
    }
    if (wsError) {
      dismissTimer = setTimeout(() => {
        dismissed = true;
      }, 2400);
    }
    return () => {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    };
  });
</script>

{#if wsError && !dismissed}
  <div
    class="toast fixed bottom-6 right-6 z-50 w-[22rem] max-w-[calc(100vw-3rem)] rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-slate-900/70 p-4 text-sm text-rose-100 shadow-2xl shadow-rose-500/20 backdrop-blur"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.35em] text-rose-200">
          Websocket Alert
        </p>
        <p class="mt-2 text-xs text-rose-200/80">{wsError.code}</p>
        <p class="mt-1 text-sm text-rose-50">{wsError.message}</p>
      </div>
      <button
        class="rounded-full border border-rose-200/30 px-2 py-1 text-[11px] uppercase tracking-wide text-rose-100 transition hover:border-rose-200/70 hover:text-white"
        onclick={() => (dismissed = true)}
      >
        Close
      </button>
    </div>
  </div>
{/if}

<style>
  .toast {
    animation: toast-in 180ms ease-out;
  }

  @keyframes toast-in {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
