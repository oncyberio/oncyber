import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createPadelEnclosureView } from "./enclosure-view.js";

const BLUE = 0x2063ed;
const RED = 0xef6b61;
const INK = 0x152b3a;
const IVORY = 0xf4eddc;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// The venue is static: bake fixtures into material groups instead of submitting
// one draw per chair, leaf, court stripe, fence rail, or architectural slat.
function batchVenue(root, keep) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((mesh) => {
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const signature = Object.entries(mesh.geometry.attributes)
      .map(([key, value]) => `${key}:${value.itemSize}`)
      .sort()
      .join("|");
    const key = `${mesh.parent.uuid}:${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${signature}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  });
  let before = 0;
  let after = 0;
  for (const meshes of groups.values()) {
    before += meshes.length;
    after++;
    if (meshes.length === 1) continue;
    const parent = meshes[0].parent;
    const inverse = parent.matrixWorld.clone().invert();
    const parts = meshes.map((mesh) => {
      const part = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      part.applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
      );
      return part;
    });
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (!geometry) {
      after += meshes.length - 1;
      continue;
    }
    geometry.computeBoundingSphere();
    const merged = new THREE.Mesh(keep(geometry), meshes[0].material);
    merged.name = "Padel club · static material batch";
    merged.castShadow = meshes[0].castShadow;
    merged.receiveShadow = meshes[0].receiveShadow;
    parent.add(merged);
    for (const mesh of meshes) mesh.removeFromParent();
  }
  return { before, after };
}

function courtTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  const data = context.createImageData(128, 128);
  const random = randomSequence(805);
  for (let i = 0; i < data.data.length; i += 4) {
    const color = 236 + Math.floor(random() * 20);
    data.data[i] = data.data[i + 1] = data.data[i + 2] = color;
    data.data[i + 3] = 255;
  }
  context.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(24, 36);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Filter the markings as part of the lit surface. Thin, separate line meshes
// sparkle at the baseline camera angle even with multisample antialiasing.
function paintCourt(material) {
  const colors = {
    playing: new THREE.Color(0x206bc3),
    surround: new THREE.Color(0x214f81),
    runoff: new THREE.Color(0xd5c6b2),
    marking: new THREE.Color(0xf6f1e4),
  };
  material.onBeforeCompile = (shader) => {
    for (const [name, value] of Object.entries(colors))
      shader.uniforms[`court_${name}`] = { value };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 courtCoordinate; varying vec2 vCourt;"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvCourt=courtCoordinate;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec2 vCourt;
        uniform vec3 court_playing;
        uniform vec3 court_surround;
        uniform vec3 court_runoff;
        uniform vec3 court_marking;
        float courtRect(vec2 center,vec2 size){
          vec2 edge=abs(vCourt-center)-size*.5;
          vec2 aa=max(fwidth(vCourt)*.65,vec2(.001));
          vec2 mask=1.-smoothstep(-aa,aa,edge);
          return mask.x*mask.y;
        }`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 pigment=mix(court_runoff,court_surround,courtRect(vec2(0.),vec2(10.28,20.28)));
        pigment=mix(pigment,court_playing,courtRect(vec2(0.),vec2(10.,20.)));
        float ink=0.;
        // Padel's only painted lines are the two service lines and center lines.
        ink=max(ink,courtRect(vec2(0.,-6.95),vec2(10.,.05)));
        ink=max(ink,courtRect(vec2(0.,6.95),vec2(10.,.05)));
        ink=max(ink,courtRect(vec2(0.),vec2(.05,14.3)));
        diffuseColor.rgb*=mix(pigment,court_marking,ink);
      `
      );
  };
  material.customProgramCacheKey = () => "padel-court-filtered-markings-v1";
  return material;
}

function weaveMaterial(color, spacing, thickness, opacity) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      color: { value: new THREE.Color(color) },
      spacing: { value: spacing },
      thickness: { value: thickness },
      opacity: { value: opacity },
    },
    vertexShader: `attribute vec2 weaveCoord; varying vec2 vWeave;
      void main(){vWeave=weaveCoord;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vWeave; uniform vec3 color;
      uniform float spacing; uniform float thickness; uniform float opacity;
      void main(){
        vec2 pixel=max(fwidth(vWeave),vec2(.0001));
        vec2 distanceToThread=abs(fract(vWeave/spacing+.5)-.5)*spacing;
        vec2 thread=1.-smoothstep(vec2(thickness)-pixel*.65,vec2(thickness)+pixel*.65,distanceToThread);
        float coverage=max(thread.x,thread.y);
        float distant=smoothstep(spacing*.35,spacing*.85,max(pixel.x,pixel.y));
        coverage=mix(coverage,clamp(4.*thickness/spacing,0.,1.),distant);
        gl_FragColor=vec4(color,coverage*opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Glasshouse: a doubles padel court inside an open-air coastal club. */
export function build(scene) {
  const root = new THREE.Group();
  root.name = "Glasshouse · padel court one";
  scene.add(root);
  const resources = new Set();
  const cache = new Map();
  const keep = (resource) => {
    resources.add(resource);
    return resource;
  };
  const geometry = (key, create) => {
    if (!cache.has(key)) cache.set(key, keep(create()));
    return cache.get(key);
  };
  const material = (color, props = {}) =>
    keep(new THREE.MeshStandardMaterial({ color, roughness: 0.83, ...props }));
  const basic = (color, props = {}) =>
    keep(new THREE.MeshBasicMaterial({ color, ...props }));
  const stone = material(0xd9d1c4);
  const white = material(IVORY);
  const navy = material(INK);
  const steel = material(0x314654, { metalness: 0.35, roughness: 0.55 });
  const red = material(RED);
  const blue = material(BLUE);
  const wood = material(0x986e52);
  const leaf = [material(0x426f61), material(0x5f896c), material(0x7b9478)];
  const warmLight = basic(0xffdeb0);
  const paintedCourt = paintCourt(
    material(0xffffff, { map: keep(courtTexture()), roughness: 0.96 })
  );
  const nearEnclosure = new THREE.Group();
  nearEnclosure.name = "Padel · near rear enclosure";
  root.add(nearEnclosure);
  let activePart = root;
  const mesh = (geo, mat, x, y, z, shadow = true) => {
    const object = new THREE.Mesh(geo, mat);
    object.position.set(x, y, z);
    object.castShadow = shadow;
    object.receiveShadow = true;
    activePart.add(object);
    return object;
  };
  const box = (w, h, d, mat, x, y, z, shadow = true) =>
    mesh(
      geometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
      mat,
      x,
      y,
      z,
      shadow
    );
  const cylinder = (r, h, mat, x, y, z, shadow = true) =>
    mesh(
      geometry(`cyl:${r}:${h}`, () => new THREE.CylinderGeometry(r, r, h, 12)),
      mat,
      x,
      y,
      z,
      shadow
    );
  const bar = (from, to, radius, mat, shadow = false) => {
    const start = new THREE.Vector3(...from);
    const delta = new THREE.Vector3(...to).sub(start);
    const object = cylinder(radius, 1, mat, 0, 0, 0, shadow);
    object.position.copy(start).addScaledVector(delta, 0.5);
    object.scale.y = delta.length();
    object.quaternion.setFromUnitVectors(UP, delta.normalize());
    return object;
  };
  const floor = (w, d, mat, x, y, z) => {
    const object = mesh(
      geometry(`floor:${w}:${d}`, () => new THREE.PlaneGeometry(w, d)),
      mat,
      x,
      y,
      z,
      false
    );
    object.rotation.x = -Math.PI / 2;
    return object;
  };
  const roundedFloor = (w, d, radius, mat, x, y, z) => {
    const geo = geometry(`rounded:${w}:${d}:${radius}`, () => {
      const shape = new THREE.Shape();
      const a = -w / 2,
        b = -d / 2,
        r = radius;
      shape.moveTo(a + r, b);
      shape.lineTo(a + w - r, b);
      shape.quadraticCurveTo(a + w, b, a + w, b + r);
      shape.lineTo(a + w, b + d - r);
      shape.quadraticCurveTo(a + w, b + d, a + w - r, b + d);
      shape.lineTo(a + r, b + d);
      shape.quadraticCurveTo(a, b + d, a, b + d - r);
      shape.lineTo(a, b + r);
      shape.quadraticCurveTo(a, b, a + r, b);
      return new THREE.ShapeGeometry(shape, 10);
    });
    const object = mesh(geo, mat, x, y, z, false);
    object.rotation.x = -Math.PI / 2;
    return object;
  };
  const weave = (w, h, mat, x, z, bottom = 0, sag = null) => {
    const geo = keep(new THREE.PlaneGeometry(w, h, sag ? 48 : 1, 1));
    const position = geo.attributes.position;
    const coordinates = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i);
      const y = (position.getY(i) + h / 2) * (sag ? sag(px) / h : 1);
      position.setY(i, y);
      coordinates.set([px + w / 2, y], i * 2);
    }
    geo.setAttribute("weaveCoord", new THREE.BufferAttribute(coordinates, 2));
    geo.computeBoundingSphere();
    const object = mesh(geo, mat, x, bottom, z, false);
    object.receiveShadow = false;
    return object;
  };
  const label = (text, w, h, x, y, z, color = "#f4eddc") => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.font = "600 64px Arial";
    context.fillText(text, 512, 68);
    const texture = keep(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return mesh(
      geometry(`label:${w}:${h}`, () => new THREE.PlaneGeometry(w, h)),
      basic(0xffffff, { map: texture, transparent: true, depthWrite: false }),
      x,
      y,
      z,
      false
    );
  };

  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const background = new THREE.Color(0xd7dfdd);
  const fog = new THREE.Fog(0xd7dfdd, 38, 100);
  scene.background = background;
  scene.fog = fog;
  const skyMaterial = keep(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new THREE.Color(0x819eb6) },
        horizon: { value: new THREE.Color(0xf0dfcb) },
        travelVisibility: { value: 1 },
      },
      vertexShader: `varying float vHeight;void main(){vHeight=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float vHeight;uniform vec3 zenith;uniform vec3 horizon;uniform float travelVisibility;
      void main(){gl_FragColor=vec4(mix(horizon,zenith,smoothstep(.0,.9,vHeight))*travelVisibility,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
  );
  const sky = mesh(
    geometry("sky", () => new THREE.SphereGeometry(115, 32, 16)),
    skyMaterial,
    0,
    0,
    0,
    false
  );
  sky.receiveShadow = false;
  sky.renderOrder = -100;
  const ambient = new THREE.HemisphereLight(0xe4eef7, 0x806a62, 1.75);
  root.add(ambient);
  const sun = new THREE.DirectionalLight(0xffdfb4, 2.7);
  sun.position.set(-16, 23, -18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -17,
    right: 17,
    top: 22,
    bottom: -22,
    near: 1,
    far: 76,
  });
  sun.shadow.normalBias = 0.018;
  sun.shadow.bias = -0.00025;
  sun.shadow.radius = 2;
  root.add(sun, sun.target);

  floor(180, 180, material(0xa8b6a2), 0, -0.15, 0);
  roundedFloor(28, 38, 5, navy, 0, -0.075, 0);
  roundedFloor(27.7, 37.7, 4.85, stone, 0, -0.065, 0);
  roundedFloor(24, 33, 3.5, material(0xc6b8a4), 0, -0.05, 0);
  // One derivative-filtered painted surface avoids shimmering service lines.
  const playingSurface = floor(10.3, 20.3, paintedCourt, 0, 0, 0);
  const positions = playingSurface.geometry.attributes.position;
  const courtCoordinates = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    courtCoordinates[i * 2] = positions.getX(i);
    courtCoordinates[i * 2 + 1] = -positions.getY(i);
  }
  playingSurface.geometry.setAttribute(
    "courtCoordinate",
    new THREE.BufferAttribute(courtCoordinates, 2)
  );
  for (const x of [-5.16, 5.16]) {
    box(0.11, 0.025, 20.35, blue, x, 0.005, 0, false);
    for (const z of [-1.22, 1.22]) floor(1.55, 0.08, warmLight, x, 0.015, z);
  }
  for (const z of [-10.17, 10.17])
    box(10.43, 0.025, 0.11, red, 0, 0.005, z, false);

  const netHeight = (x) => 0.88 + 0.04 * (x / 5) ** 2;
  for (let i = 0; i < 32; i++) {
    const a = -5 + (i / 32) * 10,
      b = -5 + ((i + 1) / 32) * 10;
    bar([a, netHeight(a), 0], [b, netHeight(b), 0], 0.026, white);
  }
  weave(
    10,
    0.92,
    keep(weaveMaterial(0x172b38, 0.065, 0.0027, 0.75)),
    0,
    0,
    0,
    netHeight
  );
  for (const x of [-5, 5]) {
    cylinder(0.075, 1.02, navy, x, 0.51, 0);
    cylinder(0.08, 0.05, steel, x, 1.045, 0);
    box(0.11, 0.65, 0.11, blue, x, 0.38, 0);
  }
  box(0.045, 0.88, 0.035, white, 0, 0.44, 0.008, false);

  // Transparent panes retain the essential rebound silhouette without hiding
  // the ball or avatars from a camera outside the cage. No reflection pass.
  const glass = material(0x91c4da, {
    transparent: true,
    opacity: 0.085,
    metalness: 0.12,
    roughness: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const etched = basic(0xc9e4e7, {
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fenceMaterial = keep(weaveMaterial(0x536873, 0.15, 0.003, 0.3));
  function wall(from, to, { pane = true, bottom = 0, height = 3 } = {}) {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to);
    const length = a.distanceTo(b),
      center = a.clone().lerp(b, 0.5);
    const rotation = -Math.atan2(b.z - a.z, b.x - a.x);
    if (pane) {
      const sheet = mesh(
        geometry(
          `glass:${length}:${height}`,
          () => new THREE.PlaneGeometry(length, height)
        ),
        glass,
        center.x,
        bottom + height / 2,
        center.z,
        false
      );
      sheet.rotation.y = rotation;
      sheet.receiveShadow = false;
      // Discrete upper highlight and two small steel brackets per pane.
      bar(
        [a.x, bottom + height, a.z],
        [b.x, bottom + height, b.z],
        0.012,
        etched
      );
    } else {
      const fabric = weave(
        length,
        height,
        fenceMaterial,
        center.x,
        center.z,
        bottom
      );
      fabric.rotation.y = rotation;
    }
    for (const p of [a, b]) {
      cylinder(0.025, height, steel, p.x, bottom + height / 2, p.z, false);
      if (pane)
        for (const y of [0.25, 2.72])
          box(0.055, 0.09, 0.065, steel, p.x, y, p.z, false);
    }
  }
  for (const z of [-10, 10]) {
    activePart = z > 0 ? nearEnclosure : root;
    for (let x = -5; x < 5; x += 2) {
      wall([x, 0, z], [x + 2, 0, z]);
      wall([x, 0, z], [x + 2, 0, z], { pane: false, bottom: 3, height: 1 });
    }
    bar([-5, 4, z], [5, 4, z], 0.045, blue);
    for (const x of [-5, 5]) cylinder(0.065, 4, navy, x, 2, z);
  }
  activePart = root;
  for (const x of [-5, 5]) {
    for (const sign of [-1, 1]) {
      activePart = sign > 0 ? nearEnclosure : root;
      for (const z of [6, 8]) wall([x, 0, sign * z], [x, 0, sign * (z + 2)]);
      wall([x, 0, sign * 6], [x, 0, sign * 10], {
        pane: false,
        bottom: 3,
        height: 1,
      });
      bar([x, 4, sign * 6], [x, 4, sign * 10], 0.045, blue);
      activePart = root;
      wall([x, 0, sign * 2], [x, 0, sign * 6], { pane: false, height: 3 });
      bar([x, 3, sign * 2], [x, 3, sign * 6], 0.04, steel);
      cylinder(0.055, 3, navy, x, 1.5, sign * 2);
      // Walk-through gates on either side of the net: .45 < |z| < 2.
      bar([x, 2.45, sign * 0.45], [x, 2.45, sign * 2], 0.04, steel);
      cylinder(0.045, 2.45, steel, x, 1.225, sign * 0.45);
    }
    wall([x, 0, -0.45], [x, 0, 0.45], { pane: false, height: 2.45 });
  }

  // A warm, rounded clubhouse frames the far end; the open foreground gives
  // arriving groups room to settle before walking through the side gates.
  roundedFloor(18, 5.5, 1.7, white, 0, 0.01, -15.4);
  box(17, 3.1, 0.38, stone, 0, 1.55, -17.8);
  box(16.4, 2.45, 0.08, navy, 0, 1.7, -17.57, false);
  roundedFloor(19, 6.2, 1.8, navy, 0, 3.37, -15.5);
  roundedFloor(19.15, 6.35, 1.9, white, 0, 3.41, -15.5);
  // Underside of the canopy remains visible from the court.
  roundedFloor(18.9, 6.1, 1.75, navy, 0, 3.35, -15.5).rotation.x = Math.PI / 2;
  for (const x of [-8, 8]) cylinder(0.1, 3.35, steel, x, 1.675, -13.4);
  box(15.7, 0.035, 0.065, warmLight, 0, 3.31, -12.65, false);
  box(4.8, 0.95, 0.82, wood, -3.4, 0.48, -15.4);
  box(5, 0.09, 0.96, white, -3.4, 1.0, -15.4);
  for (let x = -5.7; x < -1; x += 0.25)
    box(0.035, 0.8, 0.035, stone, x, 0.48, -14.97, false);
  for (const x of [5.4, 7.1]) box(0.15, 2.6, 0.45, red, x, 1.35, -14.25);
  box(1.85, 0.15, 0.45, red, 6.25, 2.65, -14.25);
  label("G L A S S H O U S E", 8.5, 0.68, -1.8, 2.32, -17.48);
  label(
    "P A D E L   S O C I A L   C L U B",
    7.4,
    0.31,
    -1.8,
    1.73,
    -17.46,
    "#b7c4ca"
  );
  box(3.7, 0.68, 0.12, navy, 0, 0.36, -11.45, false);
  label("0 1   /   G L A S S H O U S E", 3.4, 0.31, 0, 0.4, -11.37, "#f5e6d4");
  const arrivalMark = label(
    "P A D E L   /   C O U R T   0 1",
    5.3,
    0.52,
    0,
    0.012,
    12.3,
    "#58646d"
  );
  arrivalMark.rotation.x = -Math.PI / 2;

  // Low spectator decks, paired social benches, and compact planters.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      const x = side * (8.1 + row * 1.12),
        h = 0.28 + row * 0.37;
      box(1.2, h, 8.4, stone, x, h / 2, -4.4);
      for (let seat = 0; seat < 7; seat++) {
        const z = -7.8 + seat * 1.12,
          mat = (seat + row) % 4 === 0 ? red : blue;
        box(0.6, 0.085, 0.63, mat, x, h + 0.3, z);
        box(0.07, 0.34, 0.63, mat, x + side * 0.28, h + 0.48, z);
        box(0.08, 0.28, 0.08, steel, x, h + 0.14, z);
      }
    }
    for (const z of [4, 8.4]) {
      for (let strip = -1; strip <= 1; strip++)
        box(0.17, 0.08, 2.8, wood, side * 7.7 + strip * 0.2, 0.52, z);
      box(0.08, 0.4, 2.8, wood, side * 8.02, 0.82, z);
      for (const dz of [-1.1, 1.1])
        box(0.5, 0.45, 0.11, navy, side * 7.7, 0.225, z + dz);
    }
    cylinder(0.24, 0.12, red, side * 7.7, 0.62, 4.5);
    cylinder(0.055, 0.21, white, side * 7.7, 0.66, 3.6);
  }
  // Light is geometry only: one sunlight shadow map for the whole venue.
  for (const x of [-6.5, 6.5])
    for (const z of [-8.2, 8.2]) {
      cylinder(0.065, 6.2, navy, x, 3.1, z);
      box(1.15, 0.11, 0.4, navy, x, 6.2, z);
      floor(1.03, 0.29, warmLight, x, 6.14, z).rotation.x = Math.PI / 2;
    }
  const crown = geometry(
    "tree-crown",
    () => new THREE.IcosahedronGeometry(1, 1)
  );
  const trunk = material(0x776b59),
    soil = material(0x5a564b),
    random = randomSequence(121);
  const trees = [
    [-12, -13, 1.3],
    [12, -13, 1.35],
    // Keep the foreground arrival and native trailing-camera corridor clear.
    // Trees frame the venue beyond the side decks, never the spawn terrace.
    [-16, -2, 0.9],
    [16, -2, 0.9],
    [-19, 8, 0.9],
    [19, 8, 0.9],
    [-18, -22, 1.6],
    [18, -22, 1.6],
    [-4, -23, 1.3],
    [6, -24, 1.6],
  ];
  for (const [x, z, size] of trees) {
    const h = 2.8 * size;
    cylinder(0.15 * size, h, trunk, x, h / 2, z);
    if (Math.abs(x) < 14) {
      cylinder(0.85, 0.38, stone, x, 0.16, z);
      cylinder(0.76, 0.025, soil, x, 0.36, z, false);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const canopy = mesh(
        crown,
        leaf[i],
        x + Math.cos(a) * size * 0.55,
        h + i * 0.3,
        z + Math.sin(a) * size * 0.55
      );
      canopy.scale.set(size * 1.35, size * (1.0 + random() * 0.3), size * 1.4);
      canopy.rotation.set(random(), random(), random());
    }
  }
  const distant = material(0x9faeab);
  for (const [x, w, h, z] of [
    [-25, 12, 5, -34],
    [-12, 9, 8, -39],
    [8, 12, 6, -42],
    [24, 11, 7, -38],
  ]) {
    box(w, h, 8, distant, x, h / 2 - 0.2, z, false);
    box(w + 0.3, 0.18, 8.3, stone, x, h - 0.2, z, false);
  }

  const metric = batchVenue(root, keep);
  const retained = new Set();
  root.traverse((object) => {
    if (object.geometry) retained.add(object.geometry);
  });
  for (const resource of resources)
    if (resource.isBufferGeometry && !retained.has(resource)) {
      resource.dispose();
      resources.delete(resource);
    }
  cache.clear();
  root.userData.staticBatches = metric;
  root.userData.courtBounds = {
    halfWidth: 5,
    halfLength: 10,
    sideGateMin: 0.45,
    sideGateMax: 2,
    glassHeight: 3,
    enclosureHeight: 4,
  };
  const enclosureView = createPadelEnclosureView({
    scene,
    rear: nearEnclosure,
  });
  let disposed = false;
  return {
    root,
    sky,
    metrics: metric,
    setView: enclosureView.setView,
    wallImpact: enclosureView.wallImpact,
    get viewState() {
      return enclosureView.viewState;
    },
    setTravelVisibility(value) {
      skyMaterial.uniforms.travelVisibility.value = clamp(value, 0, 1);
    },
    tick(dt) {
      enclosureView.tick(dt);
    },
    setQuality({ shadowMapSize = 2048, anisotropy = 8 } = {}) {
      const size = shadowMapSize >= 2048 ? 2048 : 1024;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        sun.shadow.mapSize.set(size, size);
        sun.shadow.needsUpdate = true;
      }
      for (const resource of resources)
        if (resource.isTexture) {
          resource.anisotropy = clamp(anisotropy, 1, 8);
          resource.needsUpdate = true;
        }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      enclosureView.dispose();
      root.removeFromParent();
      for (const resource of resources) resource.dispose?.();
      sun.shadow.dispose();
      if (scene.background === background)
        scene.background = previousBackground;
      if (scene.fog === fog) scene.fog = previousFog;
    },
  };
}

function feltTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(canvas.width, canvas.height);
  const random = randomSequence(890);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const angle = (x / canvas.width) * Math.PI * 2;
      const latitude = (y / canvas.height - 0.5) * Math.PI;
      const wave = Math.sin(angle * 2) * 0.4;
      const seam = Math.min(
        Math.abs(latitude - wave - 0.42),
        Math.abs(latitude - wave + 0.42)
      );
      const white = 1 - clamp((seam - 0.018) / 0.014, 0, 1);
      const grain = 0.94 + random() * 0.06;
      const offset = (y * canvas.width + x) * 4;
      pixels.data[offset] = (211 + white * 35) * grain;
      pixels.data[offset + 1] = (242 + white * 10) * grain;
      pixels.data[offset + 2] = (64 + white * 158) * grain;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A readable felt ball, short velocity trail, and height-sensitive ground shadow. */
export function createBall(scene) {
  const root = new THREE.Group();
  root.name = "Padel ball";
  scene.add(root);
  const visualRadius = 0.108;
  const geometry = new THREE.SphereGeometry(visualRadius, 24, 16);
  const ballMap = feltTexture();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: ballMap,
    emissive: 0x445600,
    emissiveIntensity: 0.18,
    roughness: 0.94,
    transparent: true,
    depthWrite: false,
  });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.castShadow = true;
  root.add(sphere);

  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { opacity: { value: 0.3 } },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:
      "varying vec2 vUv;uniform float opacity;void main(){float r=length(vUv-.5)*2.;float a=1.-smoothstep(.1,1.,r);gl_FragColor=vec4(.02,.04,.07,a*a*opacity);}",
  });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.name = "Padel ball · ground shadow";
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const trailCount = 18;
  const trailPosition = new Float32Array(trailCount * 3);
  const trailColors = new Float32Array(trailCount * 3);
  for (let i = 0; i < trailCount; i++) {
    const strength = 1 - i / trailCount;
    trailColors.set([0.83 * strength, 0.96 * strength, 0.35 * strength], i * 3);
  }
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trailPosition, 3)
  );
  trailGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(trailColors, 3)
  );
  const trailMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const trail = new THREE.Line(trailGeometry, trailMaterial);
  trail.name = "Padel ball · velocity trail";
  trail.frustumCulled = false;
  scene.add(trail);
  let initialized = false;
  let disposed = false;
  let elapsed = 0;
  const last = new THREE.Vector3();
  const spinAxis = new THREE.Vector3();
  const spinRotation = new THREE.Quaternion();
  return {
    root,
    update(ball, dt = 1 / 60) {
      if (disposed) return;
      const step = Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;
      const opacity =
        ball?.opacity == null
          ? 1
          : Number.isFinite(ball.opacity)
          ? clamp(ball.opacity, 0, 1)
          : 0;
      const visible =
        !!ball &&
        ball.visible !== false &&
        opacity > 0 &&
        Number.isFinite(ball.x) &&
        Number.isFinite(ball.y) &&
        Number.isFinite(ball.z);
      material.opacity = visible ? opacity : 0;
      root.visible = shadow.visible = trail.visible = visible;
      // The soft projected shadow below follows the complete fade. Do not leave
      // an opaque shadow-map silhouette behind a translucent or disappearing ball.
      sphere.castShadow = visible && opacity >= 0.999;
      if (!visible) {
        initialized = false;
        elapsed = 0;
        shadowMaterial.uniforms.opacity.value = 0;
        trailMaterial.opacity = 0;
        return;
      }
      // Keep the readable visual sphere above the floor even though the physical
      // collision radius is smaller. Both trail and shadow use this rendered pose.
      root.position.set(ball.x, Math.max(visualRadius, ball.y), ball.z);
      const vx = Number.isFinite(ball.vx) ? ball.vx : 0;
      const vy = Number.isFinite(ball.vy) ? ball.vy : 0;
      const vz = Number.isFinite(ball.vz) ? ball.vz : 0;
      const speed = Math.hypot(vx, vy, vz);
      const teleported =
        initialized && last.distanceToSquared(root.position) > 16;
      if (step > 0 && !teleported) {
        const rolling = ball.y <= visualRadius + 0.025;
        const dx = initialized ? root.position.x - last.x : vx * step;
        const dz = initialized ? root.position.z - last.z : vz * step;
        // Rolling uses traveled distance/radius, so braking and wall reversals
        // visibly slow or reverse the spin instead of continuing an idle twirl.
        const spinX = rolling ? dx : vx * step * 0.18;
        const spinZ = rolling ? dz : vz * step * 0.18;
        const distance = Math.hypot(spinX, spinZ);
        if (distance > 1e-8) {
          spinAxis.set(spinZ, 0, -spinX).normalize();
          spinRotation.setFromAxisAngle(spinAxis, distance / visualRadius);
          sphere.quaternion.premultiply(spinRotation).normalize();
        }
      }
      const height = root.position.y;
      const size = 0.22 + Math.min(0.75, height * 0.2);
      shadow.position.set(ball.x, 0.018, ball.z);
      shadow.scale.setScalar(size);
      shadowMaterial.uniforms.opacity.value =
        (0.44 / (1 + height * 0.34)) * opacity;
      if (!initialized || teleported || speed < 0.5) {
        for (let i = 0; i < trailCount; i++)
          trailPosition.set([root.position.x, height, root.position.z], i * 3);
        trailGeometry.attributes.position.needsUpdate = true;
        initialized = true;
        elapsed = 0;
      }
      elapsed += step;
      if (elapsed >= 1 / 90) {
        trailPosition.copyWithin(3, 0, (trailCount - 1) * 3);
        trailPosition.set([root.position.x, height, root.position.z], 0);
        trailGeometry.attributes.position.needsUpdate = true;
        elapsed %= 1 / 90;
      }
      trail.visible = visible && speed > 4;
      trailMaterial.opacity = clamp((speed - 4) / 20, 0, 0.72) * opacity;
      last.copy(root.position);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      shadow.removeFromParent();
      trail.removeFromParent();
      for (const resource of [
        geometry,
        material,
        ballMap,
        shadowGeometry,
        shadowMaterial,
        trailGeometry,
        trailMaterial,
      ])
        resource.dispose();
    },
  };
}

/** Aim, a bounded outgoing shot preview, and a reusable contact particle pool. */
export function createEffects(scene) {
  const root = new THREE.Group();
  root.name = "Padel shot feedback";
  scene.add(root);
  const aimMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      color: { value: new THREE.Color(0x5aabff) },
      power: { value: 0 },
      time: { value: 0 },
      quality: { value: 1 },
    },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 color;
      uniform float power;
      uniform float time;
      uniform float quality;
      void main(){
        vec2 p=(vUv-.5)*2.;
        float r=length(p);
        float aa=max(fwidth(r),.003);
        float angle=atan(p.y,p.x)+3.14159265;
        float ring=(1.-smoothstep(.022-aa,.022+aa,abs(r-.79)));
        float dotPattern=smoothstep(-.25,.1,sin(angle*12.));
        float fill=(1.-smoothstep(.1,.76,r))*.11;
        float arc=(1.-smoothstep(.02-aa,.02+aa,abs(r-.93)))*step(angle,6.2831853*power);
        float cross=(1.-smoothstep(.018,.035,min(abs(p.x),abs(p.y))))*(1.-smoothstep(.10,.18,r));
        float alpha=max(max(ring*mix(.45,1.,dotPattern),arc),cross)*.9+fill;
        vec3 tint=mix(color,vec3(1.),arc*.78+cross*.6);
        gl_FragColor=vec4(tint,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const aimGeometry = new THREE.PlaneGeometry(2, 2);
  const aim = new THREE.Mesh(aimGeometry, aimMaterial);
  aim.rotation.x = -Math.PI / 2;
  aim.position.y = 0.028;
  aim.renderOrder = 3;
  aim.visible = false;
  root.add(aim);

  const landingGeometry = new THREE.PlaneGeometry(1, 1);
  const landingMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 vUv;void main(){
      float r=length((vUv-.5)*2.);
      float aa=max(fwidth(r),.004);
      float ring=1.-smoothstep(.035-aa,.035+aa,abs(r-.8));
      float center=(1.-smoothstep(.04,.07,r))*.72;
      gl_FragColor=vec4(vec3(.88,.94,1.),max(ring*.7,center));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const landing = new THREE.Mesh(landingGeometry, landingMaterial);
  landing.rotation.x = -Math.PI / 2;
  landing.visible = false;
  root.add(landing);

  // A small reusable tube is legible from the low court camera as well as the
  // broadcast view. Its minimum screen width avoids platform-dependent 1px lines.
  const trajectoryPointLimit = 72;
  const trajectorySides = 8;
  const trajectoryVertices = trajectoryPointLimit * trajectorySides;
  const trajectoryPositions = new Float32Array(trajectoryVertices * 3);
  const trajectoryNormals = new Float32Array(trajectoryVertices * 3);
  const trajectoryDistances = new Float32Array(trajectoryVertices);
  const sampledTrajectory = new Float32Array(trajectoryPointLimit * 3);
  const sampledDistances = new Float32Array(trajectoryPointLimit);
  const trajectoryIndices = new Uint16Array(
    (trajectoryPointLimit - 1) * trajectorySides * 6
  );
  const radialCos = new Float32Array(trajectorySides);
  const radialSin = new Float32Array(trajectorySides);
  for (let side = 0; side < trajectorySides; side++) {
    radialCos[side] = Math.cos((side / trajectorySides) * Math.PI * 2);
    radialSin[side] = Math.sin((side / trajectorySides) * Math.PI * 2);
  }
  let triangle = 0;
  for (let point = 0; point < trajectoryPointLimit - 1; point++) {
    for (let side = 0; side < trajectorySides; side++) {
      const a = point * trajectorySides + side;
      const b = point * trajectorySides + ((side + 1) % trajectorySides);
      const c = a + trajectorySides,
        d = b + trajectorySides;
      trajectoryIndices.set([a, b, c, b, d, c], triangle);
      triangle += 6;
    }
  }
  const trajectoryGeometry = new THREE.BufferGeometry();
  trajectoryGeometry.setIndex(new THREE.BufferAttribute(trajectoryIndices, 1));
  trajectoryGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trajectoryPositions, 3).setUsage(
      THREE.DynamicDrawUsage
    )
  );
  trajectoryGeometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(trajectoryNormals, 3).setUsage(
      THREE.DynamicDrawUsage
    )
  );
  trajectoryGeometry.setAttribute(
    "pathDistance",
    new THREE.BufferAttribute(trajectoryDistances, 1).setUsage(
      THREE.DynamicDrawUsage
    )
  );
  trajectoryGeometry.setDrawRange(0, 0);
  const trajectoryUniforms = {
    tint: { value: new THREE.Color(0x8ec9ff) },
    time: { value: 0 },
    totalLength: { value: 1 },
    viewport: { value: new THREE.Vector2(1280, 720) },
  };
  function trajectoryMaterial(width, minPixels, opacity, glow) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...trajectoryUniforms,
        width: { value: width },
        minPixels: { value: minPixels },
        opacity: { value: opacity },
        glow: { value: glow },
      },
      vertexShader: `attribute float pathDistance;varying float vDistance;varying vec3 vNormal;
        uniform float width;uniform float minPixels;uniform float totalLength;uniform vec2 viewport;
        void main(){
          vec4 center=modelViewMatrix*vec4(position,1.);
          vec3 direction=normalize(normalMatrix*normal);
          float pixelRadius=minPixels*2.*abs(center.z)/max(.1,projectionMatrix[1][1]*viewport.y);
          float taper=.7+.3*sin(clamp(pathDistance/max(.001,totalLength),0.,1.)*3.14159265);
          center.xyz+=direction*max(width,pixelRadius)*taper;
          vDistance=pathDistance;vNormal=direction;
          gl_Position=projectionMatrix*center;
        }`,
      fragmentShader: `varying float vDistance;varying vec3 vNormal;
        uniform vec3 tint;uniform float time;uniform float totalLength;uniform float opacity;uniform float glow;
        void main(){
          float phase=fract(vDistance/.95-time*.28);
          float dash=1.-smoothstep(.64,.74,phase);
          float ends=smoothstep(0.,.18,vDistance)*smoothstep(0.,.2,totalLength-vDistance);
          float facing=abs(normalize(vNormal).z);
          float profile=mix(.55+.45*facing,smoothstep(.0,.85,facing),glow);
          gl_FragColor=vec4(mix(tint,vec3(1.),(1.-glow)*facing*.32),dash*ends*profile*opacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
  }
  const trajectoryCoreMaterial = trajectoryMaterial(0.032, 1.45, 0.9, 0);
  const trajectoryGlowMaterial = trajectoryMaterial(0.095, 3.4, 0.14, 1);
  const trajectoryCore = new THREE.Mesh(
    trajectoryGeometry,
    trajectoryCoreMaterial
  );
  const trajectoryGlow = new THREE.Mesh(
    trajectoryGeometry,
    trajectoryGlowMaterial
  );
  trajectoryCore.name = "Padel · outgoing shot trajectory";
  trajectoryGlow.name = "Padel · outgoing trajectory glow";
  for (const mesh of [trajectoryCore, trajectoryGlow]) {
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    mesh.onBeforeRender = (renderer) =>
      renderer.getSize(trajectoryUniforms.viewport.value);
    root.add(mesh);
  }
  const bounceGeometry = new THREE.PlaneGeometry(1.6, 1.6);
  const bounceMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { tint: trajectoryUniforms.tint, time: trajectoryUniforms.time },
    vertexShader: landingMaterial.vertexShader,
    fragmentShader: `varying vec2 vUv;uniform vec3 tint;uniform float time;
      void main(){
        vec2 p=(vUv-.5)*2.;float r=length(p);float aa=max(fwidth(r),.004);
        float ring=1.-smoothstep(.022-aa,.022+aa,abs(r-.68));
        float angle=atan(p.y,p.x);float brackets=smoothstep(.35,.65,cos(angle*4.));
        float outer=(1.-smoothstep(.035-aa,.035+aa,abs(r-.88)))*brackets;
        float center=1.-smoothstep(.045,.08,r);
        float fill=exp(-r*r/.18)*.1;
        float pulse=.86+.14*sin(time*3.);
        gl_FragColor=vec4(mix(tint,vec3(1.),center*.65),max(max(ring*.75,outer),center)*pulse+fill);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const bounceMarker = new THREE.Mesh(bounceGeometry, bounceMaterial);
  bounceMarker.name = "Padel · outgoing first bounce";
  bounceMarker.rotation.x = -Math.PI / 2;
  bounceMarker.renderOrder = 4;
  bounceMarker.visible = false;
  root.add(bounceMarker);
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  let trajectoryPointCount = 0,
    trajectoryRisky = false;
  const finitePoint = (point) =>
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z);
  function updateTrajectory(preview, step) {
    trajectoryCore.visible =
      trajectoryGlow.visible =
      bounceMarker.visible =
        false;
    trajectoryPointCount = 0;
    trajectoryGeometry.setDrawRange(0, 0);
    const prediction = preview?.trajectory;
    const points = prediction?.points;
    if (
      !preview?.active ||
      !(preview.charging || preview.committed) ||
      !Array.isArray(points) ||
      points.length < 2
    )
      return;
    const count = Math.min(trajectoryPointLimit, points.length);
    let distance = 0;
    for (let i = 0; i < count; i++) {
      const point = points[Math.round((i * (points.length - 1)) / (count - 1))];
      if (!finitePoint(point)) return;
      const offset = i * 3;
      sampledTrajectory[offset] = point.x;
      sampledTrajectory[offset + 1] = point.y;
      sampledTrajectory[offset + 2] = point.z;
      if (i > 0)
        distance += Math.hypot(
          point.x - sampledTrajectory[offset - 3],
          point.y - sampledTrajectory[offset - 2],
          point.z - sampledTrajectory[offset - 1]
        );
      sampledDistances[i] = distance;
    }
    if (!Number.isFinite(distance) || distance < 0.001) return;
    for (let i = 0; i < count; i++) {
      const offset = i * 3,
        before = Math.max(0, i - 1) * 3,
        after = Math.min(count - 1, i + 1) * 3;
      tangent.set(
        sampledTrajectory[after] - sampledTrajectory[before],
        sampledTrajectory[after + 1] - sampledTrajectory[before + 1],
        sampledTrajectory[after + 2] - sampledTrajectory[before + 2]
      );
      if (tangent.lengthSq() < 1e-10) tangent.set(0, 0, 1);
      tangent.normalize();
      normal.crossVectors(UP, tangent);
      if (normal.lengthSq() < 1e-8) normal.set(1, 0, 0);
      else normal.normalize();
      binormal.crossVectors(tangent, normal).normalize();
      for (let side = 0; side < trajectorySides; side++) {
        const vertex = i * trajectorySides + side,
          target = vertex * 3;
        for (let axis = 0; axis < 3; axis++)
          trajectoryPositions[target + axis] = sampledTrajectory[offset + axis];
        trajectoryNormals[target] =
          normal.x * radialCos[side] + binormal.x * radialSin[side];
        trajectoryNormals[target + 1] =
          normal.y * radialCos[side] + binormal.y * radialSin[side];
        trajectoryNormals[target + 2] =
          normal.z * radialCos[side] + binormal.z * radialSin[side];
        trajectoryDistances[vertex] = sampledDistances[i];
      }
    }
    trajectoryPointCount = count;
    trajectoryRisky = prediction.safe === false || prediction.blocked === true;
    trajectoryUniforms.tint.value.set(trajectoryRisky ? 0xff7868 : 0x8ec9ff);
    // Early charging still shows placement, with less visual weight until the
    // incoming contact can be predicted. Safe/risk coloring remains unchanged.
    trajectoryCoreMaterial.uniforms.opacity.value = prediction.estimated
      ? 0.72
      : 0.9;
    trajectoryGlowMaterial.uniforms.opacity.value = prediction.estimated
      ? 0.1
      : 0.14;
    trajectoryUniforms.time.value += step;
    trajectoryUniforms.totalLength.value = distance;
    trajectoryGeometry.setDrawRange(0, (count - 1) * trajectorySides * 6);
    trajectoryGeometry.attributes.position.needsUpdate = true;
    trajectoryGeometry.attributes.normal.needsUpdate = true;
    trajectoryGeometry.attributes.pathDistance.needsUpdate = true;
    trajectoryCore.visible = trajectoryGlow.visible = true;
    if (finitePoint(prediction.bounce)) {
      bounceMarker.position.set(
        prediction.bounce.x,
        0.036,
        prediction.bounce.z
      );
      bounceMarker.visible = true;
    }
  }

  // A quiet foot-placement cue makes the committed adjustment legible.
  const contactMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { opacity: { value: 0 } },
    vertexShader: landingMaterial.vertexShader,
    fragmentShader: `varying vec2 vUv;uniform float opacity;void main(){
      vec2 p=(vUv-.5)*2.;
      float r=length(p);
      float aa=max(fwidth(r),.004);
      float ring=1.-smoothstep(.025-aa,.025+aa,abs(r-.76));
      float angle=atan(p.y,p.x);
      float ticks=smoothstep(.6,.8,cos(angle*4.));
      float center=(1.-smoothstep(.02,.09,r))*.6;
      gl_FragColor=vec4(.32,.65,1.,max(ring*mix(.3,.85,ticks),center)*opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const contactMarker = new THREE.Mesh(landingGeometry, contactMaterial);
  contactMarker.rotation.x = -Math.PI / 2;
  contactMarker.scale.setScalar(1.5);
  contactMarker.visible = false;
  root.add(contactMarker);

  const particleCount = 48;
  const position = new Float32Array(particleCount * 3);
  const color = new Float32Array(particleCount * 3);
  const velocity = new Float32Array(particleCount * 3);
  const life = new Float32Array(particleCount);
  position.fill(-1000);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(position, 3)
  );
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.07,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  particleMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "diffuseColor.a*=1.-smoothstep(.10,.5,length(gl_PointCoord-.5));\n#include <opaque_fragment>"
    );
  };
  particleMaterial.customProgramCacheKey = () =>
    "rally-round-contact-points-v1";
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  root.add(particles);
  const random = randomSequence(907);
  let nextParticle = 0;
  let disposed = false;
  const targetColor = new THREE.Color();
  const goodColor = new THREE.Color(0xa8d1ff);
  const riskyColor = new THREE.Color(0xff685d);
  return {
    get trajectoryState() {
      return {
        visible: trajectoryCore.visible,
        pointCount: trajectoryPointCount,
        bounceVisible: bounceMarker.visible,
        risky: trajectoryRisky,
      };
    },
    update(dt, match, preview) {
      if (disposed) return;
      const step = Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;
      updateTrajectory(preview, step);
      aim.visible = !!preview?.active;
      landing.visible =
        !!preview?.active && !!preview.incoming && preview.incoming.z > 0;
      if (landing.visible)
        landing.position.set(preview.incoming.x, 0.024, preview.incoming.z);
      const placement = match.players[0].assistTarget;
      const tracking =
        preview?.active && placement && (preview.committed || preview.charging);
      contactMaterial.uniforms.opacity.value +=
        ((tracking ? 1 : 0) - contactMaterial.uniforms.opacity.value) *
        (1 - Math.exp(-step * 15));
      contactMarker.visible = contactMaterial.uniforms.opacity.value > 0.015;
      if (tracking) contactMarker.position.set(placement.x, 0.026, placement.z);
      if (aim.visible) {
        const quality = Number.isFinite(preview.quality)
          ? clamp(preview.quality, 0, 1)
          : 1;
        targetColor
          .copy(riskyColor)
          .lerp(goodColor, preview.safe === false ? 0 : quality);
        aimMaterial.uniforms.color.value.copy(targetColor);
        aimMaterial.uniforms.power.value = clamp(preview.power || 0, 0, 1);
        aimMaterial.uniforms.quality.value = quality;
        aimMaterial.uniforms.time.value += step;
        aim.position.set(preview.x || 0, 0.028, preview.z || -7);
        aim.scale.setScalar(clamp(preview.radius || 0.7, 0.55, 3));
      }
      let dirty = false;
      for (let i = 0; i < particleCount; i++) {
        if (life[i] <= 0) continue;
        dirty = true;
        life[i] -= step;
        const offset = i * 3;
        if (life[i] <= 0) {
          position[offset + 1] = -1000;
          continue;
        }
        velocity[offset + 1] -= step * 4.2;
        for (let axis = 0; axis < 3; axis++)
          position[offset + axis] += velocity[offset + axis] * step;
        const fade = clamp(life[i] / 0.42, 0, 1);
        color[offset] = fade;
        color[offset + 1] = fade * 0.91;
        color[offset + 2] = fade * 0.58;
      }
      if (dirty) {
        particleGeometry.attributes.position.needsUpdate = true;
        particleGeometry.attributes.color.needsUpdate = true;
      }
    },
    contact(event) {
      if (disposed) return;
      const point = event?.point || event?.position || event?.ball || event;
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z))
        return;
      const y = Number.isFinite(point.y) ? point.y : 0.2;
      const count = event?.type === "bounce" ? 5 : 12;
      for (let i = 0; i < count; i++) {
        const index = nextParticle++ % particleCount;
        const offset = index * 3;
        position.set([point.x, y, point.z], offset);
        const angle = random() * Math.PI * 2;
        const speed = 0.7 + random() * 2.5;
        velocity.set(
          [
            Math.cos(angle) * speed,
            0.3 + random() * 1.7,
            Math.sin(angle) * speed,
          ],
          offset
        );
        life[index] = 0.28 + random() * 0.18;
        color.set([1, 0.91, 0.58], offset);
      }
      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const resource of [
        aimMaterial,
        aimGeometry,
        particleGeometry,
        particleMaterial,
        landingGeometry,
        landingMaterial,
        contactMaterial,
        trajectoryGeometry,
        trajectoryCoreMaterial,
        trajectoryGlowMaterial,
        bounceGeometry,
        bounceMaterial,
      ])
        resource.dispose();
    },
  };
}
