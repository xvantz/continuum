<svelte:options runes={false} />

<script lang="ts">
import { createEventDispatcher, onDestroy, onMount } from "svelte";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Graph } from "@shared/graph";
import type { MetricsSnapshot, NodeMetrics, EdgeMetrics } from "@shared/metrics";

type TraceVisualState = {
  traceId: string;
  activeNodeId: string | null;
  transition: {
    from: string | null;
    to: string;
    startedAt: number;
  } | null;
};

export let graph: Graph | null = null;
export let snapshot: MetricsSnapshot | null = null;
export let visualSpeed = 1;
export let selectedNodeId: string | null = null;
export let focusNodeId: string | null = null;
export let trace: TraceVisualState | null = null;

  const dispatch = createEventDispatcher<{
    nodeSelect: { nodeId: string };
  }>();

  const POSITION_SCALE = 0.4;
  const BASE_NODE_RADIUS = 12;
  const TRACE_PARTICLE_DURATION_MS = 900;
  const HALO_SCALE = 1.7;
  const haloBaseColor = new THREE.Color(0x22d3ee);
  const haloErrorColor = new THREE.Color(0xf87171);
  const emissiveBaseColor = new THREE.Color(0x0ea5e9);
  const emissiveErrorColor = new THREE.Color(0xf87171);
  const haloColor = new THREE.Color();
  const emissiveColor = new THREE.Color();

  let container: HTMLDivElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let controls: OrbitControls | null = null;
  let animationFrame = 0;

  const nodeMeshes = new Map<
    string,
    {
      mesh: THREE.Mesh;
      halo: THREE.Mesh;
      current: NodeMetrics;
      target: NodeMetrics;
    }
  >();
  const edgeLines = new Map<
    string,
    {
      line: THREE.Line;
      current: EdgeMetrics;
      target: EdgeMetrics;
    }
  >();
  let traceParticle: THREE.Mesh | null = null;
  let traceTransitionState: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    startedAt: number;
  } | null = null;
  let traceEdgeHighlightId: string | null = null;
  let lastTransitionStamp: number | null = null;

  const defaultNodeMetrics = (): NodeMetrics => ({
    nodeId: "",
    inflight: 0,
    queueLen: 0,
    throughput: 0,
    avgLatencyMs: 0,
    errorRate: 0,
  });

  const defaultEdgeMetrics = (): EdgeMetrics => ({
    edgeId: "",
    from: "",
    to: "",
    rate: 0,
    errorRate: 0,
  });

  let previousTimestamp = 0;
  const nodePositions = new Map<string, THREE.Vector3>();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  onMount(() => {
    initScene();
    previousTimestamp = performance.now();
    animationFrame = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    cancelAnimationFrame(animationFrame);
    renderer?.dispose();
    controls?.dispose();
    nodeMeshes.forEach(({ mesh, halo }) => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      halo.geometry.dispose();
      (halo.material as THREE.Material).dispose();
    });
    edgeLines.forEach(({ line }) => line.geometry.dispose());
    if (traceParticle) {
      traceParticle.geometry.dispose();
      (traceParticle.material as THREE.Material).dispose();
    }
    window.removeEventListener("resize", handleResize);
    container?.removeEventListener("pointerdown", handlePointerDown);
    container?.removeEventListener("contextmenu", handleContextMenu);
  });

  const initScene = () => {
    if (!container) return;
    const nextScene = new THREE.Scene();
    nextScene.background = new THREE.Color("#030712");
    scene = nextScene;

    const nextCamera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000,
    );
    nextCamera.position.set(0, 200, 500);
    camera = nextCamera;

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(nextCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.04;
    controls.maxDistance = 1000;
    controls.minDistance = 80;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.NONE,
      MIDDLE: THREE.MOUSE.NONE,
      RIGHT: THREE.MOUSE.NONE,
    };
    controls.touches = {
      ONE: THREE.TOUCH.NONE,
      TWO: THREE.TOUCH.NONE,
    };

    const ambientLight = new THREE.AmbientLight(0x3f51b5, 0.6);
    nextScene.add(ambientLight);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(300, 400, 200);
    nextScene.add(directional);

    traceParticle = new THREE.Mesh(
      new THREE.SphereGeometry(4, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfde047 }),
    );
    traceParticle.visible = false;
    nextScene.add(traceParticle);

    window.addEventListener("resize", handleResize);
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("contextmenu", handleContextMenu);
  };

  const handleResize = () => {
    if (!container || !renderer || !camera) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };

  const loop = (timestamp: number) => {
    const deltaMs = timestamp - previousTimestamp;
    previousTimestamp = timestamp;
    const deltaSeconds = deltaMs / 1000;

    updateNodes(deltaSeconds);
    updateEdges(deltaSeconds);
    updateTraceTransition();

    controls?.update();
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
    animationFrame = requestAnimationFrame(loop);
  };

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (!container || !camera || !scene) return;
    const rect = container.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = Array.from(nodeMeshes.values()).map((node) => node.mesh);
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const nodeId = intersects[0].object.userData.nodeId as string;
      dispatch("nodeSelect", { nodeId });
    }
  };

  const updateNodes = (deltaSeconds: number) => {
    const smoothing = 1 - Math.exp(-deltaSeconds * visualSpeed * 3);
    const pulse = (Math.sin(performance.now() * 0.006 * visualSpeed) + 1) / 2;
    for (const visual of nodeMeshes.values()) {
      const current = visual.current;
      const target = visual.target;
      current.inflight = THREE.MathUtils.lerp(
        current.inflight,
        target.inflight,
        smoothing,
      );
      current.queueLen = THREE.MathUtils.lerp(
        current.queueLen,
        target.queueLen,
        smoothing,
      );
      current.throughput = THREE.MathUtils.lerp(
        current.throughput,
        target.throughput,
        smoothing,
      );
      current.errorRate = THREE.MathUtils.lerp(
        current.errorRate,
        target.errorRate,
        smoothing,
      );
      const mesh = visual.mesh;
      const magnitude =
        1 + current.inflight * 0.06 + current.queueLen * 0.025;
      mesh.scale.setScalar(Math.max(0.4, magnitude));

      const nodeId = visual.mesh.userData.nodeId as string;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const heat = THREE.MathUtils.clamp(current.errorRate, 0, 1);
      const load = THREE.MathUtils.clamp(
        current.inflight * 0.08 +
          current.queueLen * 0.05 +
          current.throughput * 0.03,
        0,
        2.5,
      );
      const loadPulse = pulse * load;
      const baseBlue = THREE.MathUtils.lerp(0.6, 1, current.throughput * 0.03);
      const redBoost = heat * (0.4 + pulse * 0.6);
      material.color.setRGB(
        THREE.MathUtils.clamp(0.1 + load * 0.15 + redBoost, 0, 1),
        THREE.MathUtils.clamp(0.6 + load * 0.2 - heat * 0.6, 0, 1),
        baseBlue,
      );
      emissiveColor
        .copy(emissiveBaseColor)
        .lerp(emissiveErrorColor, heat);
      material.emissive.copy(emissiveColor);
      const isSelected = selectedNodeId === nodeId;
      const isTraceActive = trace?.activeNodeId === nodeId;
      if (isSelected || isTraceActive) {
        material.color.setRGB(0.98, 0.82, 0.35);
      }
      const baseGlow = current.throughput * 0.05;
      if (isTraceActive) {
        material.emissiveIntensity = 0.5 + baseGlow + pulse * 0.8;
      } else if (isSelected) {
        material.emissiveIntensity = 0.9 + baseGlow;
      } else {
        material.emissiveIntensity = 0.2 + baseGlow + loadPulse * 0.6 + heat * 0.6;
      }

      const halo = visual.halo;
      const haloStrength = THREE.MathUtils.clamp(
        load * 0.35 + heat * 0.7 + pulse * 0.15,
        0,
        1,
      );
      halo.visible = haloStrength > 0.05 || isSelected || isTraceActive;
      halo.scale.setScalar(HALO_SCALE + haloStrength * 0.6);
      const haloMaterial = halo.material as THREE.MeshBasicMaterial;
      haloColor.copy(haloBaseColor).lerp(haloErrorColor, heat);
      if (isSelected || isTraceActive) {
        haloColor.set(0xfde047);
      }
      haloMaterial.color.copy(haloColor);
      haloMaterial.opacity = 0.15 + haloStrength * 0.45;
    }
  };

  const updateEdges = (deltaSeconds: number) => {
    const smoothing = 1 - Math.exp(-deltaSeconds * visualSpeed * 3);
    for (const visual of edgeLines.values()) {
      const current = visual.current;
      const target = visual.target;
      current.rate = THREE.MathUtils.lerp(current.rate, target.rate, smoothing);
      current.errorRate = THREE.MathUtils.lerp(
        current.errorRate,
        target.errorRate,
        smoothing,
      );
      const material = visual.line.material as THREE.LineDashedMaterial;
      const isTraceEdge = traceEdgeHighlightId === visual.current.edgeId;
      if (isTraceEdge) {
        material.opacity = 1;
        material.transparent = true;
        material.color = new THREE.Color(0xfde047);
        material.dashSize = 6;
        material.gapSize = 4;
      } else {
        const opacity = THREE.MathUtils.clamp(current.rate / 80, 0.1, 1);
        material.opacity = Math.max(0.2, opacity);
        material.transparent = true;
        const edgePulse = (Math.sin(performance.now() * 0.008 * visualSpeed) + 1) / 2;
        const errorPulse = current.errorRate > 0 ? edgePulse * current.errorRate : 0;
        const hue = THREE.MathUtils.lerp(0.55, 0.02, current.errorRate);
        const color = new THREE.Color().setHSL(
          hue,
          0.9,
          THREE.MathUtils.clamp(0.45 + current.rate * 0.004, 0.3, 0.7),
        );
        color.r = THREE.MathUtils.clamp(color.r + errorPulse * 0.6, 0, 1);
        color.g = THREE.MathUtils.clamp(color.g - errorPulse * 0.5, 0, 1);
        color.b = THREE.MathUtils.clamp(color.b - errorPulse * 0.3, 0, 1);
        material.color = color;
        material.dashSize = 8;
        material.gapSize = 6;
        material.dashOffset -=
          (current.rate * 0.08 + 0.6) * deltaSeconds * visualSpeed;
      }
    }
  };

  const updateTraceTransition = () => {
    if (!traceParticle || !traceTransitionState) return;
    const elapsed = performance.now() - traceTransitionState.startedAt;
    const progress = Math.min(
      1,
      (elapsed * visualSpeed) / TRACE_PARTICLE_DURATION_MS,
    );
    traceParticle.position.lerpVectors(
      traceTransitionState.from,
      traceTransitionState.to,
      progress,
    );
    traceParticle.visible = true;
    if (progress >= 1) {
      traceTransitionState = null;
      traceParticle.visible = false;
      traceEdgeHighlightId = null;
    }
  };

  const triggerTraceTransition = (
    transition: TraceVisualState["transition"],
  ) => {
    if (!transition || !traceParticle) {
      traceTransitionState = null;
      if (traceParticle) {
        traceParticle.visible = false;
      }
      traceEdgeHighlightId = null;
      return;
    }
    if (lastTransitionStamp === transition.startedAt) return;
    lastTransitionStamp = transition.startedAt;
    const toPosition = nodePositions.get(transition.to);
    if (!toPosition) {
      traceTransitionState = null;
      traceParticle.visible = false;
      traceEdgeHighlightId = null;
      return;
    }
    const fromNode = transition.from
      ? nodePositions.get(transition.from)
      : null;
    const fromPosition = (fromNode ?? toPosition).clone();
    traceTransitionState = {
      from: fromPosition,
      to: toPosition.clone(),
      startedAt: transition.startedAt,
    };
    traceParticle.position.copy(fromPosition);
    traceParticle.visible = true;
    if (transition.from) {
      const edge = graph?.edges.find(
        (edgeDef) =>
          edgeDef.from === transition.from && edgeDef.to === transition.to,
      );
      traceEdgeHighlightId = edge?.edgeId ?? null;
    } else {
      traceEdgeHighlightId = null;
    }
  };

  const resetSceneObjects = () => {
    const activeScene = scene;
    if (!activeScene) return;
    nodeMeshes.forEach(({ mesh, halo }) => {
      activeScene.remove(mesh);
      activeScene.remove(halo);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      halo.geometry.dispose();
      (halo.material as THREE.Material).dispose();
    });
    nodeMeshes.clear();

    edgeLines.forEach(({ line }) => {
      activeScene.remove(line);
    });
    edgeLines.clear();
  };

  const buildGraph = () => {
    if (!graph || !scene) return;
    const activeScene = scene;
    if (!activeScene) return;
    resetSceneObjects();
    traceTransitionState = null;
    traceEdgeHighlightId = null;
    lastTransitionStamp = null;
    if (traceParticle) {
      traceParticle.visible = false;
    }

    const defaultSpacing = 140;
    const layoutPositions = graph.nodes.map((node, index) => {
      const layout = graph.layout?.nodes?.[node.nodeId];
      return (
        layout ?? {
          x: index * defaultSpacing,
          y: 0,
          z: 0,
        }
      );
    });
    const minX = Math.min(...layoutPositions.map((position) => position.x));
    const maxX = Math.max(...layoutPositions.map((position) => position.x));
    const yOffset = (maxX - minX) * 0.5;
    nodePositions.clear();
    graph.nodes.forEach((node, index) => {
      const geometry = new THREE.SphereGeometry(BASE_NODE_RADIUS, 32, 32);
      const material = new THREE.MeshStandardMaterial({
        color: 0x5de4ff,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.4,
        metalness: 0.1,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const haloGeometry = new THREE.SphereGeometry(
        BASE_NODE_RADIUS * HALO_SCALE,
        24,
        24,
      );
      const haloMaterial = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      const position = layoutPositions[index];
      const orientedPosition = {
        x: position.y,
        y: -(position.x - minX) + yOffset,
        z: position.z,
      };
      mesh.position.set(
        orientedPosition.x * POSITION_SCALE,
        orientedPosition.y * POSITION_SCALE,
        orientedPosition.z * POSITION_SCALE,
      );
      halo.position.copy(mesh.position);
      nodePositions.set(node.nodeId, mesh.position.clone());
      nodeMeshes.set(node.nodeId, {
        mesh,
        halo,
        current: { ...defaultNodeMetrics(), nodeId: node.nodeId },
        target: { ...defaultNodeMetrics(), nodeId: node.nodeId },
      });
      mesh.userData.nodeId = node.nodeId;
      activeScene.add(halo);
      activeScene.add(mesh);
    });

    graph.edges.forEach((edge) => {
      const fromNode = nodeMeshes.get(edge.from);
      const toNode = nodeMeshes.get(edge.to);
      if (!fromNode || !toNode) return;
      const points = [fromNode.mesh.position, toNode.mesh.position];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({
        color: 0x5eead4,
        transparent: true,
        opacity: 0.4,
        dashSize: 8,
        gapSize: 6,
      });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      edgeLines.set(edge.edgeId, {
        line,
        current: { ...defaultEdgeMetrics(), edgeId: edge.edgeId },
        target: { ...defaultEdgeMetrics(), edgeId: edge.edgeId },
      });
      activeScene.add(line);
    });

    if (camera && controls && nodePositions.size > 0) {
      const bounds = new THREE.Box3().setFromPoints(
        Array.from(nodePositions.values()),
      );
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const fov = (camera.fov * Math.PI) / 180;
      const distance = maxDim / (2 * Math.tan(fov / 2));
      const offset = new THREE.Vector3(0, maxDim * 0.2, distance + 200);
      camera.position.copy(center.clone().add(offset));
      controls.target.copy(center);
      controls.update();
    }
  };

  const applySnapshot = () => {
    if (!snapshot) return;
    snapshot.nodes.forEach((nodeMetrics) => {
      const visual = nodeMeshes.get(nodeMetrics.nodeId);
      if (!visual) return;
      visual.target = nodeMetrics;
    });
    snapshot.edges.forEach((edgeMetrics) => {
      const visual = edgeLines.get(edgeMetrics.edgeId);
      if (!visual) return;
      visual.target = edgeMetrics;
    });
  };

  const focusOnNode = (nodeId: string) => {
    if (!controls || !camera) return;
    const position = nodePositions.get(nodeId);
    if (!position) return;
    controls.target.copy(position);
    const offset = new THREE.Vector3(
      position.x + 60,
      position.y + 60,
      position.z + 120,
    );
    camera.position.copy(offset);
    camera.lookAt(position);
    controls.update();
  };

  $: if (trace?.transition) {
    triggerTraceTransition(trace.transition);
  }
  $: if (!trace) {
    traceTransitionState = null;
    traceEdgeHighlightId = null;
    lastTransitionStamp = null;
    if (traceParticle) {
      traceParticle.visible = false;
    }
  }

  $: if (graph && scene) {
    buildGraph();
  }
  $: if (snapshot) {
    applySnapshot();
  }
  $: if (focusNodeId) {
    focusOnNode(focusNodeId);
  }
</script>

<div class="relative h-full w-full" bind:this={container}>
  {#if !graph}
    <div class="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-center text-sm text-slate-200">
      Waiting for graph definition…
    </div>
  {/if}
</div>

<style>
  :global(canvas) {
    display: block;
  }
</style>
