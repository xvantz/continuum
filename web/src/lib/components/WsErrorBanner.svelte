<script lang="ts">
  const { wsError } = $props<{
    wsError: { code: string; message: string } | null;
  }>();
</script>

{#if wsError}
  <div class="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-100">
    <p class="font-semibold uppercase tracking-[0.3em] text-rose-200">WebSocket Error</p>
    <p class="mt-2">{wsError.message}</p>
  </div>
{/if}
