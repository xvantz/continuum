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
    wsError,
    selectedNodeId,
    nodeInspect,
    focusNodeId,
    activeTraceId,
    traceSpans,
    traceStatus,
    traceVisualState,
    playbackTimeMs,
    runStartMs,
    inflightTotal,
    throughputTotal,
    replaySource,
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
    loadReplay,
    focusInspectNode,
    start,
  } = runtime;

  onMount(() => start());
</script>

<main class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
  <AppHeader
    mode={$mode}
    status={$status}
    bind:replaySource={$replaySource}
    replayStatus={$replayStatus}
    replayError={$replayError}
    replayBundle={$replayBundle}
    onSwitchMode={switchMode}
    onReconnect={reconnect}
    onLoadReplay={loadReplay}
  />

  <section class="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[3fr_1fr]">
    <div class="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-emerald-500/10">
      <VisualControls
        mode={$mode}
        run={$run}
        bind:visualSpeed={$visualSpeed}
        onStartRun={startRun}
        onStopRun={stopRun}
      />
      <div class="h-[70vh]">
        <ThreeOverview
          graph={$graph}
          snapshot={$snapshot}
          visualSpeed={$visualSpeed}
          selectedNodeId={$selectedNodeId}
          focusNodeId={$focusNodeId}
          trace={$traceVisualState}
          on:nodeselect={(event) => handleNodeSelect(event.detail.nodeId)}
        />
      </div>
    </div>

    <aside class="space-y-4">
      <RunStatusCard run={$run} />

      <LiveMetricsCard
        snapshot={$snapshot}
        inflightTotal={$inflightTotal}
        throughputTotal={$throughputTotal}
      />

      <NodeInspectPanel
        node={$nodeInspect}
        on:focus={focusInspectNode}
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
