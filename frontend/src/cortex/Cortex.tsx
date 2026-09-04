import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useEffect, useRef } from 'react';

export interface Neuron {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'dream' | 'decision';
  position: [number, number, number];
  activation: number;
  connections: string[];
  metadata: MemoryMetadata;
}

export interface MemoryMetadata {
  title: string;
  content: string;
  timestamp: number;
  importance: number;
  type: string;
}

export interface CortexProps {
  neurons: Neuron[];
  synapses: { from: string; to: string }[];
  mode: 'awake' | 'dreaming' | 'deciding';
  onNeuronClick: (neuron: Neuron) => void;
  onNeuronHover?: (neuron: Neuron | null, x: number, y: number) => void;
}

const TYPE_COLORS: Record<Neuron['type'], [number, number, number]> = {
  episodic: [0.83, 0.66, 0.26],   // synapse gold #D4A843
  semantic: [0.0, 0.83, 1.0],     // axon blue #00D4FF
  procedural: [1.0, 0.18, 0.33],  // dopamine red #FF2D55
  dream: [0.42, 0.18, 1.0],       // melancholy purple #6B2DFF
  decision: [0.98, 0.98, 0.98],   // glial white #FAFAFA
};

const MODE_TINT: Record<CortexProps['mode'], [number, number, number]> = {
  awake: [0.83, 0.66, 0.26],
  dreaming: [0.42, 0.18, 1.0],
  deciding: [1.0, 0.18, 0.33],
};

export function Cortex({ neurons, synapses, mode, onNeuronClick, onNeuronHover }: CortexProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const neuronsRef = useRef<Neuron[]>(neurons);
  neuronsRef.current = neurons;
  const clickRef = useRef(onNeuronClick);
  clickRef.current = onNeuronClick;
  const hoverRef = useRef(onNeuronHover);
  hoverRef.current = onNeuronHover;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const synRef = useRef(synapses);
  synRef.current = synapses;

  useEffect(() => {
    const container: HTMLDivElement | null = containerRef.current;
    if (!container) return;
    const mount: HTMLDivElement = container;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.008);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 8, 52);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 15;
    controls.maxDistance = 120;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    scene.add(new THREE.AmbientLight(0x334455, 1.2));
    const gold = new THREE.DirectionalLight(0xd4a843, 1.0);
    gold.position.set(20, 20, 20);
    scene.add(gold);
    const purple = new THREE.PointLight(0x6b2dff, 60, 200);
    purple.position.set(-25, -15, 10);
    scene.add(purple);

    // --- Neurons as GPU points ---
    const MAX = Math.max(neuronsRef.current.length, 1);
    const positions = new Float32Array(MAX * 3);
    const colors = new Float32Array(MAX * 3);
    const sizes = new Float32Array(MAX);
    const activations = new Float32Array(MAX);
    const idByIndex: string[] = [];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aActivation', new THREE.BufferAttribute(activations, 1).setUsage(THREE.DynamicDrawUsage));

    const uniforms = {
      uTime: { value: 0 },
      uTint: { value: new THREE.Vector3(...MODE_TINT[modeRef.current]) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aActivation;
        varying vec3 vColor;
        varying float vActivation;
        void main() {
          vColor = aColor;
          vActivation = aActivation;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * (0.35 + aActivation) * (240.0 / -mv.z);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uTint;
        varying vec3 vColor;
        varying float vActivation;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float pulse = 0.75 + 0.25 * sin(uTime * 2.5 + vActivation * 6.2831);
          vec3 col = mix(vColor, uTint, 0.25 + 0.35 * vActivation);
          float core = smoothstep(0.5, 0.05, d);
          float glow = smoothstep(0.5, 0.0, d) * 0.6;
          float a = (core + glow) * (0.25 + 0.75 * vActivation) * pulse;
          gl_FragColor = vec4(col * (0.7 + pulse * 0.6), a);
        }
      `,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // --- Synapses ---
    const synGeo = new THREE.BufferGeometry();
    const synMat = new THREE.LineBasicMaterial({ color: 0x1e3a44, transparent: true, opacity: 0.35 });
    const synLines = new THREE.LineSegments(synGeo, synMat);
    scene.add(synLines);

    function rebuild() {
      const list = neuronsRef.current;
      const n = Math.min(list.length, MAX);
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = geo.getAttribute('aColor') as THREE.BufferAttribute;
      const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute;
      const actAttr = geo.getAttribute('aActivation') as THREE.BufferAttribute;
      idByIndex.length = 0;
      for (let i = 0; i < n; i++) {
        const nr = list[i];
        posAttr.setXYZ(i, nr.position[0], nr.position[1], nr.position[2]);
        const c = TYPE_COLORS[nr.type] ?? [1, 1, 1];
        colAttr.setXYZ(i, c[0], c[1], c[2]);
        sizeAttr.setX(i, 1.4 + (nr.metadata?.importance ?? 0.3) * 2.2);
        actAttr.setX(i, nr.activation);
        idByIndex.push(nr.id);
      }
      geo.setDrawRange(0, n);
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      actAttr.needsUpdate = true;

      // synapse lines from index map
      const idx = new Map(list.slice(0, n).map((x, i) => [x.id, i]));
      const lp: number[] = [];
      for (const s of synRef.current) {
        const a = idx.get(s.from), b = idx.get(s.to);
        if (a === undefined || b === undefined) continue;
        const pa = list[a].position, pb = list[b].position;
        lp.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
        if (lp.length > 9000) break;
      }
      synGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lp), 3));
    }

    rebuild();
    const rebuildTimer = setInterval(() => {
      // live activation shimmer without full rebuild cost
      const actAttr = geo.getAttribute('aActivation') as THREE.BufferAttribute;
      const list = neuronsRef.current;
      const n = Math.min(list.length, MAX);
      for (let i = 0; i < n; i++) actAttr.setX(i, list[i].activation);
      actAttr.needsUpdate = true;
      const tint = MODE_TINT[modeRef.current];
      (uniforms.uTint.value as THREE.Vector3).set(tint[0], tint[1], tint[2]);
    }, 250);

    // click → raycast points
    const ray = new THREE.Raycaster();
    (ray.params as any).Points = { threshold: 1.2 };
    const mouse = new THREE.Vector2();
    function onClick(ev: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObject(points)[0];
      if (hit && hit.index !== undefined) {
        const id = idByIndex[hit.index];
        const found = neuronsRef.current.find(x => x.id === id);
        if (found) clickRef.current(found);
      }
    }
    renderer.domElement.addEventListener('click', onClick);

    // hover → tooltip with the thought (throttled)
    let lastHover = 0;
    let hoveredId: string | null = null;
    function onMove(ev: MouseEvent) {
      const now = performance.now();
      if (now - lastHover < 80) return;
      lastHover = now;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObject(points)[0];
      if (hit && hit.index !== undefined) {
        const id = idByIndex[hit.index];
        if (id !== hoveredId) {
          hoveredId = id;
          const found = neuronsRef.current.find(x => x.id === id) || null;
          if (hoverRef.current) hoverRef.current(found, ev.clientX - rect.left, ev.clientY - rect.top);
        }
      } else if (hoveredId !== null) {
        hoveredId = null;
        if (hoverRef.current) hoverRef.current(null, 0, 0);
      }
    }
    renderer.domElement.addEventListener('mousemove', onMove);

    function onResize() {
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 600;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    function loop() {
      raf = requestAnimationFrame(loop);
      uniforms.uTime.value = clock.getElapsedTime();
      controls.update();
      renderer.render(scene, camera);
    }
    loop();

    // rebuild geometry when neuron list identity changes (poll cheap)
    let lastLen = -1;
    const watch = setInterval(() => {
      if (neuronsRef.current.length !== lastLen) {
        lastLen = neuronsRef.current.length;
        try { rebuild(); } catch {}
      }
    }, 1500);

    return () => {
      clearInterval(rebuildTimer);
      clearInterval(watch);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('mousemove', onMove);
      controls.dispose();
      geo.dispose();
      synGeo.dispose();
      synMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="cortex-container" style={{ width: '100%', height: '100%' }} />;
}
