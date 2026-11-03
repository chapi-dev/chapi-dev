import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { missions } from './missions.js';
import { easeFlight } from './navigation.js';

const vertexShader = `
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vLocal = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const surfaceShader = `
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform vec3 uAccent;
  uniform float uKind;
  uniform float uSeed;
  uniform float uTime;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vWorld;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(uSeed * 0.013));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float terrain(vec3 p) {
    float result = 0.0;
    float strength = 0.54;
    for (int i = 0; i < 4; i++) {
      result += strength * noise(p);
      p = p * 2.13 + vec3(5.2, 1.3, 7.1);
      strength *= 0.47;
    }
    return result;
  }
  void main() {
    vec3 p = normalize(vLocal);
    float coarse = terrain(p * 5.0 + uSeed);
    float detail = noise(p * 74.0);
    vec3 colour = mix(uLow, uMid, smoothstep(0.23, 0.7, coarse));
    float emission = 0.0;
    float roughness = 0.8;
    if (uKind < 0.5) {
      float fissure = 1.0 - smoothstep(0.014, 0.055, abs(terrain(p * 12.0) - 0.46));
      fissure *= smoothstep(0.32, 0.63, coarse);
      colour *= 0.65 + detail * 0.5;
      colour = mix(colour, uHigh, fissure);
      emission = fissure * 0.9;
    } else if (uKind < 1.5) {
      float flow = p.y * 30.0 + coarse * 7.0 + sin(p.x * 8.0) * 0.45;
      float bands = sin(flow) * 0.5 + 0.5;
      colour = mix(uLow, uMid, smoothstep(0.15, 0.8, bands));
      colour = mix(colour, uHigh, pow(bands, 7.0) * 0.65);
      roughness = 0.35;
    } else if (uKind < 2.5) {
      float wave = sin((p.x + p.z) * 23.0 + coarse * 12.0) * sin(p.y * 25.0 - coarse * 9.0);
      float contour = pow(1.0 - abs(wave), 12.0);
      colour = mix(uLow, uHigh, coarse * 0.75 + 0.1);
      colour = mix(colour, uAccent, contour * 0.75);
      emission = contour * 0.12;
      roughness = 0.15;
    } else if (uKind < 3.5) {
      float pits = pow(1.0 - noise(p * 28.0), 5.0);
      colour = mix(uLow, uHigh, coarse);
      colour *= 0.68 + detail * 0.32 - pits * 0.4;
      roughness = 0.95;
    } else if (uKind < 4.5) {
      float terraces = floor(coarse * 13.0) / 13.0;
      float edges = pow(abs(sin(coarse * 52.0)), 15.0);
      colour = mix(uLow, uMid, terraces);
      colour = mix(colour, uHigh, edges * 0.4 + detail * 0.12);
      roughness = 0.7;
    } else {
      float storm = sin(p.y * 40.0 + coarse * 15.0 + uTime * 0.03) * 0.5 + 0.5;
      colour = mix(uLow, uMid, storm);
      colour = mix(colour, uHigh, pow(storm, 9.0) * 0.45);
      roughness = 0.3;
    }
    vec3 n = normalize(vNormal);
    vec3 light = normalize(vec3(-0.75, 0.4, 1.0));
    vec3 view = normalize(cameraPosition - vWorld);
    float diffuse = max(dot(n, light), 0.0);
    float specular = pow(max(dot(reflect(-light, n), view), 0.0), mix(55.0, 9.0, roughness));
    float rim = pow(1.0 - max(dot(n, view), 0.0), 3.0);
    colour = colour * (0.055 + diffuse * 1.08) + uHigh * specular * (1.0 - roughness) * 0.28;
    colour += uHigh * emission * 0.55 + uAccent * rim * 0.11;
    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const atmosphereShader = `
  uniform vec3 uColour;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 view = normalize(cameraPosition - vWorld);
    float edge = pow(1.0 - abs(dot(normalize(vNormal), view)), 3.7);
    gl_FragColor = vec4(uColour, edge * 0.2);
    #include <colorspace_fragment>
  }
`;

function randomGenerator(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function themePalette() {
  const styles = getComputedStyle(document.documentElement);
  const colour = name => new THREE.Color(styles.getPropertyValue(name).trim());
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    night: colour(dark ? '--cp-surface' : '--cp-text').multiplyScalar(0.16),
    light: colour(dark ? '--cp-text' : '--cp-surface'),
    grey: colour('--cp-border-strong'),
    accent: colour('--cp-accent'),
    warm: colour('--cp-warning'),
    cool: colour('--cp-link'),
    muted: colour('--cp-text-muted'),
  };
}

function surfaceColours(kind, palette) {
  const { night, grey, light, accent, warm, cool } = palette;
  const low = night.clone().lerp(grey, 0.12);
  if (kind === 0) return [low, grey.clone().multiplyScalar(0.32), accent.clone().lerp(warm, 0.3)];
  if (kind === 1) return [cool.clone().multiplyScalar(0.15), cool.clone().lerp(grey, 0.55), light.clone().lerp(cool, 0.22)];
  if (kind === 2) return [grey.clone().multiplyScalar(0.25), grey.clone(), light.clone()];
  if (kind === 3) return [low, warm.clone().lerp(grey, 0.6), warm.clone().lerp(light, 0.25).multiplyScalar(0.7)];
  if (kind === 4) return [warm.clone().lerp(night, 0.7), warm.clone().lerp(grey, 0.55), light.clone().lerp(warm, 0.35)];
  return [accent.clone().lerp(night, 0.8), accent.clone().lerp(grey, 0.65), light.clone().lerp(accent, 0.35)];
}

export function createUniverse(host, { initial, onSelect, onLost }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D flight view. Drag to orbit, scroll to approach, or use W A S D to move.');
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 12000);
  scene.add(camera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 16;
  controls.maxDistance = 300;
  let palette = themePalette();
  let index = initial;
  let chart = false;
  let jumping = false;
  let dirty = true;
  let animationTime = 0;
  let fromCamera = new THREE.Vector3();
  let fromTarget = new THREE.Vector3();
  let toCamera = new THREE.Vector3();
  let toTarget = new THREE.Vector3();
  const keys = new Set();
  const random = randomGenerator(93417);
  const roots = [];
  const bodies = [];
  const moons = [];
  const rings = [];
  const vehicles = [];
  const vehicleMetal = new THREE.MeshStandardMaterial({ color: palette.grey, metalness: 0.75, roughness: 0.32 });
  const vehiclePanel = new THREE.MeshStandardMaterial({ color: palette.cool.clone().lerp(palette.night, 0.75), metalness: 0.35, roughness: 0.5 });
  const geometry = new THREE.SphereGeometry(1, 80, 56);
  const markerHost = document.getElementById('map-markers');
  const markers = missions.map((mission, missionIndex) => {
    const marker = document.createElement('button');
    marker.className = 'map-marker';
    marker.textContent = `${String(missionIndex + 1).padStart(2, '0')} / ${mission.name.toUpperCase()}`;
    marker.setAttribute('aria-label', `Jump to ${mission.name}`);
    marker.addEventListener('click', () => onSelect(missionIndex));
    markerHost.append(marker);
    return marker;
  });

  missions.forEach((mission, missionIndex) => {
    const root = new THREE.Group();
    root.position.fromArray(mission.position);
    const colours = surfaceColours(mission.kind, palette);
    const uniforms = {
      uLow: { value: colours[0] },
      uMid: { value: colours[1] },
      uHigh: { value: colours[2] },
      uAccent: { value: palette.accent.clone() },
      uKind: { value: mission.kind },
      uSeed: { value: 3.7 + missionIndex * 1.9 },
      uTime: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader: surfaceShader, uniforms });
    const body = new THREE.Mesh(geometry, material);
    body.scale.setScalar(mission.radius);
    body.rotation.z = missionIndex * 0.13;
    body.userData.index = missionIndex;
    root.add(body);
    const atmosphere = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: atmosphereShader,
      uniforms: { uColour: { value: palette.accent.clone().lerp(palette.light, 0.35) } },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    atmosphere.scale.setScalar(mission.radius * 1.045);
    root.add(atmosphere);
    if (missionIndex === 1 || missionIndex === 5) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(mission.radius * 1.35, mission.radius * 2.15, 128, 5),
        new THREE.MeshBasicMaterial({ color: palette.grey, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, wireframe: true }),
      );
      ring.rotation.x = Math.PI / 2.6;
      ring.rotation.y = 0.25;
      root.add(ring);
      rings.push(ring);
    }
    const moonCount = missionIndex === 2 ? 2 : 1;
    for (let moonIndex = 0; moonIndex < moonCount; moonIndex++) {
      const moon = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: palette.grey, roughness: 0.98 }));
      moon.scale.setScalar(mission.radius * (missionIndex === 2 ? 0.12 : 0.08));
      root.add(moon);
      moons.push({ mesh: moon, radius: mission.radius * 2.05, phase: moonIndex * Math.PI + missionIndex, speed: 0.05 + missionIndex * 0.006 });
    }
    if ([0, 3, 5].includes(missionIndex)) {
      const craft = new THREE.Group();
      craft.scale.setScalar(mission.radius * 0.055);
      craft.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.1), vehicleMetal));
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.08), vehicleMetal);
        arm.position.x = side * 1.5;
        craft.add(arm);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 0.08), vehiclePanel);
        panel.position.x = side * 2.3;
        craft.add(panel);
        for (let line = 0; line < 4; line++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.3, 0.1), vehicleMetal);
          rib.position.set(side * (1.3 + line * 0.65), 0, 0.02);
          craft.add(rib);
        }
      }
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2, 6), vehicleMetal);
      antenna.position.y = 1.6;
      craft.add(antenna);
      if (missionIndex === 5) craft.add(new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.08, 8, 48), vehicleMetal));
      root.add(craft);
      vehicles.push({ mesh: craft, radius: mission.radius * 1.75, phase: 2.5 + missionIndex * 0.7, speed: 0.045 });
    }
    scene.add(root);
    roots.push(root);
    bodies.push({ body, atmosphere });
  });
  const ambient = new THREE.HemisphereLight(palette.light, palette.night, 1.5);
  scene.add(ambient);
  const light = new THREE.DirectionalLight(palette.light, 2);
  light.position.set(-80, 60, 100);
  scene.add(light);

  const stars = new Float32Array(6500 * 3);
  for (let i = 0; i < stars.length; i += 3) {
    stars[i] = (random() - 0.5) * 6200;
    stars[i + 1] = (random() - 0.5) * 4200;
    stars[i + 2] = (random() - 0.5) * 6200 - 450;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  const starMaterial = new THREE.PointsMaterial({ color: palette.light, size: 2, sizeAttenuation: true, transparent: true, opacity: 0.8 });
  scene.add(new THREE.Points(starGeometry, starMaterial));

  const streakCount = 360;
  const streakData = Array.from({ length: streakCount }, () => ({
    x: (random() - 0.5) * 650,
    y: (random() - 0.5) * 420,
    z: random() * 900,
  }));
  const streaks = new Float32Array(streakCount * 6);
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streaks, 3).setUsage(THREE.DynamicDrawUsage));
  const streakMaterial = new THREE.LineBasicMaterial({ color: palette.light, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending });
  const warp = new THREE.LineSegments(streakGeometry, streakMaterial);
  warp.frustumCulled = false;
  camera.add(warp);

  function arrival(missionIndex) {
    const mission = missions[missionIndex];
    const narrow = host.clientWidth < 600;
    const ringed = missionIndex === 1 || missionIndex === 5;
    const distance = mission.radius * (ringed ? (narrow ? 5.9 : 5) : (narrow ? 4.4 : 3.85));
    const target = new THREE.Vector3().fromArray(mission.position);
    return { position: target.clone().add(new THREE.Vector3(distance * 0.14, distance * 0.055, distance)), target };
  }

  function arrive(missionIndex) {
    index = missionIndex;
    chart = false;
    jumping = false;
    const next = arrival(index);
    camera.position.copy(next.position);
    controls.target.copy(next.target);
    controls.minDistance = missions[index].radius * 1.35;
    controls.maxDistance = missions[index].radius * 12;
    controls.enabled = true;
    controls.update();
    streakMaterial.opacity = 0;
    markerHost.hidden = true;
    dirty = true;
  }

  function beginJump(missionIndex) {
    chart = false;
    jumping = true;
    index = missionIndex;
    fromCamera.copy(camera.position);
    fromTarget.copy(controls.target);
    const next = arrival(index);
    toCamera.copy(next.position);
    toTarget.copy(next.target);
    controls.enabled = false;
    markerHost.hidden = true;
    keys.clear();
    dirty = true;
  }

  function showChart() {
    jumping = false;
    chart = true;
    streakMaterial.opacity = 0;
    const narrow = host.clientWidth < 600;
    camera.position.set(0, narrow ? 1900 : 820, narrow ? 2400 : 1060);
    controls.target.set(0, 0, -580);
    controls.minDistance = 450;
    controls.maxDistance = 4000;
    controls.enabled = true;
    controls.update();
    markerHost.hidden = false;
    dirty = true;
  }

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (chart) showChart();
    else if (!jumping) arrive(index);
    dirty = true;
  }

  function positionMarkers() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    camera.updateMatrixWorld();
    const entries = roots.map((root, missionIndex) => {
      const point = root.position.clone().project(camera);
      const marker = markers[missionIndex];
      marker.hidden = point.z > 1 || Math.abs(point.x) > 0.96 || Math.abs(point.y) > 0.9;
      const x = (point.x + 1) / 2 * width;
      const y = (-point.y + 1) / 2 * height;
      return { marker, anchorX: x, anchorY: y, x, y };
    }).filter(entry => !entry.marker.hidden);
    const crowded = width < 700 || entries.some((entry, entryIndex) =>
      entries.slice(entryIndex + 1).some(other => Math.abs(entry.x - other.x) < 136 && Math.abs(entry.y - other.y) < 52),
    );
    if (crowded) {
      entries.sort((a, b) => a.x - b.x);
      const split = Math.ceil(entries.length / 2);
      for (const [column, group] of [entries.slice(0, split), entries.slice(split)].entries()) {
        group.sort((a, b) => a.y - b.y);
        let previous = 18;
        group.forEach((entry, row) => {
          entry.x = width * (column === 0 ? 0.25 : 0.75);
          const maximum = height - 108 - (group.length - row - 1) * 52;
          entry.y = Math.max(previous + 52, Math.min(entry.y, maximum));
          previous = entry.y;
        });
      }
    }
    for (const entry of entries) {
      const dx = entry.anchorX - entry.x;
      const dy = entry.anchorY - entry.y;
      const edge = Math.min(1, 62 / Math.abs(dx), 20 / Math.abs(dy));
      entry.marker.style.left = `${entry.x}px`;
      entry.marker.style.top = `${entry.y}px`;
      entry.marker.style.setProperty('--leader-length', `${Math.hypot(dx, dy) * (1 - edge)}px`);
      entry.marker.style.setProperty('--leader-angle', `${Math.atan2(dy, dx)}rad`);
      entry.marker.style.setProperty('--leader-x', `${dx * edge}px`);
      entry.marker.style.setProperty('--leader-y', `${dy * edge}px`);
      entry.marker.style.setProperty('--pin-x', `${dx}px`);
      entry.marker.style.setProperty('--pin-y', `${dy}px`);
      entry.marker.style.setProperty('--pin-opacity', edge < 1 ? '1' : '0');
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener('change', () => { dirty = true; });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    onLost();
  });

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pressedAt = null;
  renderer.domElement.addEventListener('pointerdown', event => {
    renderer.domElement.focus({ preventScroll: true });
    pressedAt = [event.clientX, event.clientY];
  });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pressedAt || Math.hypot(event.clientX - pressedAt[0], event.clientY - pressedAt[1]) > 6 || jumping) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(bodies.map(({ body }) => body))[0];
    if (hit && chart) onSelect(hit.object.userData.index);
    pressedAt = null;
  });
  const onKeyDown = event => {
    if (document.activeElement !== renderer.domElement || !'wasdqe'.includes(event.key.toLowerCase()) || event.key.length !== 1) return;
    keys.add(event.key.toLowerCase());
    event.preventDefault();
  };
  const onKeyUp = event => keys.delete(event.key.toLowerCase());
  const clearKeys = () => keys.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);
  renderer.domElement.addEventListener('blur', clearKeys);
  arrive(initial);
  resize();

  return {
    arrive,
    beginJump,
    showChart,
    get chart() { return chart; },
    theme() {
      palette = themePalette();
      scene.background = palette.night;
      starMaterial.color.copy(palette.light);
      streakMaterial.color.copy(palette.light);
      bodies.forEach(({ body, atmosphere }, missionIndex) => {
        const colours = surfaceColours(missions[missionIndex].kind, palette);
        body.material.uniforms.uLow.value.copy(colours[0]);
        body.material.uniforms.uMid.value.copy(colours[1]);
        body.material.uniforms.uHigh.value.copy(colours[2]);
        body.material.uniforms.uAccent.value.copy(palette.accent);
        atmosphere.material.uniforms.uColour.value.copy(palette.accent).lerp(palette.light, 0.35);
      });
      rings.forEach(ring => ring.material.color.copy(palette.grey));
      moons.forEach(moon => moon.mesh.material.color.copy(palette.grey));
      vehicleMetal.color.copy(palette.grey);
      vehiclePanel.color.copy(palette.cool).lerp(palette.night, 0.75);
      ambient.color.copy(palette.light);
      ambient.groundColor.copy(palette.night);
      light.color.copy(palette.light);
      dirty = true;
    },
    frame(now, delta, flight, motion) {
      controls.enableDamping = motion;
      if (jumping) {
        if (!flight.travelling) arrive(flight.active);
        else {
          const progress = easeFlight(flight.progress);
          camera.position.lerpVectors(fromCamera, toCamera, progress);
          const distance = fromCamera.distanceTo(toCamera);
          camera.position.y += Math.sin(Math.PI * progress) * Math.min(distance * 0.12, 100);
          controls.target.lerpVectors(fromTarget, toTarget, progress);
          camera.lookAt(controls.target);
          streakMaterial.opacity = motion ? Math.sin(Math.PI * flight.progress) * 0.85 : 0;
          dirty = true;
        }
      }
      if (motion) {
        animationTime += delta;
        bodies.forEach(({ body }, missionIndex) => {
          body.rotation.y = animationTime * (0.018 + missionIndex * 0.003);
          body.material.uniforms.uTime.value = animationTime;
        });
        dirty = true;
      }
      moons.forEach(moon => {
        const angle = animationTime * moon.speed + moon.phase;
        moon.mesh.position.set(Math.cos(angle) * moon.radius, Math.sin(angle * 0.7) * moon.radius * 0.12, Math.sin(angle) * moon.radius);
      });
      vehicles.forEach(vehicle => {
        const angle = animationTime * vehicle.speed + vehicle.phase;
        vehicle.mesh.position.set(Math.cos(angle) * vehicle.radius, vehicle.radius * 0.32, Math.sin(angle) * vehicle.radius);
        vehicle.mesh.rotation.set(0.25, -angle, -0.3);
      });
      if (keys.size && !jumping && !chart) {
        const speed = missions[index].radius * delta * 1.15;
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const offset = new THREE.Vector3();
        camera.getWorldDirection(offset).multiplyScalar(controls.target.distanceTo(camera.position));
        if (keys.has('w')) camera.translateZ(-speed);
        if (keys.has('s')) camera.translateZ(speed);
        if (keys.has('a')) camera.translateX(-speed);
        if (keys.has('d')) camera.translateX(speed);
        if (keys.has('q')) camera.translateY(-speed);
        if (keys.has('e')) camera.translateY(speed);
        const centre = roots[index].position;
        const minimum = missions[index].radius * 1.25;
        if (camera.position.distanceTo(centre) < minimum) camera.position.copy(centre).addScaledVector(forward, -minimum);
        controls.target.copy(camera.position).add(offset);
        dirty = true;
      }
      if (controls.enabled) controls.update();
      if (streakMaterial.opacity > 0) {
        streakData.forEach((star, streakIndex) => {
          const z = -((star.z - now * 0.9) % 900 + 900) % 900 - 4;
          const offset = streakIndex * 6;
          streaks.set([star.x, star.y, z, star.x, star.y, z - 100 * streakMaterial.opacity], offset);
        });
        streakGeometry.attributes.position.needsUpdate = true;
      }
      if (chart) positionMarkers();
      if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    },
    dispose() {
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      controls.dispose();
      scene.traverse(object => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
      renderer.dispose();
      markerHost.replaceChildren();
    },
  };
}
