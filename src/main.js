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

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
};

const pointer = {
  raw: new THREE.Vector2(0, 0),
  smooth: new THREE.Vector2(0, 0),
  world: new THREE.Vector3(0, -1.55, 0),
};

const modes = [
  {
    name: 'Velvet Pulse',
    colorA: new THREE.Color('#7dd3fc'),
    colorB: new THREE.Color('#c084fc'),
    floorA: new THREE.Color('#0c1023'),
    floorB: new THREE.Color('#11183b'),
    accent: '#dbeafe',
    bloom: 0.36,
    aberration: 0.012,
    speed: 0.55,
    orbitLift: 0.38,
  },
  {
    name: 'Ghost Orchid',
    colorA: new THREE.Color('#67e8f9'),
    colorB: new THREE.Color('#f9a8d4'),
    floorA: new THREE.Color('#091421'),
    floorB: new THREE.Color('#1a1435'),
    accent: '#f5f3ff',
    bloom: 0.5,
    aberration: 0.016,
    speed: 0.8,
    orbitLift: 0.5,
  },
  {
    name: 'Solar Ash',
    colorA: new THREE.Color('#f9c97d'),
    colorB: new THREE.Color('#fb7185'),
    floorA: new THREE.Color('#170f15'),
    floorB: new THREE.Color('#26171f'),
    accent: '#fff1d6',
    bloom: 0.42,
    aberration: 0.014,
    speed: 0.68,
    orbitLift: 0.44,
  },
];

let modeIndex = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#040610');
scene.fog = new THREE.FogExp2('#050816', 0.07);

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 60);
camera.position.set(0, 1.1, 6.8);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(sizes.pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.dampingFactor = 0.05;
controls.minDistance = 4.8;
controls.maxDistance = 8.8;
controls.minPolarAngle = Math.PI * 0.2;
controls.maxPolarAngle = Math.PI * 0.62;
controls.target.set(0, -0.1, 0);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  0.36,
  0.45,
  0.62,
);
composer.addPass(bloomPass);

const screenShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    amount: { value: 0.018 },
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
    uniform vec2 resolution;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float dist = dot(centered, centered);
      vec2 shift = centered * amount * (0.5 + dist * 1.8);

      float r = texture2D(tDiffuse, uv - shift).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv + shift).b;

      vec3 color = vec3(r, g, b);

      float vignette = smoothstep(1.18, 0.12, length(centered));
      float grain = random(uv * resolution.xy * 0.35 + time) - 0.5;
      float scan = sin((uv.y + time * 0.08) * resolution.y * 0.45) * 0.006;

      color += grain * 0.045;
      color += scan;
      color *= vignette;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

const finalPass = new ShaderPass(screenShader);
composer.addPass(finalPass);

const ambience = new THREE.AmbientLight('#bfc9ff', 0.65);
scene.add(ambience);

const keyLight = new THREE.DirectionalLight('#9ac5ff', 1.45);
keyLight.position.set(3.8, 4.5, 4.2);
scene.add(keyLight);

const fillLight = new THREE.PointLight('#ff9ad9', 1.15, 14, 2);
fillLight.position.set(-3, 0.5, 2.5);
scene.add(fillLight);

const pointerLight = new THREE.PointLight('#c4b5fd', 1.2, 10, 2);
pointerLight.position.set(0, 0.5, 2.2);
scene.add(pointerLight);

const mainGroup = new THREE.Group();
scene.add(mainGroup);

const sculptureUniforms = {
  uTime: { value: 0 },
  uColorA: { value: modes[0].colorA.clone() },
  uColorB: { value: modes[0].colorB.clone() },
  uHover: { value: 0 },
  uPulse: { value: 0 },
  uMorph: { value: 0.55 },
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
      float displacement = wave * 0.075 + ripple * 0.03 + uPulse * 0.08;
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
      color += fresnel * 0.18;
      color += uHover * 0.05;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
});

const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 6), sculptureMaterial);
core.position.y = -0.05;
mainGroup.add(core);

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
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
  }),
);
shell2.rotation.x = Math.PI * 0.6;
shell2.rotation.z = Math.PI * 0.22;
mainGroup.add(shell2);

const orbitGroup = new THREE.Group();
mainGroup.add(orbitGroup);
const orbitNodes = [];
const capsuleGeometry = new THREE.CapsuleGeometry(0.06, 0.42, 6, 12);

for (let i = 0; i < 18; i += 1) {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#f7fbff',
    transparent: true,
    opacity: 0.82,
    roughness: 0.1,
    metalness: 0,
    transmission: 0.95,
    thickness: 0.55,
  });

  const node = new THREE.Mesh(capsuleGeometry, material);
  node.userData = {
    angle: (i / 18) * Math.PI * 2,
    radius: 2.15 + Math.sin(i * 1.73) * 0.28,
    lift: (i % 2 === 0 ? 1 : -1) * (0.16 + Math.random() * 0.22),
    wobble: 0.4 + Math.random() * 0.6,
  };
  orbitGroup.add(node);
  orbitNodes.push(node);
}

const trailCount = 2400;
const trailPositions = new Float32Array(trailCount * 3);
for (let i = 0; i < trailCount; i += 1) {
  const radius = 4.5 + Math.random() * 6.5;
  const angle = Math.random() * Math.PI * 2;
  const height = (Math.random() - 0.5) * 5;

  trailPositions[i * 3 + 0] = Math.cos(angle) * radius;
  trailPositions[i * 3 + 1] = height;
  trailPositions[i * 3 + 2] = Math.sin(angle) * radius;
}

const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
const particles = new THREE.Points(
  particlesGeometry,
  new THREE.PointsMaterial({
    color: '#cbd5ff',
    size: 0.028,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }),
);
particles.position.y = 0.3;
scene.add(particles);

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

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.55);
const pointerProjection = new THREE.Vector3();
const floorPointerTarget = new THREE.Vector2();
let hovered = false;
let pulseStrength = 0;

function updateGroundPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.raw.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.raw.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer.raw, camera);
  if (raycaster.ray.intersectPlane(groundPlane, pointerProjection)) {
    pointer.world.copy(pointerProjection);
  }
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
    pulseStrength = 1.15;
    setMode(modeIndex + 1);
  }
}

function onTouchStart(event) {
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    updateGroundPoint(touch.clientX, touch.clientY);
    pulseStrength = 1.15;
    setMode(modeIndex + 1);
  }
}

window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('touchstart', onTouchStart, { passive: true });
modeButton.addEventListener('click', () => {
  pulseStrength = 1.15;
  setMode(modeIndex + 1);
});

function setMode(index) {
  modeIndex = ((index % modes.length) + modes.length) % modes.length;
  const mode = modes[modeIndex];

  sculptureUniforms.uColorA.value.copy(mode.colorA);
  sculptureUniforms.uColorB.value.copy(mode.colorB);
  sculptureUniforms.uMorph.value = mode.speed;
  floorUniforms.uColorA.value.copy(mode.floorA);
  floorUniforms.uColorB.value.copy(mode.floorB);

  bloomPass.strength = mode.bloom;
  finalPass.uniforms.amount.value = mode.aberration;
  modeName.textContent = mode.name;

  document.documentElement.style.setProperty('--fg', 'rgba(244, 247, 255, 0.95)');
  document.documentElement.style.setProperty('--muted', 'rgba(196, 205, 229, 0.72)');
  modeButton.style.boxShadow = `0 0 0 1px ${mode.accent}20, 0 0 24px ${mode.accent}25`;
}

setMode(0);

const clock = new THREE.Clock();

function tick() {
  const elapsedTime = clock.getElapsedTime();

  pointer.smooth.lerp(pointer.raw, 0.08);
  floorPointerTarget.set(pointer.world.x, pointer.world.z);
  floorUniforms.uPointer.value.lerp(floorPointerTarget, 0.08);

  sculptureUniforms.uTime.value = elapsedTime;
  floorUniforms.uTime.value = elapsedTime;
  finalPass.uniforms.time.value = elapsedTime;

  pulseStrength = THREE.MathUtils.lerp(pulseStrength, 0, 0.06);
  sculptureUniforms.uPulse.value = pulseStrength;
  sculptureUniforms.uHover.value = THREE.MathUtils.lerp(
    sculptureUniforms.uHover.value,
    hovered ? 1 : 0,
    0.08,
  );

  const activeMode = modes[modeIndex];
  const targetCamX = pointer.smooth.x * 0.55;
  const targetCamY = 1.1 + pointer.smooth.y * 0.2;
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.02);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.02);

  pointerLight.position.x = THREE.MathUtils.lerp(pointerLight.position.x, pointer.world.x * 0.45, 0.08);
  pointerLight.position.y = THREE.MathUtils.lerp(pointerLight.position.y, 0.6, 0.08);
  pointerLight.position.z = THREE.MathUtils.lerp(pointerLight.position.z, 1.8 + pointer.world.z * 0.18, 0.08);
  pointerLight.color.copy(activeMode.colorB).lerp(activeMode.colorA, 0.35);

  mainGroup.rotation.y = elapsedTime * 0.12;
  core.rotation.x = elapsedTime * 0.13;
  core.rotation.y = elapsedTime * (0.18 + activeMode.speed * 0.12);
  shell.rotation.z = elapsedTime * 0.08;
  shell2.rotation.y = -elapsedTime * 0.05;
  orbitGroup.rotation.y += 0.0035 + activeMode.speed * 0.0015;
  orbitGroup.rotation.z = Math.sin(elapsedTime * 0.3) * 0.1;

  orbitNodes.forEach((node, index) => {
    const { angle, radius, lift, wobble } = node.userData;
    const t = elapsedTime * (0.45 + activeMode.speed * 0.3) + angle;
    const ringRadius = radius + Math.sin(elapsedTime * wobble + index) * 0.12;
    node.position.set(
      Math.cos(t) * ringRadius,
      Math.sin(t * 1.5 + index) * activeMode.orbitLift + lift,
      Math.sin(t) * ringRadius,
    );
    node.lookAt(core.position);
    node.rotateX(Math.PI / 2);
  });

  particles.rotation.y = elapsedTime * 0.022;
  particles.rotation.x = Math.sin(elapsedTime * 0.05) * 0.08;

  controls.target.x = THREE.MathUtils.lerp(controls.target.x, pointer.smooth.x * 0.25, 0.05);
  controls.target.y = THREE.MathUtils.lerp(controls.target.y, -0.12 + pointer.smooth.y * 0.08, 0.05);
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
