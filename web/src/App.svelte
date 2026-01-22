<script lang="ts">
  import { onMount } from "svelte";
  import ThreeOverview from "./lib/components/ThreeOverview.svelte";
  import NodeInspectPanel from "./lib/components/NodeInspectPanel.svelte";
  import TraceViewPanel from "./lib/components/TraceViewPanel.svelte";
  import AppHeader from "./lib/components/AppHeader.svelte";
  import VisualControls from "./lib/components/VisualControls.svelte";
  import RunStatusCard from "./lib/components/RunStatusCard.svelte";
  import LiveMetricsCard from "./lib/components/LiveMetricsCard.svelte";
  import WsErrorBanner from "./lib/components/WsErrorBanner.svelte";
  import ReplayPresetCard from "./lib/components/ReplayPresetCard.svelte";
  import { createRuntimeController } from "./lib/runtime/runtimeController";

  const runtimeUrl = import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";
  const runtime = createRuntimeController(runtimeUrl);
  const {
    mode,
    status,
    visualSpeed,
    graph,
    snapshot,
    run,
    runControls,
    wsError,
    selectedNodeId,
    nodeInspect,
    activeTraceId,
    traceSpans,
    traceStatus,
    traceVisualState,
    playbackTimeMs,
    runStartMs,
    inflightTotal,
    throughputTotal,
    replayPresetId,
    replayStatus,
    replayError,
    replayBundle,
    replayTraceSamples,
    connect,
    reconnect,
    switchMode,
    startRun,
    stopRun,
    handleNodeSelect,
    clearSelection,
    selectTrace,
    closeTraceView,
    loadReplayPreset,
    start,
  } = runtime;

  onMount(() => start());
</script>

<main class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100 lg:h-screen lg:overflow-hidden flex flex-col">
  <AppHeader
    mode={$mode}
    status={$status}
    onSwitchMode={switchMode}
    onReconnect={reconnect}
  />

  <section class="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[3fr_1fr] lg:flex-1 lg:min-h-0 lg:items-stretch">
    <div class="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-emerald-500/10 flex flex-col h-full">
      <VisualControls
        mode={$mode}
        run={$run}
        bind:visualSpeed={$visualSpeed}
        bind:runControls={$runControls}
        onStartRun={startRun}
        onStopRun={stopRun}
      />
      <div class="h-[60vh] lg:flex-1 lg:min-h-0">
        <ThreeOverview
          graph={$graph}
          snapshot={$snapshot}
          visualSpeed={$visualSpeed}
          selectedNodeId={$selectedNodeId}
          trace={$traceVisualState}
          on:nodeselect={(event) => handleNodeSelect(event.detail.nodeId)}
        />
      </div>
    </div>

    <aside class="space-y-4 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-2 lg:min-h-0">
      {#if $mode === "replay"}
        <ReplayPresetCard
          replayPresetId={$replayPresetId}
          replayStatus={$replayStatus}
          replayError={$replayError}
          replayBundle={$replayBundle}
          onLoadReplay={loadReplayPreset}
        />
      {/if}

      <RunStatusCard run={$run} />

      <LiveMetricsCard
        snapshot={$snapshot}
        inflightTotal={$inflightTotal}
        throughputTotal={$throughputTotal}
      />

      <NodeInspectPanel
        node={$nodeInspect}
        on:clear={clearSelection}
        on:traceSelect={(event) => selectTrace(event.detail.traceId)}
      />

      <TraceViewPanel
        traceId={$activeTraceId}
        spans={$traceSpans}
        status={$traceStatus}
        playbackTimeMs={$playbackTimeMs}
        runStartMs={$runStartMs}
        traceSamples={$replayTraceSamples}
        mode={$mode}
        on:close={closeTraceView}
        on:sampleSelect={(event) => selectTrace(event.detail.traceId)}
      />

      <WsErrorBanner wsError={$wsError} />
    </aside>
  </section>
</main>
