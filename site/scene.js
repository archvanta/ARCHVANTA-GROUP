import * as THREE from './assets/three/three.module.min.js';

const defaultAngle = 0.67;
const positions = [[-3.7, .65], [0, -.05], [3.7, .65]];
const sharedGeometry = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 20, 14), cylinder: new THREE.CylinderGeometry(1, 1, 1, 20) };
const materials = new Map();

function shape(parent, kind, color, size, at, rotation = 0) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .83 }));
  const mesh = new THREE.Mesh(sharedGeometry[kind], materials.get(color));
  mesh.scale.set(...size);
  mesh.position.set(...at);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const box = (parent, color, size, at, rotation) => shape(parent, 'box', color, size, at, rotation);
const ball = (parent, color, size, at) => shape(parent, 'sphere', color, size, at);
const cylinder = (parent, color, size, at) => shape(parent, 'cylinder', color, size, at);

function desk(parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z - .79);
  parent.add(group);
  box(group, 0xf2eddf, [2.22, .13, 1.18], [0, .89, 0]);
  for (const a of [-.88, .88]) for (const b of [-.43, .43]) box(group, 0xa6b7ae, [.09, .85, .09], [a, .44, b]);
  box(group, 0xd5ded6, [.95, .58, .09], [-.14, 1.31, -.32]);
  box(group, 0x27464b, [.85, .47, .025], [-.14, 1.31, -.265]);
  for (let n = 0; n < 4; n += 1) box(group, n ? 0x96d4c1 : 0xd0e8cb, [.10, .09 + n * .055, .026], [-.37 + n * .13, 1.18 + n * .027, -.249]);
  box(group, 0x849b96, [.09, .22, .1], [-.14, 1.04, -.34]);
  box(group, 0x9ab1ad, [.41, .04, .18], [-.14, .97, -.30]);
  box(group, 0x9aaca7, [.55, .035, .21], [-.15, .98, .15]);
  cylinder(group, 0xb97852, [.09, .13, .09], [.69, 1.02, .08]);
}

function avatar(parent, x, z, shirt, hair) {
  const group = new THREE.Group();
  group.position.set(x, 0, z + .39);
  parent.add(group);
  cylinder(group, 0x8da09b, [.29, .07, .29], [0, .075, 0]);
  cylinder(group, 0xa9b9b5, [.058, .50, .058], [0, .28, 0]);
  box(group, 0xdce3d9, [.61, .13, .59], [0, .53, 0]);
  box(group, 0xcad6ce, [.59, .52, .09], [0, .79, .28]);
  ball(group, shirt, [.28, .32, .23], [0, .83, -.055]);
  for (const a of [-1, 1]) {
    ball(group, 0x435c64, [.092, .115, .25], [a * .12, .54, -.23]);
    ball(group, shirt, [.075, .135, .105], [a * .26, .85, -.14]);
    ball(group, 0xe4b390, [.071, .071, .095], [a * .26, .81, -.25]);
  }
  ball(group, 0xe8ba99, [.245, .26, .245], [0, 1.23, -.075]);
  ball(group, hair, [.258, .19, .265], [0, 1.31, -.013]);
  ball(group, hair, [.171, .118, .16], [-.14, 1.42, -.09]);
  const signal = cylinder(group, 0x9aadaa, [.085, .055, .085], [.44, .52, .23]);
  signal.material = signal.material.clone();
  return signal;
}

function plant(parent, x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  parent.add(group);
  cylinder(group, 0xddd1bd, [.31, .46, .31], [0, .23, 0]);
  cylinder(group, 0x857462, [.26, .02, .26], [0, .47, 0]);
  for (let n = 0; n < 7; n += 1) {
    const angle = n * 2.4;
    const leaf = ball(group, n % 2 ? 0x7e9c62 : 0x4c8067, [.10, .31, .125], [.18 * Math.sin(angle), .78 + n % 3 * .12, .19 * Math.cos(angle)]);
    leaf.rotation.x = .57 * Math.cos(angle);
    leaf.rotation.z = .65 * Math.sin(angle);
  }
}

function buildRoom(scene) {
  box(scene, 0xc6d3ca, [12.6, .21, 8.55], [0, -.28, 0]);
  box(scene, 0xe7e9e0, [12.4, .16, 8.35], [0, -.085, 0]);
  for (let z = -3.8; z < 4; z += .42) box(scene, 0xd7dfd6, [12.25, .002, .009], [0, -.003, z]);
  box(scene, 0xdfe9e1, [12.4, 1.83, .13], [0, .91, -4.12]);
  box(scene, 0xd4e2d8, [.13, 1.83, 3.9], [-6.12, .91, -2.18]);
  box(scene, 0xf2f5ed, [12.4, .11, .18], [0, 1.84, -4.12]);
  box(scene, 0xf2f5ed, [.18, .11, 3.96], [-6.12, 1.84, -2.18]);
  box(scene, 0xf6f8ef, [3.7, 1.15, .08], [.9, 1.09, -4.01]);
  for (let n = 0; n < 7; n += 1) {
    box(scene, 0xc4d9d1, [3.45, .008, .012], [.9, .58 + n * .16, -3.961]);
    box(scene, 0xb4cdc3, [.009, 1.0, .012], [-.72 + n * .5, 1.08, -3.96]);
  }
  box(scene, 0x6ea995, [2.0, .07, .016], [.92, 1.06, -3.94], 0);
  box(scene, 0x91b7ad, [2.35, .08, .06], [.87, .49, -3.94]);
  for (let n = 0; n < 4; n += 1) box(scene, 0xa7c0b5, [.62, .77, .44], [4.96 - n * .65, .39, -3.7]);
  plant(scene, -5.23, -3.30, 1.25);
  plant(scene, 5.25, 3.35, 1.18);
  plant(scene, -5.3, 2.7, .9);
  box(scene, 0xc3d7cf, [3.8, .019, 2.20], [-2.6, .013, 2.47]);
  box(scene, 0xf2efe6, [2.18, .45, .68], [-2.6, .29, 3.26]);
  box(scene, 0xe7e2d6, [2.18, .60, .22], [-2.6, .57, 3.54]);
  for (const a of [-3.63, -1.57]) box(scene, 0xe7e2d6, [.23, .56, .67], [a, .46, 3.26]);
  cylinder(scene, 0xb8a48f, [.48, .06, .43], [-2.6, .39, 2.28]);
  cylinder(scene, 0xa19384, [.075, .33, .075], [-2.6, .19, 2.28]);
  box(scene, 0xeaf0e7, [.25, .028, .16], [-2.54, .435, 2.27], .25);
  cylinder(scene, 0xd1b47b, [.25, .40, .25], [-.88, .22, 2.7]);
  box(scene, 0xd1e0d7, [3.20, .025, 2.20], [3.2, .015, 2.68]);
  const table = cylinder(scene, 0xe9e9dd, [1.05, .09, .68], [3.25, .56, 2.88]);
  table.rotation.y = -.12;
  cylinder(scene, 0x9aada4, [.14, .51, .14], [3.25, .28, 2.88]);
  for (const a of [2.04, 4.38]) {
    cylinder(scene, 0xabbeb6, [.27, .37, .27], [a, .2, 2.77]);
    cylinder(scene, 0x82a99b, [.29, .07, .29], [a, .41, 2.77]);
  }
}

export function createOfficeScene(root, onSelect) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute('aria-label', 'نمای سه‌بعدی دفتر و جایگاه عامل‌ها');
  renderer.domElement.setAttribute('role', 'img');
  root.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, .1, 70);
  scene.add(new THREE.HemisphereLight(0xf6faf5, 0xa3b8a9, 2.25));
  const sun = new THREE.DirectionalLight(0xfff3dd, 2.3);
  sun.position.set(-5, 11, 4);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, bottom: -8, top: 8 });
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .03;
  scene.add(sun);
  buildRoom(scene);
  const agents = positions.map(([x, z], index) => {
    desk(scene, x, z);
    const signal = avatar(scene, x, z, [0x518a79, 0x658ab2, 0xb57b54][index], [0x5c3c35, 0x31464a, 0x735741][index]);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'agent-map-label';
    button.addEventListener('click', () => onSelect(index));
    root.append(button);
    return { signal, button, anchor: new THREE.Vector3(x, 1.93, z + .36) };
  });
  let angle = defaultAngle;

  function render() {
    const { width, height } = root.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const halfWidth = 8.45;
    const halfHeight = Math.max(5.9, halfWidth / aspect);
    const right = halfHeight * aspect;
    Object.assign(camera, { left: -right, right, top: halfHeight, bottom: -halfHeight });
    camera.position.set(Math.sin(angle) * 17, 14, Math.cos(angle) * 17);
    camera.lookAt(0, .35, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
    for (const { button, anchor } of agents) {
      const point = anchor.clone().project(camera);
      button.style.left = `${(point.x * .5 + .5) * width}px`;
      button.style.top = `${(-point.y * .5 + .5) * height}px`;
    }
  }

  new ResizeObserver(render).observe(root);
  render();
  return {
    camera(direction) {
      angle = direction === 'reset' ? defaultAngle : angle + (direction === 'left' ? -.33 : .33);
      render();
    },
    agents(roles, selected) {
      for (const [{ signal, button }, role] of agents.map((agent, index) => [agent, roles[index]])) {
        button.textContent = role.short;
        button.setAttribute('aria-label', `${role.title}، ${role.status}`);
        button.setAttribute('aria-pressed', String(selected === role.index));
        button.dataset.state = role.state;
        signal.material.color.setHex({ working: 0x23bc83, waiting: 0xe6a44d, idle: 0x9aadaa }[role.state]);
      }
      render();
    },
  };
}
