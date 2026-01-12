<svelte:options runes={false} />

<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import type { Graph } from "@shared/graph";
  import type { MetricsSnapshot, NodeMetrics, EdgeMetrics } from "@shared/metrics";

  export let graph: Graph | null = null;
  export let snapshot: MetricsSnapshot | null = null;
  export let visualSpeed = 1;

  const POSITION_SCALE = 0.4;
  const BASE_NODE_RADIUS = 12;

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

  onMount(() => {
    initScene();
    previousTimestamp = performance.now();
    animationFrame = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    cancelAnimationFrame(animationFrame);
    renderer?.dispose();
    controls?.dispose();
    nodeMeshes.forEach(({ mesh }) => mesh.geometry.dispose());
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

    const ambientLight = new THREE.AmbientLight(0x3f51b5, 0.6);
    nextScene.add(ambientLight);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(300, 400, 200);
    nextScene.add(directional);

    window.addEventListener("resize", handleResize);
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

    controls?.update();
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
    animationFrame = requestAnimationFrame(loop);
  };

  const updateNodes = (deltaSeconds: number) => {
    const smoothing = 1 - Math.exp(-deltaSeconds * visualSpeed * 3);
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

      const material = mesh.material as THREE.MeshStandardMaterial;
      const heat = THREE.MathUtils.clamp(current.errorRate, 0, 1);
      material.color.setRGB(
        THREE.MathUtils.lerp(0.2, 1, heat),
        THREE.MathUtils.lerp(0.8, 0.2, heat),
        1,
      );
      material.emissiveIntensity = 0.4 + current.throughput * 0.05;
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
      const material = visual.line.material as THREE.LineBasicMaterial;
      const opacity = THREE.MathUtils.clamp(current.rate / 80, 0.1, 1);
      material.opacity = Math.max(0.2, opacity);
      material.transparent = true;
      const hue = THREE.MathUtils.lerp(0.55, 0.02, current.errorRate);
      const color = new THREE.Color().setHSL(hue, 0.9, 0.5);
      material.color = color;
    }
  };

  const resetSceneObjects = () => {
    const activeScene = scene;
    if (!activeScene) return;
    nodeMeshes.forEach(({ mesh }) => {
      activeScene.remove(mesh);
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

    const defaultSpacing = 180;
    graph.nodes.forEach((node, index) => {
      const geometry = new THREE.SphereGeometry(BASE_NODE_RADIUS, 32, 32);
      const material = new THREE.MeshStandardMaterial({
        color: 0x5de4ff,
        emissive: 0x0f172a,
        emissiveIntensity: 0.4,
        metalness: 0.1,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const layout = graph.layout?.nodes?.[node.nodeId];
      const position = layout ?? {
        x: index * defaultSpacing,
        y: 0,
        z: 0,
      };
      mesh.position.set(
        position.x * POSITION_SCALE,
        position.y * POSITION_SCALE,
        position.z * POSITION_SCALE,
      );
      nodeMeshes.set(node.nodeId, {
        mesh,
        current: { ...defaultNodeMetrics(), nodeId: node.nodeId },
        target: { ...defaultNodeMetrics(), nodeId: node.nodeId },
      });
      activeScene.add(mesh);
    });

    graph.edges.forEach((edge) => {
      const fromNode = nodeMeshes.get(edge.from);
      const toNode = nodeMeshes.get(edge.to);
      if (!fromNode || !toNode) return;
      const points = [fromNode.mesh.position, toNode.mesh.position];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x5eead4,
        transparent: true,
        opacity: 0.4,
      });
      const line = new THREE.Line(geometry, material);
      edgeLines.set(edge.edgeId, {
        line,
        current: { ...defaultEdgeMetrics(), edgeId: edge.edgeId },
        target: { ...defaultEdgeMetrics(), edgeId: edge.edgeId },
      });
      activeScene.add(line);
    });
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

  $: if (graph && scene) {
    buildGraph();
  }
  $: if (snapshot) {
    applySnapshot();
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
