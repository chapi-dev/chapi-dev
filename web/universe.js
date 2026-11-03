import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { missions } from './missions.js';
import { easeFlight } from './navigation.js';

const vertexShader = `
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying vec3 vTan1;
  varying vec3 vTan2;
  void main() {
    vUv = uv;
    vLocal = normalize(position);
    vec3 up = abs(vLocal.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 t1 = normalize(cross(up, vLocal));
    vec3 t2 = cross(vLocal, t1);
    mat3 m = mat3(modelMatrix);
    vTan1 = normalize(m * t1);
    vTan2 = normalize(m * t2);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(m * normal);
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
  uniform float uScan;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vTan1;
  varying vec3 vTan2;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(uSeed * 0.013, uSeed * 0.029, uSeed * 0.007));
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
      p = p * 2.11 + vec3(4.7, 1.9, 6.3);
      strength *= 0.47;
    }
    return result;
  }

  float ridged(vec3 p) {
    float total = 0.0;
    float weight = 0.56;
    for (int i = 0; i < 3; i++) {
      float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
      total += n * n * weight;
      p = p * 2.18 + vec3(2.3, 5.1, 1.7);
      weight *= 0.48;
    }
    return total;
  }

  float craters(vec3 p) {
    vec3 g = sin(p * 3.14159265);
    float cell = abs(g.x * g.y * g.z);
    float bowl = smoothstep(0.04, 0.52, cell);
    float rim = exp(-pow((cell - 0.52) * 9.0, 2.0)) * 0.38;
    return bowl + rim;
  }

  void main() {
    vec3 p = normalize(vLocal);
    float coarse = terrain(p * 5.2 + uSeed);
    float ridge = ridged(p * 8.5 + uSeed * 0.5);
    float detail = noise(p * 76.0);
    float micro = detail * 0.7 + ridge * 0.3;
    float h0 = coarse * 0.65 + ridge * 0.35;

    float d1 = sin((p.x + p.z) * 42.0 + coarse * 14.0) * (detail - 0.5);
    float d2 = cos((p.y - p.x) * 42.0 + ridge * 14.0) * (coarse - 0.5);
    float bumpScale = (uKind > 4.5 && uKind < 5.5) ? 0.08 : 0.24;
    vec3 n = normalize(vNormal + (normalize(vTan1) * d1 + normalize(vTan2) * d2) * bumpScale);

    vec3 colour = mix(uLow, uMid, smoothstep(0.22, 0.74, coarse));
    float emission = 0.0;
    float roughness = 0.76;

    if (uKind < 0.5) {
      float fissure = 1.0 - smoothstep(0.012, 0.052, abs(terrain(p * 13.0) - 0.47));
      float caldera = smoothstep(0.66, 0.82, ridge) * smoothstep(0.35, 0.65, coarse);
      fissure = max(fissure * smoothstep(0.3, 0.64, coarse), caldera * 0.85);
      colour = mix(uLow, uMid * 0.85, ridge);
      colour *= 0.62 + detail * 0.45 + micro * 0.15;
      colour = mix(colour, uHigh, fissure);
      emission = fissure * 1.15;
      roughness = mix(0.88, 0.25, fissure);
    } else if (uKind < 1.5) {
      float flow = p.y * 28.0 + coarse * 7.2 + sin(p.x * 9.0) * 0.5;
      float bands = sin(flow) * 0.5 + 0.5;
      float cracks = pow(1.0 - abs(sin(coarse * 38.0 + ridge * 8.0)), 14.0);
      colour = mix(uLow, uMid, smoothstep(0.14, 0.82, bands));
      colour = mix(colour, uHigh, pow(bands, 5.0) * 0.58 + cracks * 0.45);
      emission = cracks * 0.22;
      roughness = mix(0.18, 0.55, cracks);
    } else if (uKind < 2.5) {
      float wave = sin((p.x + p.z) * 24.0 + coarse * 12.0) * sin(p.y * 26.0 - coarse * 9.0);
      float contour = pow(1.0 - abs(wave), 11.0);
      float facets = floor(ridge * 9.0) / 9.0;
      colour = mix(uLow, uHigh, coarse * 0.65 + facets * 0.35);
      colour = mix(colour, uAccent, contour * 0.82);
      emission = contour * 0.32;
      roughness = 0.16;
    } else if (uKind < 3.5) {
      float pit = craters(p * 6.5);
      float seam = pow(1.0 - abs(sin(ridge * 22.0)), 16.0);
      colour = mix(uLow, uHigh, smoothstep(0.15, 0.85, pit * 0.65 + coarse * 0.35));
      colour *= 0.65 + detail * 0.35 + micro * 0.15;
      colour = mix(colour, uAccent, seam * 0.35);
      emission = seam * 0.2;
      roughness = 0.45;
    } else if (uKind < 4.5) {
      float terraces = floor(coarse * 15.0) / 15.0;
      float edges = pow(abs(sin(coarse * 48.0)), 14.0);
      colour = mix(uLow, uMid, terraces);
      colour = mix(colour, uHigh, edges * 0.45 + ridge * 0.25 + detail * 0.12);
      roughness = mix(0.72, 0.28, edges);
    } else if (uKind < 5.5) {
      float swirl = terrain(p * 9.0 + vec3(uTime * 0.015, -uTime * 0.01, 0.0));
      float storm = sin(p.y * 38.0 + swirl * 14.0 + uTime * 0.03) * 0.5 + 0.5;
      float eye = exp(-length((p.xy - vec2(-0.22, -0.18)) * vec2(3.5, 5.5)) * 4.5);
      colour = mix(uLow, uMid, storm);
      colour = mix(colour, uHigh, pow(storm, 6.0) * 0.5 + eye * 0.65);
      colour = mix(colour, uAccent, eye * 0.45);
      emission = eye * 0.2;
      roughness = 0.32;
    } else if (uKind < 6.5) {
      float fault = 1.0 - smoothstep(0.01, 0.045, abs(ridge - 0.52));
      float hexGrid = pow(max(0.0, sin(p.x * 95.0) * sin(p.y * 95.0) * sin(p.z * 95.0)), 6.0);
      colour = mix(uLow, uMid, ridge * 0.8 + detail * 0.2);
      colour = mix(colour, uHigh, fault * 0.75 + hexGrid * 0.35);
      emission = fault * 0.65 + hexGrid * 0.25;
      roughness = 0.38;
    } else {
      float equator = exp(-abs(p.y) * 18.0);
      float highlands = smoothstep(0.32, 0.72, coarse * 0.7 + ridge * 0.3);
      colour = mix(uLow, uMid, highlands);
      colour = mix(colour, uHigh, ridge * 0.45 + equator * 0.5);
      emission = equator * smoothstep(0.4, 0.8, detail) * 0.55;
      roughness = mix(0.24, 0.78, highlands);
    }

    vec3 light = normalize(vec3(-0.75, 0.42, 0.95));
    vec3 view = normalize(cameraPosition - vWorld);
    float ndotl = dot(n, light);
    float diffuse = max(ndotl, 0.0);
    float terminator = smoothstep(-0.18, 0.22, ndotl);
    float nightMask = smoothstep(0.12, -0.28, ndotl);
    float specular = pow(max(dot(reflect(-light, n), view), 0.0), mix(64.0, 10.0, roughness));
    float rim = pow(1.0 - max(dot(n, view), 0.0), 3.2);

    float telemetryWeb = pow(1.0 - abs(sin((p.x * 34.0 + coarse * 8.0)) * cos((p.z * 34.0 - ridge * 8.0))), 18.0);
    telemetryWeb *= smoothstep(0.42, 0.68, coarse);
    vec3 nightGlow = mix(uAccent, uHigh, 0.45) * telemetryWeb * nightMask * 0.55;

    colour = colour * (0.05 + diffuse * 1.06 + (1.0 - terminator) * 0.04) + uHigh * specular * (1.0 - roughness) * 0.34;
    colour += uHigh * emission * 0.58 + nightGlow + uAccent * rim * 0.15;

    if (uScan > 0.001 && uScan < 0.999) {
      float scanLat = mix(1.15, -1.15, uScan);
      float waveBand = exp(-pow((p.y - scanLat) * 11.0, 2.0));
      float topoLines = smoothstep(0.92, 0.99, abs(sin(h0 * 55.0)));
      float behindWave = smoothstep(scanLat - 0.35, scanLat, p.y) * smoothstep(scanLat + 0.04, scanLat - 0.02, p.y);
      colour += uAccent * (waveBand * 0.95 + behindWave * topoLines * 0.48);
    }

    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const cloudShader = `
  uniform vec3 uColour;
  uniform vec3 uAccent;
  uniform float uSeed;
  uniform float uTime;
  uniform float uDensity;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vWorld;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(uSeed * 0.019));
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
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.12 + vec3(3.1, 1.7, 4.9);
      a *= 0.48;
    }
    return v;
  }
  void main() {
    vec3 p = normalize(vLocal);
    vec3 q = p * 4.2 + vec3(uTime * 0.02, 0.0, -uTime * 0.015);
    float warp = fbm(q);
    float clouds = fbm(q * 1.8 + vec3(warp * 2.4, sin(p.y * 12.0), warp * 1.8));
    float alpha = smoothstep(0.46, 0.76, clouds) * uDensity;
    vec3 light = normalize(vec3(-0.75, 0.42, 0.95));
    vec3 n = normalize(vNormal);
    float lit = max(dot(n, light), 0.0);
    float twilight = exp(-pow(dot(n, light) * 4.5, 2.0));
    vec3 col = mix(uColour * 0.14, uColour, lit) + uAccent * twilight * 0.35;
    gl_FragColor = vec4(col, alpha * (0.22 + lit * 0.78));
    #include <colorspace_fragment>
  }
`;

const ringShader = `
  uniform vec3 uColour;
  uniform vec3 uAccent;
  uniform float uInner;
  uniform float uOuter;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    float r = vUv.x;
    float bands = sin(r * 95.0) * 0.5 + 0.5;
    float fine = sin(r * 340.0) * 0.5 + 0.5;
    float cassini = smoothstep(0.03, 0.07, abs(r - 0.58)) * smoothstep(0.015, 0.04, abs(r - 0.32));
    float edgeFade = smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.88, r);
    float density = (0.35 + bands * 0.45 + fine * 0.2) * cassini * edgeFade;
    vec3 col = mix(uColour, uAccent, pow(bands, 4.0) * 0.38);
    gl_FragColor = vec4(col, density * 0.52);
    #include <colorspace_fragment>
  }
`;

const atmosphereShader = `
  uniform vec3 uColour;
  uniform vec3 uAccent;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vNormal);
    vec3 light = normalize(vec3(-0.75, 0.42, 0.95));
    float edge = pow(1.0 - abs(dot(n, view)), 3.2);
    float sunward = smoothstep(-0.35, 0.7, dot(-n, light));
    vec3 col = mix(uColour, uAccent, 0.35 + (1.0 - sunward) * 0.35);
    gl_FragColor = vec4(col, edge * (0.14 + sunward * 0.22));
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
    night: colour(dark ? '--cp-surface' : '--cp-text').multiplyScalar(0.15),
    light: colour(dark ? '--cp-text' : '--cp-surface'),
    grey: colour('--cp-border-strong'),
    accent: colour('--cp-accent'),
    warm: colour('--cp-warning'),
    cool: colour('--cp-link'),
    success: colour('--cp-success'),
    muted: colour('--cp-text-muted'),
  };
}

function surfaceColours(kind, palette) {
  const { night, grey, light, accent, warm, cool, success } = palette;
  const low = night.clone().lerp(grey, 0.12);
  if (kind === 0) return [low, grey.clone().multiplyScalar(0.32), accent.clone().lerp(warm, 0.32)];
  if (kind === 1) return [cool.clone().multiplyScalar(0.16), cool.clone().lerp(grey, 0.48), light.clone().lerp(cool, 0.25)];
  if (kind === 2) return [grey.clone().multiplyScalar(0.24), grey.clone().lerp(cool, 0.3), light.clone()];
  if (kind === 3) return [low, warm.clone().lerp(grey, 0.58), warm.clone().lerp(light, 0.28).multiplyScalar(0.76)];
  if (kind === 4) return [warm.clone().lerp(night, 0.68), warm.clone().lerp(grey, 0.48), light.clone().lerp(warm, 0.38)];
  if (kind === 5) return [accent.clone().lerp(night, 0.78), accent.clone().lerp(grey, 0.58), light.clone().lerp(accent, 0.35)];
  if (kind === 6) return [night.clone().lerp(success, 0.14), grey.clone().lerp(success, 0.38), light.clone().lerp(success, 0.42)];
  return [warm.clone().lerp(night, 0.72), warm.clone().lerp(cool, 0.42), light.clone().lerp(warm, 0.3)];
}

export function createUniverse(host, { initial, onSelect, onMoonSelect, onTelemetry, onLost }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D flight deck and galactic holomap. Drag to orbit, scroll to approach, W A S D to fly, F to scan surface, M for 3D star map.');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 16000);
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.minDistance = 16;
  controls.maxDistance = 360;

  let palette = themePalette();
  let index = initial;
  let focusedMoon = -1;
  let chart = false;
  let jumping = false;
  let dirty = true;
  let animationTime = 0;
  let scanActive = false;
  let scanStarted = 0;
  const scanDuration = 1600;

  const fromCamera = new THREE.Vector3();
  const fromTarget = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const keys = new Set();
  const random = randomGenerator(93417);

  const roots = [];
  const bodies = [];
  const moons = [];
  const moonPickTargets = [];
  const rings = [];
  const orbitLines = [];
  const beacons = [];
  const vehicles = [];

  const vehicleMetal = new THREE.MeshStandardMaterial({ color: palette.grey, metalness: 0.78, roughness: 0.28 });
  const vehiclePanel = new THREE.MeshStandardMaterial({ color: palette.cool.clone().lerp(palette.night, 0.72), metalness: 0.38, roughness: 0.45 });
  const vehicleBeacon = new THREE.MeshBasicMaterial({ color: palette.accent });
  const geometry = new THREE.SphereGeometry(1, 64, 44);
  const moonGeometry = new THREE.SphereGeometry(1, 24, 18);

  const markerHost = document.getElementById('map-markers');
  const markers = missions.map((mission, missionIndex) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'map-marker';
    marker.textContent = `${String(missionIndex + 1).padStart(2, '0')} / ${mission.name.toUpperCase()}`;
    marker.setAttribute('aria-label', `Jump to ${mission.name}`);
    marker.addEventListener('click', () => onSelect(missionIndex));
    markerHost.append(marker);
    return marker;
  });

  function createOrbitCircle(radius, segments = 96) {
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

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
      uSeed: { value: 3.7 + missionIndex * 2.1 },
      uTime: { value: 0 },
      uScan: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader: surfaceShader, uniforms });
    const body = new THREE.Mesh(geometry, material);
    body.scale.setScalar(mission.radius);
    body.rotation.z = (missionIndex % 2 === 0 ? 1 : -1) * (0.12 + missionIndex * 0.03);
    body.userData.index = missionIndex;
    root.add(body);

    const cloudDensity = [0.28, 0.52, 0.24, 0.16, 0.34, 0.62, 0.32, 0.44][missionIndex] ?? 0.35;
    const clouds = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: cloudShader,
      uniforms: {
        uColour: { value: colours[2].clone().lerp(palette.light, 0.45) },
        uAccent: { value: palette.accent.clone() },
        uSeed: { value: 11.4 + missionIndex * 3.3 },
        uTime: { value: 0 },
        uDensity: { value: cloudDensity },
      },
      transparent: true,
      depthWrite: false,
    }));
    clouds.scale.setScalar(mission.radius * 1.018);
    root.add(clouds);

    const atmosphere = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: atmosphereShader,
      uniforms: {
        uColour: { value: colours[2].clone().lerp(palette.light, 0.35) },
        uAccent: { value: palette.accent.clone() },
      },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    atmosphere.scale.setScalar(mission.radius * 1.068);
    root.add(atmosphere);

    if ([1, 3, 5, 6, 7].includes(missionIndex)) {
      const inner = mission.radius * (missionIndex === 3 ? 1.28 : 1.38);
      const outer = mission.radius * (missionIndex === 5 ? 2.32 : 2.08);
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 144, 4),
        new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader: ringShader,
          uniforms: {
            uColour: { value: colours[1].clone().lerp(palette.grey, 0.5) },
            uAccent: { value: palette.accent.clone() },
            uInner: { value: inner },
            uOuter: { value: outer },
          },
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ringMesh.rotation.x = Math.PI / 2.45 + (missionIndex % 3) * 0.08;
      ringMesh.rotation.y = 0.22 * (missionIndex % 2 === 0 ? 1 : -1);
      root.add(ringMesh);
      rings.push({ mesh: ringMesh, kind: mission.kind });
    }

    const beaconRing = new THREE.LineLoop(
      createOrbitCircle(mission.radius * 2.55, 72),
      new THREE.LineBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.22 }),
    );
    beaconRing.rotation.x = Math.PI / 2;
    root.add(beaconRing);
    beacons.push(beaconRing);

    (mission.moons || []).forEach((moonMeta, moonIndex) => {
      const orbitRadius = mission.radius * (1.78 + moonIndex * 0.56);
      const tiltX = (moonIndex % 2 === 0 ? 1 : -1) * (0.14 + moonIndex * 0.07);
      const tiltZ = (moonIndex % 2 === 1 ? 1 : -1) * 0.1;

      const orbitPlane = new THREE.Group();
      orbitPlane.rotation.set(tiltX, missionIndex * 0.4, tiltZ);
      const orbitLine = new THREE.LineLoop(
        createOrbitCircle(orbitRadius, 88),
        new THREE.LineBasicMaterial({ color: palette.grey, transparent: true, opacity: 0.28 }),
      );
      orbitPlane.add(orbitLine);
      orbitLines.push(orbitLine);

      const moonSize = mission.radius * (0.095 - moonIndex * 0.012);
      const moonColours = surfaceColours((mission.kind + moonIndex + 2) % 8, palette);
      const moonMat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader: surfaceShader,
        uniforms: {
          uLow: { value: moonColours[0] },
          uMid: { value: moonColours[1] },
          uHigh: { value: moonColours[2] },
          uAccent: { value: palette.accent.clone() },
          uKind: { value: (mission.kind + moonIndex + 3) % 6 },
          uSeed: { value: 21.1 + missionIndex * 5.0 + moonIndex * 2.7 },
          uTime: { value: 0 },
          uScan: { value: 0 },
        },
      });
      const moonMesh = new THREE.Mesh(moonGeometry, moonMat);
      moonMesh.scale.setScalar(moonSize);
      moonMesh.userData = { missionIndex, moonIndex, moonMeta };

      const moonHalo = new THREE.LineLoop(
        createOrbitCircle(moonSize * 1.65, 32),
        new THREE.LineBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.55 }),
      );
      moonHalo.rotation.x = Math.PI / 2;
      moonMesh.add(moonHalo);

      orbitPlane.add(moonMesh);
      root.add(orbitPlane);

      moons.push({
        mesh: moonMesh,
        missionIndex,
        moonIndex,
        radius: orbitRadius,
        phase: moonIndex * 2.15 + missionIndex * 0.9,
        speed: 0.055 - moonIndex * 0.011,
      });
      moonPickTargets.push(moonMesh);
    });

    const craft = new THREE.Group();
    craft.scale.setScalar(mission.radius * 0.052);
    craft.add(new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 3.2, 12), vehicleMetal));
    const habRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.14, 10, 48), vehicleMetal);
    habRing.rotation.x = Math.PI / 2;
    craft.add(habRing);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), vehicleMetal);
      arm.position.x = side * 1.9;
      craft.add(arm);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.35, 0.06), vehiclePanel);
      panel.position.x = side * 2.8;
      craft.add(panel);
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), vehicleBeacon);
    beacon.position.y = 1.9;
    craft.add(beacon);
    root.add(craft);
    vehicles.push({ mesh: craft, ring: habRing, radius: mission.radius * 1.52, phase: 1.9 + missionIndex * 0.85, speed: 0.05 });

    scene.add(root);
    roots.push(root);
    bodies.push({ body, clouds, atmosphere });
  });

  const holomapGroup = new THREE.Group();
  const mapPlaneY = -105;
  const mapCenterZ = -720;
  const holoLineMat = new THREE.LineBasicMaterial({ color: palette.grey, transparent: true, opacity: 0.34 });
  const holoAccentMat = new THREE.LineBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.62 });

  for (const radius of [240, 480, 720, 960]) {
    const circle = new THREE.LineLoop(createOrbitCircle(radius, 120), holoLineMat);
    circle.position.set(0, mapPlaneY, mapCenterZ);
    holomapGroup.add(circle);
  }
  const radialPoints = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    radialPoints.push(
      new THREE.Vector3(0, mapPlaneY, mapCenterZ),
      new THREE.Vector3(Math.cos(angle) * 960, mapPlaneY, mapCenterZ + Math.sin(angle) * 960),
    );
  }
  holomapGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(radialPoints), holoLineMat));

  missions.forEach(mission => {
    const [x, y, z] = mission.position;
    const stalk = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, mapPlaneY, z)]),
      holoAccentMat,
    );
    holomapGroup.add(stalk);
    const baseRing = new THREE.LineLoop(createOrbitCircle(mission.radius * 2.2, 48), holoAccentMat);
    baseRing.position.set(x, mapPlaneY, z);
    holomapGroup.add(baseRing);
  });

  const splineCurve = new THREE.CatmullRomCurve3(missions.map(m => new THREE.Vector3(...m.position)));
  const splinePoints = splineCurve.getPoints(260);
  const hyperlane = new THREE.Line(new THREE.BufferGeometry().setFromPoints(splinePoints), holoAccentMat);
  holomapGroup.add(hyperlane);

  const crossLinks = [[0, 3], [1, 2], [2, 5], [3, 4], [4, 6], [6, 7]];
  const crossPoints = [];
  for (const [a, b] of crossLinks) {
    crossPoints.push(new THREE.Vector3(...missions[a].position), new THREE.Vector3(...missions[b].position));
  }
  holomapGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crossPoints), holoLineMat));

  const pulseCount = 48;
  const pulsePositions = new Float32Array(pulseCount * 3);
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePositions, 3).setUsage(THREE.DynamicDrawUsage));
  const pulseMat = new THREE.PointsMaterial({ color: palette.accent, size: 7, sizeAttenuation: true, transparent: true, opacity: 0.9 });
  holomapGroup.add(new THREE.Points(pulseGeo, pulseMat));
  holomapGroup.visible = false;
  scene.add(holomapGroup);

  const ambient = new THREE.HemisphereLight(palette.light, palette.night, 1.55);
  scene.add(ambient);
  const light = new THREE.DirectionalLight(palette.light, 2.15);
  light.position.set(-85, 64, 110);
  scene.add(light);

  const stars = new Float32Array(7200 * 3);
  for (let i = 0; i < stars.length; i += 3) {
    stars[i] = (random() - 0.5) * 6800;
    stars[i + 1] = (random() - 0.5) * 4400;
    stars[i + 2] = (random() - 0.5) * 6800 - 650;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  const starMaterial = new THREE.PointsMaterial({ color: palette.light, size: 2.1, sizeAttenuation: true, transparent: true, opacity: 0.82 });
  scene.add(new THREE.Points(starGeometry, starMaterial));

  const streakCount = 420;
  const streakData = Array.from({ length: streakCount }, () => ({
    x: (random() - 0.5) * 680,
    y: (random() - 0.5) * 440,
    z: random() * 940,
  }));
  const streaks = new Float32Array(streakCount * 6);
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streaks, 3).setUsage(THREE.DynamicDrawUsage));
  const streakMaterial = new THREE.LineBasicMaterial({ color: palette.light, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending });
  const warp = new THREE.LineSegments(streakGeometry, streakMaterial);
  warp.frustumCulled = false;
  camera.add(warp);

  function setHolomapScale(enabled) {
    holomapGroup.visible = enabled;
    bodies.forEach(({ body, clouds, atmosphere }, missionIndex) => {
      const r = missions[missionIndex].radius * (enabled ? 2.4 : 1);
      body.scale.setScalar(r);
      clouds.scale.setScalar(r * 1.018);
      atmosphere.scale.setScalar(r * 1.068);
    });
    beacons.forEach((ring, missionIndex) => {
      ring.material.opacity = enabled ? (missionIndex === index ? 0.92 : 0.48) : 0.14;
    });
  }

  function arrival(missionIndex) {
    const mission = missions[missionIndex];
    const narrow = host.clientWidth < 600;
    const ringed = [1, 3, 5, 6, 7].includes(missionIndex);
    const distance = mission.radius * (ringed ? (narrow ? 5.6 : 4.7) : (narrow ? 4.3 : 3.7));
    const target = new THREE.Vector3().fromArray(mission.position);
    return { position: target.clone().add(new THREE.Vector3(distance * 0.16, distance * 0.08, distance)), target };
  }

  function arrive(missionIndex) {
    index = missionIndex;
    focusedMoon = -1;
    chart = false;
    jumping = false;
    setHolomapScale(false);
    const next = arrival(index);
    camera.position.copy(next.position);
    controls.target.copy(next.target);
    controls.minDistance = missions[index].radius * 1.32;
    controls.maxDistance = missions[index].radius * 14;
    controls.enabled = true;
    controls.update();
    streakMaterial.opacity = 0;
    markerHost.hidden = true;
    dirty = true;
  }

  function beginJump(missionIndex) {
    chart = false;
    focusedMoon = -1;
    jumping = true;
    index = missionIndex;
    setHolomapScale(false);
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
    focusedMoon = -1;
    streakMaterial.opacity = 0;
    setHolomapScale(true);
    const narrow = host.clientWidth < 600;
    camera.position.set(narrow ? 0 : 380, narrow ? 1850 : 920, narrow ? 1850 : 880);
    controls.target.set(0, -30, -680);
    controls.minDistance = 380;
    controls.maxDistance = 4200;
    controls.enabled = true;
    controls.update();
    markerHost.hidden = false;
    dirty = true;
  }

  function focusMoon(moonIndex) {
    const entry = moons.find(m => m.missionIndex === index && m.moonIndex === moonIndex);
    if (!entry) return;
    focusedMoon = moonIndex;
    chart = false;
    jumping = false;
    setHolomapScale(false);
    markerHost.hidden = true;
    const worldPos = new THREE.Vector3();
    entry.mesh.getWorldPosition(worldPos);
    const planetPos = roots[index].position;
    const outDir = worldPos.clone().sub(planetPos).normalize();
    const dist = Math.max(4.5, missions[index].radius * 0.55);
    camera.position.copy(worldPos).addScaledVector(outDir, dist).add(new THREE.Vector3(0, dist * 0.35, 0));
    controls.target.copy(worldPos);
    controls.minDistance = 2.2;
    controls.maxDistance = missions[index].radius * 12;
    controls.enabled = true;
    controls.update();
    dirty = true;
  }

  function triggerScan() {
    scanActive = true;
    scanStarted = performance.now();
    bodies[index].body.material.uniforms.uScan.value = 0.01;
    dirty = true;
  }

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (chart) showChart();
    else if (!jumping && focusedMoon < 0) arrive(index);
    dirty = true;
  }

  function positionMarkers() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    camera.updateMatrixWorld();
    const entries = roots.map((root, missionIndex) => {
      const point = root.position.clone().project(camera);
      const marker = markers[missionIndex];
      marker.hidden = point.z > 1 || Math.abs(point.x) > 0.96 || Math.abs(point.y) > 0.92;
      marker.setAttribute('aria-current', String(missionIndex === index));
      const x = (point.x + 1) / 2 * width;
      const y = (-point.y + 1) / 2 * height;
      return { marker, anchorX: x, anchorY: y, x, y };
    }).filter(entry => !entry.marker.hidden);

    const crowded = width < 820 || entries.some((entry, entryIndex) =>
      entries.slice(entryIndex + 1).some(other => Math.abs(entry.x - other.x) < 138 && Math.abs(entry.y - other.y) < 46),
    );
    if (crowded) {
      entries.sort((a, b) => a.x - b.x);
      const split = Math.ceil(entries.length / 2);
      const rowStep = width < 500 ? 44 : 48;
      for (const [column, group] of [entries.slice(0, split), entries.slice(split)].entries()) {
        group.sort((a, b) => a.y - b.y);
        let previous = 22;
        group.forEach((entry, row) => {
          entry.x = width * (column === 0 ? 0.25 : 0.75);
          const maximum = height - 104 - (group.length - row - 1) * rowStep;
          entry.y = Math.max(previous + rowStep, Math.min(entry.y, maximum));
          previous = entry.y;
        });
      }
    }
    for (const entry of entries) {
      const dx = entry.anchorX - entry.x;
      const dy = entry.anchorY - entry.y;
      const edge = Math.min(1, 58 / Math.max(1, Math.abs(dx)), 18 / Math.max(1, Math.abs(dy)));
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
    if (chart) {
      const hit = ray.intersectObjects(bodies.map(({ body }) => body))[0];
      if (hit) onSelect(hit.object.userData.index);
    } else {
      const moonHit = ray.intersectObjects(moonPickTargets)[0];
      if (moonHit && moonHit.object.userData.missionIndex === index) {
        onMoonSelect?.(moonHit.object.userData.moonIndex);
      } else {
        const planetHit = ray.intersectObjects(bodies.map(({ body }) => body))[0];
        if (planetHit && planetHit.object.userData.index !== index) {
          onSelect(planetHit.object.userData.index);
        }
      }
    }
    pressedAt = null;
  });

  const onKeyDown = event => {
    const key = event.key.toLowerCase();
    if (document.activeElement !== renderer.domElement) return;
    if ('wasdqe'.includes(key) && key.length === 1) {
      keys.add(key);
      event.preventDefault();
    } else if (event.key === 'Shift') {
      keys.add('shift');
    }
  };
  const onKeyUp = event => {
    const key = event.key.toLowerCase();
    keys.delete(key);
    if (event.key === 'Shift') keys.delete('shift');
  };
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
    focusMoon,
    triggerScan,
    get chart() { return chart; },
    get cameraPosition() { return camera.position; },
    get cameraHeading() {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      return (Math.round(Math.atan2(dir.x, -dir.z) * 180 / Math.PI) + 360) % 360;
    },
    theme() {
      palette = themePalette();
      scene.background = palette.night;
      starMaterial.color.copy(palette.light);
      streakMaterial.color.copy(palette.light);
      holoLineMat.color.copy(palette.grey);
      holoAccentMat.color.copy(palette.accent);
      pulseMat.color.copy(palette.accent);
      bodies.forEach(({ body, clouds, atmosphere }, missionIndex) => {
        const colours = surfaceColours(missions[missionIndex].kind, palette);
        body.material.uniforms.uLow.value.copy(colours[0]);
        body.material.uniforms.uMid.value.copy(colours[1]);
        body.material.uniforms.uHigh.value.copy(colours[2]);
        body.material.uniforms.uAccent.value.copy(palette.accent);
        clouds.material.uniforms.uColour.value.copy(colours[2]).lerp(palette.light, 0.45);
        clouds.material.uniforms.uAccent.value.copy(palette.accent);
        atmosphere.material.uniforms.uColour.value.copy(colours[2]).lerp(palette.light, 0.35);
        atmosphere.material.uniforms.uAccent.value.copy(palette.accent);
      });
      rings.forEach(({ mesh, kind }) => {
        const colours = surfaceColours(kind, palette);
        mesh.material.uniforms.uColour.value.copy(colours[1]).lerp(palette.grey, 0.5);
        mesh.material.uniforms.uAccent.value.copy(palette.accent);
      });
      orbitLines.forEach(line => line.material.color.copy(palette.grey));
      beacons.forEach(ring => ring.material.color.copy(palette.accent));
      vehicleMetal.color.copy(palette.grey);
      vehiclePanel.color.copy(palette.cool).lerp(palette.night, 0.72);
      vehicleBeacon.color.copy(palette.accent);
      ambient.color.copy(palette.light);
      ambient.groundColor.copy(palette.night);
      light.color.copy(palette.light);
      dirty = true;
    },
    frame(now, delta, flight, motion) {
      controls.enableDamping = motion;
      let speedReadout = 0;

      if (jumping) {
        if (!flight.travelling) arrive(flight.active);
        else {
          const progress = easeFlight(flight.progress);
          camera.position.lerpVectors(fromCamera, toCamera, progress);
          const distance = fromCamera.distanceTo(toCamera);
          camera.position.y += Math.sin(Math.PI * progress) * Math.min(distance * 0.13, 110);
          controls.target.lerpVectors(fromTarget, toTarget, progress);
          camera.lookAt(controls.target);
          streakMaterial.opacity = motion ? Math.sin(Math.PI * flight.progress) * 0.88 : 0;
          speedReadout = Math.sin(Math.PI * flight.progress) * 48.4;
          dirty = true;
        }
      }

      if (scanActive) {
        const progress = Math.min(1, (now - scanStarted) / scanDuration);
        bodies[index].body.material.uniforms.uScan.value = progress < 1 ? progress : 0;
        if (progress >= 1) scanActive = false;
        dirty = true;
      }

      if (motion) {
        animationTime += delta;
        bodies.forEach(({ body, clouds }, missionIndex) => {
          body.rotation.y = animationTime * (0.018 + missionIndex * 0.0025);
          body.material.uniforms.uTime.value = animationTime;
          clouds.rotation.y = -animationTime * (0.026 + missionIndex * 0.003);
          clouds.material.uniforms.uTime.value = animationTime;
        });
        if (chart) {
          for (let i = 0; i < pulseCount; i++) {
            const t = ((i / pulseCount) + animationTime * 0.04) % 1;
            const pt = splineCurve.getPointAt(t);
            pulsePositions[i * 3] = pt.x;
            pulsePositions[i * 3 + 1] = pt.y;
            pulsePositions[i * 3 + 2] = pt.z;
          }
          pulseGeo.attributes.position.needsUpdate = true;
        }
        dirty = true;
      }

      moons.forEach(moon => {
        const angle = animationTime * moon.speed + moon.phase;
        moon.mesh.position.set(Math.cos(angle) * moon.radius, 0, Math.sin(angle) * moon.radius);
        moon.mesh.rotation.y = angle * 1.4;
      });
      vehicles.forEach(vehicle => {
        const angle = animationTime * vehicle.speed + vehicle.phase;
        vehicle.mesh.position.set(Math.cos(angle) * vehicle.radius, vehicle.radius * 0.28, Math.sin(angle) * vehicle.radius);
        vehicle.mesh.rotation.set(0.25, -angle, -0.28);
        vehicle.ring.rotation.z = animationTime * 0.6;
      });

      if (keys.size && !jumping && !chart) {
        const boost = keys.has('shift') ? 2.6 : 1;
        const moveKeys = ['w', 'a', 's', 'd', 'q', 'e'].some(k => keys.has(k));
        if (moveKeys) {
          const speed = missions[index].radius * delta * 1.25 * boost;
          speedReadout = 14.2 * boost;
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
      }

      if (controls.enabled) controls.update();
      if (streakMaterial.opacity > 0) {
        streakData.forEach((star, streakIndex) => {
          const z = -((star.z - now * 0.95) % 940 + 940) % 940 - 4;
          const offset = streakIndex * 6;
          streaks.set([star.x, star.y, z, star.x, star.y, z - 115 * streakMaterial.opacity], offset);
        });
        streakGeometry.attributes.position.needsUpdate = true;
      }
      if (chart) positionMarkers();
      if (dirty) {
        renderer.render(scene, camera);
        const altitude = Math.max(0.1, camera.position.distanceTo(roots[index].position) - missions[index].radius);
        onTelemetry?.({
          heading: this.cameraHeading,
          altitude: altitude.toFixed(1),
          speed: jumping ? `${speedReadout.toFixed(1)} c` : `${speedReadout.toFixed(1)} km/s`,
          scanning: scanActive,
        });
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
