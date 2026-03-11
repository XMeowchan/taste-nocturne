import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const canvas = document.querySelector('.webgl');
const modeName = document.querySelector('#modeName');
const modeButton = document.querySelector('#modeButton');
const driftButton = document.querySelector('#driftButton');
const soundButton = document.querySelector('#soundButton');
const captureButton = document.querySelector('#captureButton');
const zenButton = document.querySelector('#zenButton');
const statusText = document.querySelector('#statusText');
const chipDrift = document.querySelector('#chipDrift');
const chipAudio = document.querySelector('#chipAudio');
const chipZen = document.querySelector('#chipZen');

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
};

const pointer = {
  raw: new THREE.Vector2(0, 0),
  smooth: new THREE.Vector2(0, 0),
  world: new THREE.Vector3(0, -1.55, 0),
  screen: new THREE.Vector2(0.5, 0.5),
};

const state = {
  drift: true,
  zen: false,
  audioEnabled: false,
  warp: 0,
  pulseStrength: 0,
  userOrbiting: false,
  lastInteractionTime: 0,
};

const modes = [
  {
    name: 'Velvet Pulse',
    colorA: new THREE.Color('#7dd3fc'),
    colorB: new THREE.Color('#c084fc'),
    floorA: new THREE.Color('#0c1023'),
    floorB: new THREE.Color('#11183b'),
    atmosphereA: new THREE.Color('#040610'),
    atmosphereB: new THREE.Color('#151a3d'),
    accent: '#dbeafe',
    bloom: 0.38,
    aberration: 0.012,
    speed: 0.58,
    orbitLift: 0.38,
    audioBase: 110,
  },
  {
    name: 'Ghost Orchid',
    colorA: new THREE.Color('#67e8f9'),
    colorB: new THREE.Color('#f9a8d4'),
    floorA: new THREE.Color('#091421'),
    floorB: new THREE.Color('#1a1435'),
    atmosphereA: new THREE.Color('#040712'),
    atmosphereB: new THREE.Color('#241336'),
    accent: '#f5f3ff',
    bloom: 0.5,
    aberration: 0.016,
    speed: 0.82,
    orbitLift: 0.5,
    audioBase: 132,
  },
  {
    name: 'Solar Ash',
    colorA: new THREE.Color('#f9c97d'),
    colorB: new THREE.Color('#fb7185'),
    floorA: new THREE.Color('#170f15'),
    floorB: new THREE.Color('#26171f'),
    atmosphereA: new THREE.Color('#090508'),
    atmosphereB: new THREE.Color('#32181b'),
    accent: '#fff1d6',
    bloom: 0.42,
    aberration: 0.014,
    speed: 0.68,
    orbitLift: 0.44,
    audioBase: 98,
  },
  {
    name: 'Obsidian Bloom',
    colorA: new THREE.Color('#9ae6b4'),
    colorB: new THREE.Color('#818cf8'),
    floorA: new THREE.Color('#071110'),
    floorB: new THREE.Color('#10193a'),
    atmosphereA: new THREE.Color('#020707'),
    atmosphereB: new THREE.Color('#102033'),
    accent: '#d1fae5',
    bloom: 0.46,
    aberration: 0.015,
    speed: 0.72,
    orbitLift: 0.46,
    audioBase: 123.47,
  },
  {
    name: 'Neon Relic',
    colorA: new THREE.Color('#38bdf8'),
    colorB: new THREE.Color('#f472b6'),
    floorA: new THREE.Color('#060d19'),
    floorB: new THREE.Color('#29103a'),
    atmosphereA: new THREE.Color('#02040d'),
    atmosphereB: new THREE.Color('#1b1037'),
    accent: '#e9d5ff',
    bloom: 0.54,
    aberration: 0.02,
    speed: 0.9,
    orbitLift: 0.52,
    audioBase: 146.83,
  },
];

let modeIndex = 0;
let statusTimer = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#040610');
scene.fog = new THREE.FogExp2('#050816', 0.065);

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 60);
camera.position.set(0, 1.1, 6.8);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(sizes.pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.dampingFactor = 0.05;
controls.minDistance = 4.8;
controls.maxDistance = 9.4;
controls.minPolarAngle = Math.PI * 0.18;
controls.maxPolarAngle = Math.PI * 0.64;
controls.target.set(0, -0.1, 0);
controls.addEventListener('start', () => {
  state.userOrbiting = true;
});
controls.addEventListener('end', () => {
  state.userOrbiting = false;
});

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  0.38,
  0.5,
  0.62,
);
composer.addPass(bloomPass);

const screenShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    amount: { value: 0.012 },
    warp: { value: 0 },
    pulseOrigin: { value: new THREE.Vector2(0.5, 0.5) },
    resolution: { value: new THREE.Vector2(sizes.width, sizes.height) },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float amount;
    uniform float warp;
    uniform vec2 pulseOrigin;
    uniform vec2 resolution;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      vec2 fromPulse = uv - pulseOrigin;
      float pulseDist = length(fromPulse);
      float warpWave = sin(pulseDist * 28.0 - time * 5.0) * exp(-pulseDist * 10.0) * warp;
      uv += normalize(fromPulse + vec2(0.0001)) * warpWave * 0.012;

      float dist = dot(centered, centered);
      vec2 shift = centered * amount * (0.5 + dist * 1.8);

      float r = texture2D(tDiffuse, uv - shift).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + shift).b;
      vec3 color = vec3(r, g, b);

      float vignette = smoothstep(1.18, 0.12, length(centered));
      float grain = random(uv * resolution.xy * 0.35 + time) - 0.5;
      float scan = sin((uv.y + time * 0.08) * resolution.y * 0.45) * 0.005;

      color += grain * 0.04;
      color += scan;
      color *= vignette;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

const finalPass = new ShaderPass(screenShader);
composer.addPass(finalPass);

const ambience = new THREE.AmbientLight('#bfc9ff', 0.7);
scene.add(ambience);

const keyLight = new THREE.DirectionalLight('#9ac5ff', 1.35);
keyLight.position.set(3.8, 4.5, 4.2);
scene.add(keyLight);

const fillLight = new THREE.PointLight('#ff9ad9', 1.15, 14, 2);
fillLight.position.set(-3, 0.5, 2.5);
scene.add(fillLight);

const pointerLight = new THREE.PointLight('#c4b5fd', 1.25, 10, 2);
pointerLight.position.set(0, 0.5, 2.2);
scene.add(pointerLight);

const atmosphereUniforms = {
  uTop: { value: modes[0].atmosphereB.clone() },
  uBottom: { value: modes[0].atmosphereA.clone() },
  uTime: { value: 0 },
};

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(28, 64, 64),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: atmosphereUniforms,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform float uTime;
      varying vec3 vWorldPosition;

      void main() {
        float height = normalize(vWorldPosition).y * 0.5 + 0.5;
        float haze = 0.5 + 0.5 * sin(vWorldPosition.x * 0.05 + uTime * 0.08);
        vec3 color = mix(uBottom, uTop, smoothstep(0.05, 0.9, height));
        color += haze * 0.015;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }),
);
scene.add(atmosphere);

const mainGroup = new THREE.Group();
scene.add(mainGroup);

const sculptureUniforms = {
  uTime: { value: 0 },
  uColorA: { value: modes[0].colorA.clone() },
  uColorB: { value: modes[0].colorB.clone() },
  uHover: { value: 0 },
  uPulse: { value: 0 },
  uMorph: { value: 0.58 },
};

const sculptureMaterial = new THREE.ShaderMaterial({
  uniforms: sculptureUniforms,
  vertexShader: `
    uniform float uTime;
    uniform float uPulse;
    uniform float uMorph;

    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    varying float vWave;

    void main() {
      vec3 pos = position;
      float wave =
        sin(pos.x * (4.0 + uMorph * 2.0) + uTime * 0.85) +
        sin(pos.y * 5.0 - uTime * 1.15) +
        sin(pos.z * 6.0 + uTime * 1.45);
      float ripple = sin(length(pos.xy) * 10.0 - uTime * 1.7) * 0.4;
      float displacement = wave * 0.075 + ripple * 0.03 + uPulse * 0.09;
      pos += normal * displacement;

      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPosition.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vWave = displacement;

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uTime;
    uniform float uHover;

    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    varying float vWave;

    void main() {
      vec3 normal = normalize(vWorldNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.2);
      float sheen = 0.5 + 0.5 * sin(vWave * 18.0 + uTime * 2.4 + vWorldPosition.y * 3.0);
      float halo = smoothstep(0.1, 1.0, fresnel);

      vec3 color = mix(uColorA, uColorB, clamp(sheen * 0.7 + halo * 0.35, 0.0, 1.0));
      color += fresnel * 0.2;
      color += uHover * 0.06;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
});

const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.08, 7), sculptureMaterial);
core.position.y = -0.05;
mainGroup.add(core);

const aura = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.42, 3),
  new THREE.MeshBasicMaterial({
    color: '#a5b4fc',
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
aura.position.copy(core.position);
mainGroup.add(aura);

const shellMaterial = new THREE.MeshPhysicalMaterial({
  color: '#f8fbff',
  transmission: 0.96,
  thickness: 0.45,
  roughness: 0.14,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.12,
  transparent: true,
  opacity: 0.7,
});

const shell = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.045, 24, 220), shellMaterial);
shell.rotation.x = Math.PI * 0.35;
shell.rotation.y = Math.PI * 0.1;
mainGroup.add(shell);

const shell2 = new THREE.Mesh(
  new THREE.TorusGeometry(2.25, 0.024, 18, 220),
  new THREE.MeshBasicMaterial({
    color: '#dbeafe',
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
shell2.rotation.x = Math.PI * 0.6;
shell2.rotation.z = Math.PI * 0.22;
mainGroup.add(shell2);

const orbitGroup = new THREE.Group();
mainGroup.add(orbitGroup);
const orbitNodes = [];
const capsuleGeometry = new THREE.CapsuleGeometry(0.06, 0.42, 6, 12);

for (let i = 0; i < 22; i += 1) {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#f7fbff',
    transparent: true,
    opacity: 0.78,
    roughness: 0.1,
    metalness: 0,
    transmission: 0.95,
    thickness: 0.55,
  });

  const node = new THREE.Mesh(capsuleGeometry, material);
  node.userData = {
    angle: (i / 22) * Math.PI * 2,
    radius: 2.15 + Math.sin(i * 1.73) * 0.32,
    lift: (i % 2 === 0 ? 1 : -1) * (0.16 + Math.random() * 0.22),
    wobble: 0.4 + Math.random() * 0.6,
  };
  orbitGroup.add(node);
  orbitNodes.push(node);
}

const trailCount = 2800;
const trailPositions = new Float32Array(trailCount * 3);
const trailColors = new Float32Array(trailCount * 3);
for (let i = 0; i < trailCount; i += 1) {
  const radius = 4.5 + Math.random() * 7;
  const angle = Math.random() * Math.PI * 2;
  const height = (Math.random() - 0.5) * 5.5;
  const color = i % 2 === 0 ? new THREE.Color('#dbeafe') : new THREE.Color('#93c5fd');

  trailPositions[i * 3 + 0] = Math.cos(angle) * radius;
  trailPositions[i * 3 + 1] = height;
  trailPositions[i * 3 + 2] = Math.sin(angle) * radius;
  trailColors[i * 3 + 0] = color.r;
  trailColors[i * 3 + 1] = color.g;
  trailColors[i * 3 + 2] = color.b;
}

const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
const particles = new THREE.Points(
  particlesGeometry,
  new THREE.PointsMaterial({
    size: 0.028,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
  }),
);
particles.position.y = 0.3;
scene.add(particles);

const shootingStars = [];
const shootingStarGroup = new THREE.Group();
scene.add(shootingStarGroup);

for (let i = 0; i < 4; i += 1) {
  const star = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.018, 0.018),
    new THREE.MeshBasicMaterial({
      color: '#f8fbff',
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  star.visible = false;
  star.userData = {
    velocity: new THREE.Vector3(),
    life: 0,
  };
  shootingStars.push(star);
  shootingStarGroup.add(star);
}

function resetShootingStar(star, initial = false) {
  star.visible = true;
  star.position.set(
    THREE.MathUtils.randFloat(-10, 10),
    THREE.MathUtils.randFloat(3.6, 7.8),
    THREE.MathUtils.randFloat(-7, -2),
  );
  star.rotation.z = THREE.MathUtils.randFloat(-0.9, -0.3);
  star.userData.velocity.set(
    THREE.MathUtils.randFloat(0.06, 0.11),
    THREE.MathUtils.randFloat(-0.02, -0.045),
    0,
  );
  star.userData.life = initial ? THREE.MathUtils.randFloat(80, 180) : THREE.MathUtils.randFloat(40, 90);
}
shootingStars.forEach((star) => resetShootingStar(star, true));

const floorUniforms = {
  uTime: { value: 0 },
  uPointer: { value: new THREE.Vector2(0, 0) },
  uColorA: { value: modes[0].floorA.clone() },
  uColorB: { value: modes[0].floorB.clone() },
};

const floorMaterial = new THREE.ShaderMaterial({
  uniforms: floorUniforms,
  transparent: true,
  side: THREE.DoubleSide,
  vertexShader: `
    uniform float uTime;
    uniform vec2 uPointer;

    varying vec2 vUv;
    varying float vElevation;
    varying vec2 vWorldXZ;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float distanceToPointer = distance(pos.xz, uPointer);
      float ripple = sin(distanceToPointer * 4.5 - uTime * 2.5) * exp(-distanceToPointer * 0.8);
      float breeze = sin(pos.x * 0.85 + uTime * 0.3) * sin(pos.z * 0.78 - uTime * 0.24) * 0.08;
      pos.y += ripple * 0.18 + breeze;

      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vElevation = pos.y;
      vWorldXZ = worldPosition.xz;

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec2 uPointer;
    uniform vec3 uColorA;
    uniform vec3 uColorB;

    varying vec2 vUv;
    varying float vElevation;
    varying vec2 vWorldXZ;

    float line(vec2 value) {
      vec2 grid = abs(fract(value - 0.5) - 0.5) / fwidth(value);
      float lineValue = min(grid.x, grid.y);
      return 1.0 - min(lineValue, 1.0);
    }

    void main() {
      float grid = line(vWorldXZ * 0.35) * 0.12;
      float radial = distance(vWorldXZ, uPointer);
      float pulse = 0.5 + 0.5 * sin(radial * 7.0 - uTime * 4.0);
      float glow = exp(-radial * 0.85) * (0.45 + pulse * 0.55);
      float horizon = 1.0 - smoothstep(0.08, 0.92, vUv.y);

      vec3 color = mix(uColorA, uColorB, clamp(vUv.y * 0.65 + pulse * 0.15, 0.0, 1.0));
      color += grid * 0.6;
      color += glow * 0.18;
      color += vElevation * 0.14;
      color *= 0.42 + horizon * 0.16;

      gl_FragColor = vec4(color, 0.95);
    }
  `,
});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24, 240, 240), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.55;
scene.add(floor);

const pointerRing = new THREE.Mesh(
  new THREE.RingGeometry(0.16, 0.24, 64),
  new THREE.MeshBasicMaterial({
    color: '#dbeafe',
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
pointerRing.rotation.x = -Math.PI / 2;
pointerRing.position.y = -1.548;
scene.add(pointerRing);

const pointerTrailLength = 20;
const pointerTrailPoints = Array.from({ length: pointerTrailLength }, () => new THREE.Vector3(0, -1.48, 0));
const pointerTrailPositions = new Float32Array(pointerTrailLength * 3);
const pointerTrailGeometry = new THREE.BufferGeometry();
pointerTrailGeometry.setAttribute('position', new THREE.BufferAttribute(pointerTrailPositions, 3));
const pointerTrail = new THREE.Line(
  pointerTrailGeometry,
  new THREE.LineBasicMaterial({
    color: '#dbeafe',
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
scene.add(pointerTrail);

const burstCount = 180;
const burstPositions = new Float32Array(burstCount * 3);
const burstVelocities = Array.from({ length: burstCount }, () => new THREE.Vector3());
const burstLife = new Float32Array(burstCount);
const burstGeometry = new THREE.BufferGeometry();
burstGeometry.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
const burstMaterial = new THREE.PointsMaterial({
  color: '#f8fbff',
  size: 0.055,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const burstPoints = new THREE.Points(burstGeometry, burstMaterial);
scene.add(burstPoints);

function emitBurst() {
  for (let i = 0; i < burstCount; i += 1) {
    const direction = new THREE.Vector3().randomDirection();
    const velocity = burstVelocities[i];
    velocity.copy(direction).multiplyScalar(THREE.MathUtils.randFloat(0.03, 0.12));
    burstPositions[i * 3 + 0] = core.position.x;
    burstPositions[i * 3 + 1] = core.position.y;
    burstPositions[i * 3 + 2] = core.position.z;
    burstLife[i] = THREE.MathUtils.randFloat(0.7, 1.2);
  }
  burstGeometry.attributes.position.needsUpdate = true;
}

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.55);
const pointerProjection = new THREE.Vector3();
const floorPointerTarget = new THREE.Vector2();
let hovered = false;

const audioEngine = {
  context: null,
  master: null,
  filter: null,
  oscA: null,
  oscB: null,
  lfo: null,
  lfoGain: null,
};

function setStatus(text) {
  statusText.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    statusText.textContent = state.zen
      ? 'Zen mode active'
      : state.audioEnabled
        ? 'Sculpture humming softly'
        : 'Interactive sculpture online';
  }, 2400);
}

function updateUiState() {
  modeButton.textContent = 'Shift mood';
  driftButton.textContent = state.drift ? 'Drift on' : 'Drift off';
  soundButton.textContent = state.audioEnabled ? 'Mute sound' : 'Enable sound';
  zenButton.textContent = state.zen ? 'Exit zen' : 'Zen mode';
  chipDrift.textContent = state.drift ? 'Drift on' : 'Drift off';
  chipAudio.textContent = state.audioEnabled ? 'Sound on' : 'Sound off';
  chipZen.textContent = state.zen ? 'UI hidden' : 'UI visible';
  document.body.classList.toggle('zen', state.zen);
}

function setupAudio() {
  if (audioEngine.context) return audioEngine;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    setStatus('Audio API not available in this browser');
    return null;
  }

  const context = new AudioCtx();
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  const oscA = context.createOscillator();
  const oscB = context.createOscillator();
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();

  master.gain.value = 0.0001;
  filter.type = 'lowpass';
  filter.frequency.value = 680;
  filter.Q.value = 4;

  oscA.type = 'triangle';
  oscB.type = 'sine';
  lfo.type = 'sine';

  oscA.frequency.value = modes[0].audioBase;
  oscB.frequency.value = modes[0].audioBase * 1.5;
  lfo.frequency.value = 0.09;
  lfoGain.gain.value = 160;

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(master);
  master.connect(context.destination);

  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  oscA.start();
  oscB.start();
  lfo.start();

  Object.assign(audioEngine, { context, master, filter, oscA, oscB, lfo, lfoGain });
  return audioEngine;
}

async function toggleAudio() {
  const engine = setupAudio();
  if (!engine) return;

  await engine.context.resume();
  state.audioEnabled = !state.audioEnabled;
  const now = engine.context.currentTime;
  engine.master.gain.cancelScheduledValues(now);
  engine.master.gain.setTargetAtTime(state.audioEnabled ? 0.045 : 0.0001, now, 0.3);
  setStatus(state.audioEnabled ? 'Generative hum enabled' : 'Sound muted');
  updateUiState();
}

function updateAudioForMode(mode) {
  const engine = audioEngine.context ? audioEngine : null;
  if (!engine) return;

  const now = engine.context.currentTime;
  engine.oscA.frequency.setTargetAtTime(mode.audioBase, now, 0.4);
  engine.oscB.frequency.setTargetAtTime(mode.audioBase * 1.5, now, 0.4);
  engine.filter.frequency.setTargetAtTime(620 + mode.speed * 280, now, 0.4);
  engine.lfoGain.gain.setTargetAtTime(120 + mode.bloom * 160, now, 0.6);
}

function updateGroundPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.raw.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.raw.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  pointer.screen.set((clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height);

  raycaster.setFromCamera(pointer.raw, camera);
  if (raycaster.ray.intersectPlane(groundPlane, pointerProjection)) {
    pointer.world.copy(pointerProjection);
  }
}

function triggerCorePulse() {
  state.pulseStrength = 1.25;
  state.warp = 1;
  emitBurst();
  finalPass.uniforms.pulseOrigin.value.copy(pointer.screen);
  setMode(modeIndex + 1, true);
  setStatus('Mood shifted');
}

function onPointerMove(event) {
  updateGroundPoint(event.clientX, event.clientY);

  raycaster.setFromCamera(pointer.raw, camera);
  hovered = raycaster.intersectObject(core, false).length > 0;
  document.body.style.cursor = hovered ? 'pointer' : 'default';
}

function onPointerDown(event) {
  updateGroundPoint(event.clientX, event.clientY);
  raycaster.setFromCamera(pointer.raw, camera);

  if (raycaster.intersectObject(core, false).length > 0) {
    triggerCorePulse();
  }
}

function onTouchStart(event) {
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    updateGroundPoint(touch.clientX, touch.clientY);
    triggerCorePulse();
  }
}

function toggleDrift() {
  state.drift = !state.drift;
  setStatus(state.drift ? 'Camera drift engaged' : 'Camera drift paused');
  updateUiState();
}

function toggleZen() {
  state.zen = !state.zen;
  setStatus(state.zen ? 'Zen mode engaged' : 'Zen mode disabled');
  updateUiState();
}

function captureFrame() {
  composer.render();
  const link = document.createElement('a');
  link.href = renderer.domElement.toDataURL('image/png');
  link.download = `taste-nocturne-${modes[modeIndex].name.toLowerCase().replace(/\s+/g, '-')}.png`;
  link.click();
  setStatus('Frame captured');
}

window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('touchstart', onTouchStart, { passive: true });
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM') {
    triggerCorePulse();
  }
  if (event.code === 'KeyD') {
    toggleDrift();
  }
  if (event.code === 'KeyH') {
    toggleZen();
  }
  if (event.code === 'KeyS') {
    toggleAudio();
  }
  if (event.code === 'KeyP') {
    captureFrame();
  }
});
modeButton.addEventListener('click', triggerCorePulse);
driftButton.addEventListener('click', toggleDrift);
soundButton.addEventListener('click', toggleAudio);
captureButton.addEventListener('click', captureFrame);
zenButton.addEventListener('click', toggleZen);

function setMode(index, withPulse = false) {
  modeIndex = ((index % modes.length) + modes.length) % modes.length;
  const mode = modes[modeIndex];

  sculptureUniforms.uColorA.value.copy(mode.colorA);
  sculptureUniforms.uColorB.value.copy(mode.colorB);
  sculptureUniforms.uMorph.value = mode.speed;
  floorUniforms.uColorA.value.copy(mode.floorA);
  floorUniforms.uColorB.value.copy(mode.floorB);
  atmosphereUniforms.uTop.value.copy(mode.atmosphereB);
  atmosphereUniforms.uBottom.value.copy(mode.atmosphereA);

  bloomPass.strength = mode.bloom;
  finalPass.uniforms.amount.value = mode.aberration;
  modeName.textContent = mode.name;

  ambience.color.copy(mode.colorA).lerp(mode.colorB, 0.4);
  fillLight.color.copy(mode.colorB);
  keyLight.color.copy(mode.colorA);
  aura.material.color.copy(mode.colorB);
  pointerRing.material.color.copy(mode.colorA).lerp(mode.colorB, 0.3);
  pointerTrail.material.color.copy(mode.colorA).lerp(mode.colorB, 0.2);

  document.documentElement.style.setProperty('--glow', `${mode.accent}30`);
  modeButton.style.boxShadow = `0 0 0 1px ${mode.accent}20, 0 0 24px ${mode.accent}25`;
  updateAudioForMode(mode);

  if (withPulse) {
    state.pulseStrength = 1.25;
    state.warp = 1;
  }
}

setMode(0);
updateUiState();

const clock = new THREE.Clock();

function tick() {
  const elapsedTime = clock.getElapsedTime();
  const delta = clock.getDelta();
  const activeMode = modes[modeIndex];

  pointer.smooth.lerp(pointer.raw, 0.08);
  floorPointerTarget.set(pointer.world.x, pointer.world.z);
  floorUniforms.uPointer.value.lerp(floorPointerTarget, 0.08);

  sculptureUniforms.uTime.value = elapsedTime;
  floorUniforms.uTime.value = elapsedTime;
  atmosphereUniforms.uTime.value = elapsedTime;
  finalPass.uniforms.time.value = elapsedTime;

  state.pulseStrength = THREE.MathUtils.lerp(state.pulseStrength, 0, 0.06);
  state.warp = THREE.MathUtils.lerp(state.warp, 0, 0.08);
  sculptureUniforms.uPulse.value = state.pulseStrength;
  sculptureUniforms.uHover.value = THREE.MathUtils.lerp(
    sculptureUniforms.uHover.value,
    hovered ? 1 : 0,
    0.08,
  );
  finalPass.uniforms.warp.value = state.warp;

  const driftX = state.drift && !state.userOrbiting ? Math.sin(elapsedTime * 0.18) * 0.42 : 0;
  const driftY = state.drift && !state.userOrbiting ? Math.cos(elapsedTime * 0.14) * 0.12 : 0;
  const targetCamX = pointer.smooth.x * 0.52 + driftX;
  const targetCamY = 1.04 + pointer.smooth.y * 0.18 + driftY;
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.02);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.02);

  pointerLight.position.x = THREE.MathUtils.lerp(pointerLight.position.x, pointer.world.x * 0.45, 0.08);
  pointerLight.position.y = THREE.MathUtils.lerp(pointerLight.position.y, 0.6, 0.08);
  pointerLight.position.z = THREE.MathUtils.lerp(pointerLight.position.z, 1.8 + pointer.world.z * 0.18, 0.08);
  pointerLight.color.copy(activeMode.colorB).lerp(activeMode.colorA, 0.35);
  pointerLight.intensity = 1.1 + state.pulseStrength * 0.45;

  mainGroup.rotation.y = elapsedTime * 0.12;
  core.rotation.x = elapsedTime * 0.13;
  core.rotation.y = elapsedTime * (0.18 + activeMode.speed * 0.12);
  aura.rotation.y = -elapsedTime * 0.14;
  aura.rotation.x = elapsedTime * 0.08;
  aura.scale.setScalar(1 + state.pulseStrength * 0.15 + Math.sin(elapsedTime * 1.2) * 0.02);
  shell.rotation.z = elapsedTime * 0.08;
  shell2.rotation.y = -elapsedTime * 0.05;
  orbitGroup.rotation.y += 0.0036 + activeMode.speed * 0.0015;
  orbitGroup.rotation.z = Math.sin(elapsedTime * 0.3) * 0.1;

  orbitNodes.forEach((node, index) => {
    const { angle, radius, lift, wobble } = node.userData;
    const t = elapsedTime * (0.45 + activeMode.speed * 0.3) + angle;
    const ringRadius = radius + Math.sin(elapsedTime * wobble + index) * 0.14;
    node.position.set(
      Math.cos(t) * ringRadius,
      Math.sin(t * 1.5 + index) * activeMode.orbitLift + lift,
      Math.sin(t) * ringRadius,
    );
    node.lookAt(core.position);
    node.rotateX(Math.PI / 2);
  });

  particles.rotation.y = elapsedTime * 0.018;
  particles.rotation.x = Math.sin(elapsedTime * 0.04) * 0.08;

  shootingStars.forEach((star) => {
    star.position.add(star.userData.velocity);
    star.material.opacity = Math.max(0, Math.min(0.65, star.userData.life / 90));
    star.userData.life -= 1;
    if (star.userData.life <= 0 || star.position.x > 12 || star.position.y < 1.8) {
      resetShootingStar(star);
    }
  });

  pointerRing.position.x = THREE.MathUtils.lerp(pointerRing.position.x, pointer.world.x, 0.18);
  pointerRing.position.z = THREE.MathUtils.lerp(pointerRing.position.z, pointer.world.z, 0.18);
  const pointerScale = 1 + Math.sin(elapsedTime * 3.2) * 0.08 + state.pulseStrength * 1.3;
  pointerRing.scale.setScalar(pointerScale);
  pointerRing.material.opacity = 0.16 + state.pulseStrength * 0.18;

  pointerTrailPoints.unshift(new THREE.Vector3(pointer.world.x, -1.48 + Math.sin(elapsedTime * 4.0) * 0.02, pointer.world.z));
  pointerTrailPoints.pop();
  pointerTrailPoints.forEach((point, index) => {
    pointerTrailPositions[index * 3 + 0] = point.x;
    pointerTrailPositions[index * 3 + 1] = point.y;
    pointerTrailPositions[index * 3 + 2] = point.z;
  });
  pointerTrailGeometry.attributes.position.needsUpdate = true;

  for (let i = 0; i < burstCount; i += 1) {
    if (burstLife[i] <= 0) continue;
    burstLife[i] -= delta * 1.8;
    burstPositions[i * 3 + 0] += burstVelocities[i].x;
    burstPositions[i * 3 + 1] += burstVelocities[i].y;
    burstPositions[i * 3 + 2] += burstVelocities[i].z;
    burstVelocities[i].multiplyScalar(0.985);
  }
  burstGeometry.attributes.position.needsUpdate = true;
  burstMaterial.opacity = 0.2 + Math.min(0.9, state.pulseStrength * 0.7);

  if (audioEngine.context && state.audioEnabled) {
    const now = audioEngine.context.currentTime;
    const energy = 650 + state.pulseStrength * 800 + activeMode.speed * 220;
    audioEngine.filter.frequency.setTargetAtTime(energy, now, 0.08);
    audioEngine.master.gain.setTargetAtTime(0.035 + state.pulseStrength * 0.03, now, 0.08);
  }

  controls.target.x = THREE.MathUtils.lerp(
    controls.target.x,
    pointer.smooth.x * 0.22 + (state.drift && !state.userOrbiting ? Math.sin(elapsedTime * 0.18) * 0.08 : 0),
    0.05,
  );
  controls.target.y = THREE.MathUtils.lerp(
    controls.target.y,
    -0.12 + pointer.smooth.y * 0.08 + (state.drift && !state.userOrbiting ? Math.cos(elapsedTime * 0.22) * 0.03 : 0),
    0.05,
  );
  controls.update();

  composer.render();
  requestAnimationFrame(tick);
}

tick();

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(sizes.pixelRatio);

  composer.setSize(sizes.width, sizes.height);
  composer.setPixelRatio(sizes.pixelRatio);
  bloomPass.resolution.set(sizes.width, sizes.height);
  finalPass.uniforms.resolution.value.set(sizes.width, sizes.height);
});
