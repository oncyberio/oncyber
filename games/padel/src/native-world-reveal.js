// Generated from Oncyber features/lobby/{worldCubeReveal,travelGlowTexture}.ts.
// Sync with: node worlds/padel/tools/sync-native-transition.mjs
// Shared native geometry transition; edit the source, not this bundle.

// ../oncyber/web/frontend/features/lobby/worldTileMotion.ts
var WORLD_TILE_SPAN = 0.28;
var WORLD_TILE_MAX_DELAY = 1 - WORLD_TILE_SPAN;
var CHARGE_END = 0.18;
var SETTLE_START = 0.84;
var finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
var clamp = (value) => Math.max(0, Math.min(1, finite(value)));
var smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
var random = (seed) => {
  const number = finite(seed), integer = Math.floor(number);
  let value = Math.imul(integer, 2654435761) ^ Math.floor((number - integer) * 4294967296);
  value = Math.imul(value ^ 2654435769, 2246822507);
  value = Math.imul(value ^ value >>> 13, 3266489909);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
};
function sampleWorldCell(progress, input, out = {
  offset: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
  glow: 0,
  visible: true,
  phase: "complete"
}) {
  const p = clamp(progress);
  const delay = Math.max(
    0,
    Math.min(WORLD_TILE_MAX_DELAY, finite(input.delay))
  );
  const phase = clamp((p - delay) / WORLD_TILE_SPAN);
  const local = p === 1 ? 1 : phase;
  out.offset.x = out.offset.y = out.offset.z = 0;
  out.rotation.x = out.rotation.y = out.rotation.z = 0;
  out.scale = 1;
  out.glow = 0;
  out.visible = true;
  out.phase = "complete";
  const nx = Math.abs(finite(input.surfaceNormal?.x));
  const ny = Math.abs(finite(input.surfaceNormal?.y));
  const nz = Math.abs(finite(input.surfaceNormal?.z));
  const secondAxis = random(input.seed + 43) >= 0.5;
  const axis = !input.surfaceNormal || ny >= nx && ny >= nz ? secondAxis ? "z" : "x" : nx >= nz ? secondAxis ? "z" : "y" : secondAxis ? "y" : "x";
  if (input.mode === "dissolve") {
    if (p === 0 || phase <= 0) return out;
    if (p === 1 || phase >= 1) {
      out.scale = 0;
      out.visible = false;
      out.phase = "hidden";
      return out;
    }
    const sign2 = random(input.seed) < 0.5 ? -1 : 1;
    out.rotation[axis] = sign2 * (Math.PI / 2) * smooth(phase);
    out.phase = "dissolve";
    return out;
  }
  if (local >= 1) return out;
  if (local <= 0) {
    out.scale = 0;
    out.visible = false;
    out.phase = "hidden";
    return out;
  }
  const size = Math.max(0.05, Math.min(8, finite(input.cellSize, 0.5)));
  const variation = random(input.seed), sign = variation < 0.5 ? -1 : 1;
  let dx = finite(input.center.x) - finite(input.anchor.x);
  let dz = finite(input.center.z) - finite(input.anchor.z);
  const distance = Math.hypot(dx, dz);
  if (distance > 1e-6) {
    dx /= distance;
    dz /= distance;
  } else {
    const angle = variation * Math.PI * 2;
    dx = Math.cos(angle);
    dz = Math.sin(angle);
  }
  const side = (random(input.seed + 17) - 0.5) * 0.16;
  const travel = Math.min(size * 0.22, 0.04);
  const lift = Math.min(size * 0.18, 0.04);
  const startX = travel * (dx - dz * side);
  const startZ = travel * (dz + dx * side);
  const quarterTurn = sign * Math.PI / 2;
  if (local < CHARGE_END) {
    out.phase = "charge";
    out.scale = smooth(local / CHARGE_END);
    out.glow = smooth(local / CHARGE_END);
    out.offset.x = startX;
    out.offset.y = lift;
    out.offset.z = startZ;
    out.rotation[axis] = quarterTurn;
    return out;
  }
  if (local < SETTLE_START) {
    out.phase = "assemble";
    const t2 = (local - CHARGE_END) / (SETTLE_START - CHARGE_END);
    const ease = smooth(t2), remaining = 1 - ease;
    out.offset.x = startX * remaining;
    out.offset.z = startZ * remaining;
    out.offset.y = lift * remaining + Math.min(size * 0.22, 0.04) * Math.sin(Math.PI * ease);
    out.rotation[axis] = quarterTurn * remaining;
    out.glow = 1 - smooth((local - CHARGE_END) / 0.52);
    return out;
  }
  out.phase = "settle";
  const t = (local - SETTLE_START) / (1 - SETTLE_START);
  const settle = Math.sin(Math.PI * t) ** 2;
  out.offset.y = -Math.min(size * 0.018, 8e-3) * settle;
  out.rotation[axis] = -sign * 0.025 * settle;
  return out;
}

// ../oncyber/web/frontend/features/lobby/worldRadialReveal.ts
var pointIsFinite = (p) => p && [p.x, p.y, p.z].every(Number.isFinite);
var clamp2 = (n) => Math.max(0, Math.min(1, n));
function spatialSeed(center) {
  const text = `${center.x.toFixed(6)}:${center.y.toFixed(
    6
  )}:${center.z.toFixed(6)}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0) / 4294967296;
}
function buildRadialCellSchedule(cells, anchor, options = {}) {
  if (!pointIsFinite(anchor))
    throw new Error("Reveal anchor needs finite coordinates.");
  const entries = cells.map(({ key, center }) => {
    if (!pointIsFinite(center))
      throw new Error("Reveal cells need finite coordinates.");
    return {
      key,
      seed: spatialSeed(center),
      distance: Math.hypot(
        center.x - anchor.x,
        center.y - anchor.y,
        center.z - anchor.z
      )
    };
  });
  const distances = entries.map((entry) => entry.distance).sort((a, b) => a - b);
  const typical = distances[Math.floor(Math.max(0, distances.length - 1) * 0.9)] ?? 1;
  const radius = Number.isFinite(options.radius) && options.radius > 0 ? options.radius : Math.max(1, Math.min(18, typical * 1.15));
  const extent = Math.max(
    distances[distances.length - 1] ?? radius,
    Number.isFinite(options.extent) && options.extent > 0 ? options.extent : 0
  );
  return entries.map((entry) => {
    const base = clamp2(
      options.fullRange ? Math.log1p(entry.distance / radius) / Math.max(1e-9, Math.log1p(extent / radius)) : entry.distance / radius
    );
    const jitter = (entry.seed - 0.5) * 0.06 * (1 - Math.abs(base * 2 - 1));
    const outward = clamp2(base + jitter);
    return {
      ...entry,
      fraction: options.direction === "inward" ? 1 - outward : outward
    };
  }).sort((a, b) => a.key.localeCompare(b.key));
}

// ../oncyber/web/frontend/features/lobby/worldTileGlow.ts
function worldTileGlowPixels(size = 64) {
  const pixels = new Uint8Array(size * size * 4);
  const smooth2 = (x) => {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1), v = y / (size - 1);
      const edge = Math.max(Math.abs(u * 2 - 1), Math.abs(v * 2 - 1));
      const feather = 1 - smooth2((edge - 0.76) / 0.24);
      const rim = Math.exp(-(((edge - 0.72) / 0.23) ** 2));
      const fill = 0.13 * (1 - smooth2(edge));
      const alpha = Math.min(1, (0.68 * rim + fill) * feather);
      const tint = smooth2((u + v) / 2), offset = (y * size + x) * 4;
      pixels[offset] = Math.round(150 + 25 * tint);
      pixels[offset + 1] = Math.round(207 - 27 * tint);
      pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  return pixels;
}
function createWorldTileGlowMaterial(THREE) {
  const texture = new THREE.DataTexture(
    worldTileGlowPixels(),
    64,
    64,
    THREE.RGBAFormat
  );
  texture.name = "world-tile-soft-charge";
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  if ("colorSpace" in texture && THREE.SRGBColorSpace)
    texture.colorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    name: "world-tile-soft-glow",
    color: 16777215,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    // Only resolve coplanar fighting with the underlying fragment. This is
    // not a depth override: opaque geometry and the avatar still occlude it.
    polygonOffset: true,
    polygonOffsetFactor: -0.25,
    polygonOffsetUnits: -0.25
  });
  let disposed = false;
  return {
    material,
    texture,
    dispose() {
      if (disposed) return;
      disposed = true;
      material.dispose();
      texture.dispose();
    }
  };
}

// ../oncyber/web/frontend/features/lobby/worldTileBack.ts
function worldTileBackPixels(size = 32) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const gradient = (x * 0.3 + y * 0.7) / Math.max(1, size - 1);
      const shade = Math.round(26 * gradient);
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = shade;
      pixels[offset + 3] = 255;
    }
  return pixels;
}
function createWorldTileBackMaterial(THREE, side = THREE.BackSide) {
  const texture = new THREE.DataTexture(
    worldTileBackPixels(),
    32,
    32,
    THREE.RGBAFormat
  );
  texture.name = "world-tile-dark-back-gradient";
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  if ("colorSpace" in texture && THREE.SRGBColorSpace)
    texture.colorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    name: "world-tile-dark-back",
    map: texture,
    color: 16777215,
    side,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
    fog: false
  });
  let disposed = false;
  return {
    material,
    texture,
    dispose() {
      if (disposed) return;
      disposed = true;
      material.dispose();
      texture.dispose();
    }
  };
}

// ../oncyber/web/frontend/features/lobby/worldCubeReveal.ts
var clamp3 = (n) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
function snapshotRevealAnchor(anchor) {
  const point = { x: anchor?.x, y: anchor?.y, z: anchor?.z };
  if (![point.x, point.y, point.z].every(Number.isFinite))
    throw new Error("Reveal anchor needs finite coordinates.");
  return point;
}
function interpolate(a, b, t) {
  const attributes = {};
  for (const key of Object.keys(a.attributes))
    attributes[key] = a.attributes[key].map(
      (v, i) => v + (b.attributes[key][i] - v) * t
    );
  return { p: a.p.map((v, i) => v + (b.p[i] - v) * t), attributes };
}
function clip(vertices, axis, bound, above) {
  if (!vertices.length) return [];
  const output = [];
  let last = vertices[vertices.length - 1], insideLast = above ? last.p[axis] >= bound - 1e-7 : last.p[axis] <= bound + 1e-7;
  for (const current of vertices) {
    const inside = above ? current.p[axis] >= bound - 1e-7 : current.p[axis] <= bound + 1e-7;
    if (inside !== insideLast)
      output.push(
        interpolate(
          last,
          current,
          (bound - last.p[axis]) / (current.p[axis] - last.p[axis])
        )
      );
    if (inside) output.push(current);
    last = current;
    insideLast = inside;
  }
  return output;
}
function createWorldCubeReveal(THREE, roots, options) {
  const anchor = snapshotRevealAnchor(options.anchor);
  const size = Number.isFinite(options.cellSize) ? Math.max(0.3, Math.min(8, options.cellSize)) : 0.55;
  const maxCells = options.maxCells ?? 12e3, maxTriangles = options.maxTriangles ?? 12e4;
  const scene = options.scene;
  let mode = options.mode ?? "reveal";
  let direction = options.direction;
  let waveExtent = options.waveExtent;
  const radius = Number.isFinite(options.radius) ? Math.max(size, options.radius) : Infinity;
  const fullCoverage = options.coverage === "all";
  const shellCells = 2 * Math.max(
    1,
    Math.ceil((Number.isFinite(radius) ? radius : 18) / size / 2)
  );
  const anchorVector = new THREE.Vector3(anchor.x, anchor.y, anchor.z);
  const container = new THREE.Group();
  container.name = "native-world-cube-reveal";
  const cells = /* @__PURE__ */ new Map();
  const rigidCells = /* @__PURE__ */ new Map();
  const rigidRecords = /* @__PURE__ */ new Map();
  const rigidMaterials = /* @__PURE__ */ new Set();
  const materialClones = [];
  const preparedSources = /* @__PURE__ */ new Set();
  const batches = /* @__PURE__ */ new Map();
  const materialIds = /* @__PURE__ */ new Map();
  const instanceSources = /* @__PURE__ */ new Map();
  const colorMaterials = /* @__PURE__ */ new Map();
  const frontMaterials = /* @__PURE__ */ new Map();
  const frontMaterial = (material) => {
    if (material.side !== THREE.DoubleSide) return material;
    if (!frontMaterials.has(material)) {
      const front = material.clone();
      front.side = THREE.FrontSide;
      front.onBeforeCompile = material.onBeforeCompile;
      front.customProgramCacheKey = material.customProgramCacheKey;
      frontMaterials.set(material, front);
      materialClones.push({
        source: material,
        clone: front,
        side: THREE.FrontSide
      });
    }
    return frontMaterials.get(material);
  };
  const geometryBounds = /* @__PURE__ */ new Map();
  const localBounds = (geometry) => {
    if (!geometryBounds.has(geometry)) {
      const bounds = new THREE.Box3();
      if (geometry?.boundingBox) bounds.copy(geometry.boundingBox);
      else if (geometry?.attributes?.position)
        bounds.setFromBufferAttribute(geometry.attributes.position);
      geometryBounds.set(geometry, bounds);
    }
    return geometryBounds.get(geometry);
  };
  const attributeSizes = { position: 3, normal: 3 };
  const originals = /* @__PURE__ */ new Map(), geometries = [];
  let background = scene.background, fog = scene.fog;
  const black = new THREE.Color(0);
  const stats = {
    cells: 0,
    triangles: 0,
    sourceTriangles: 0,
    baseTriangles: 0,
    baseClipTests: 0,
    refinementClipTests: 0,
    clipTests: 0,
    clipSlabFastPaths: 0,
    vertexTransforms: 0,
    vertexCacheHits: 0,
    skipped: 0,
    fragments: 0,
    batches: 0,
    drawCalls: 0,
    backDrawCalls: 0,
    vertices: 0,
    instances: 0,
    rigidSources: 0,
    rigidTriangles: 0,
    maxDistance: 0,
    maxCellSize: 0,
    minCellSize: 0,
    refinedCells: 0,
    refinementAttempts: 0,
    refinementLimited: 0,
    refinementLimit: "none",
    reuseMiss: "",
    levels: 0,
    // Camera-cone estimates, not occlusion tests. Counts expose where detail went.
    viewCells: 0,
    viewCellSizeCounts: {}
  };
  let measureView;
  let disposed = false, parked = false, progress = 0, clipTests = 0;
  const clipSlab = (polygon, axis, lower, width = size) => {
    if (++clipTests > (options.maxClipTests ?? 25e4))
      throw new Error("clipping work bound");
    let below = 0, above = 0;
    const low = lower - 1e-7, high = lower + width + 1e-7;
    for (const vertex of polygon) {
      if (vertex.p[axis] < low) below++;
      if (vertex.p[axis] > high) above++;
    }
    if (!below && !above) {
      stats.clipSlabFastPaths++;
      return polygon;
    }
    if (below === polygon.length || above === polygon.length) {
      stats.clipSlabFastPaths++;
      return [];
    }
    return clip(
      clip(polygon, axis, lower, true),
      axis,
      lower + width,
      false
    );
  };
  const visited = /* @__PURE__ */ new Set();
  scene.updateMatrixWorld(true);
  const inverseScene = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  container.matrixAutoUpdate = false;
  container.matrix.copy(inverseScene);
  scene.add(container);
  const hide = (object) => {
    const owner = instanceSources.get(object)?.owner ?? object;
    if (!originals.has(owner)) originals.set(owner, owner.visible);
    owner.visible = false;
  };
  const skip = (object, reason) => {
    hide(object);
    stats.skipped++;
    try {
      options.onSkip?.(object, reason);
    } catch {
    }
  };
  const tryRigid = (object, materials, total) => {
    const limits = options.rigidProps, geometry = object.geometry;
    if (!limits || !Number.isSafeInteger(limits.maxSources) || !Number.isSafeInteger(limits.maxTriangles) || !Number.isFinite(limits.minTriangles) || !Number.isFinite(limits.maxExtent) || limits.minTriangles <= 0 || limits.maxExtent <= 0 || stats.rigidSources >= limits.maxSources || !Number.isSafeInteger(total) || total < 3 || !geometry?.attributes?.position || object.isSkinnedMesh || object.isInstancedMesh || geometry.isInstancedBufferGeometry || Object.keys(geometry.morphAttributes ?? {}).length || !materials.length || materials.some(
      (material) => !material || material.isShaderMaterial || material.isRawShaderMaterial || material.constructor?.name === "BillboardYMaterial"
    ) || !object.matrixWorld?.elements?.every(Number.isFinite))
      return false;
    const start = Math.max(0, geometry.drawRange?.start ?? 0);
    const end = Math.min(
      total,
      start + (geometry.drawRange?.count ?? total)
    );
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start % 3 || end % 3 || end <= start)
      return false;
    let triangles = 0, drawCalls = 0;
    if (Array.isArray(object.material)) {
      for (const group of geometry.groups ?? []) {
        if (!Number.isSafeInteger(group.start) || !Number.isSafeInteger(group.count) || group.start % 3 || group.count % 3)
          return false;
        const material = materials[group.materialIndex];
        if (!material || material.visible === false) continue;
        const count = Math.max(
          0,
          Math.min(end, group.start + group.count) - Math.max(start, group.start)
        );
        if (count) {
          triangles += count / 3;
          drawCalls++;
        }
      }
    } else if (materials[0].visible !== false) {
      triangles = (end - start) / 3;
      drawCalls = 1;
    }
    if (triangles < limits.minTriangles || stats.rigidTriangles + triangles > limits.maxTriangles)
      return false;
    const bounds = localBounds(geometry).clone().applyMatrix4(object.matrixWorld);
    const extent = bounds.getSize(new THREE.Vector3());
    if (![extent.x, extent.y, extent.z].every(Number.isFinite) || bounds.isEmpty() || Math.max(extent.x, extent.y, extent.z) > limits.maxExtent || !fullCoverage && bounds.distanceToPoint(anchorVector) > radius)
      return false;
    const instance = instanceSources.get(object);
    if (instance?.color && materials.some((material) => !material.color?.isColor))
      return false;
    const proxyMaterials = materials.map((source, index) => {
      let material = source;
      if (instance?.color) {
        material = source.clone();
        material.onBeforeCompile = source.onBeforeCompile;
        material.customProgramCacheKey = source.customProgramCacheKey;
        material.color.multiply(
          new THREE.Color().fromArray(instance.color)
        );
        material.vertexColors = instance.vertexColors[index];
        rigidMaterials.add(material);
        materialClones.push({
          source,
          clone: material,
          color: instance.color,
          vertexColors: instance.vertexColors[index]
        });
      }
      return frontMaterial(material);
    });
    const proxy = new THREE.Mesh(
      geometry,
      Array.isArray(object.material) ? proxyMaterials : proxyMaterials[0]
    );
    proxy.name = `world-rigid:${object.name || object.uuid}`;
    proxy.userData.worldRevealSources = [object.name || object.uuid];
    proxy.matrixAutoUpdate = false;
    proxy.matrix.copy(object.matrixWorld);
    proxy.layers.mask = object.layers.mask;
    proxy.renderOrder = object.renderOrder;
    proxy.receiveShadow = object.receiveShadow;
    proxy.castShadow = object.castShadow === true;
    proxy.frustumCulled = false;
    const center = bounds.getCenter(new THREE.Vector3());
    const cell = {
      center,
      pivot: center,
      size: Math.max(0.125, Math.max(extent.x, extent.y, extent.z)),
      surfaceNormal: {
        x: extent.y * extent.z,
        y: extent.x * extent.z,
        z: extent.x * extent.y
      },
      delay: 0,
      seed: 0,
      spans: []
    };
    const key = `rigid:${object.uuid}`;
    proxy.userData.worldRevealRigidKey = key;
    rigidCells.set(key, cell);
    rigidRecords.set(cell, {
      proxy,
      matrix: object.matrixWorld.clone(),
      drawCalls
    });
    container.add(proxy);
    stats.rigidSources++;
    stats.rigidTriangles += triangles;
    preparedSources.add(instance?.owner ?? object);
    if (instance) {
      stats.instances++;
      try {
        options.onInstance?.(instance.owner, instance.index);
      } catch {
      }
    }
    hide(object);
    return true;
  };
  const candidates = [];
  const collect = (object, inheritedExcluded = false) => {
    if (!object || visited.has(object) || object === container) return;
    visited.add(object);
    const excluded = inheritedExcluded || options.exclude?.(object) || object.userData?.worldRevealExclude === true || object.userData?.worldTravelBackground === true;
    if (excluded || object.visible === false) return;
    if (object.isMesh) candidates.push(object);
    for (const child of object.children ?? []) collect(child, excluded);
  };
  const visit = (object) => {
    if (object.isMesh && object.visible) {
      const geometry = object.geometry, position = geometry?.attributes?.position;
      const instance = instanceSources.get(object);
      const attrs = Object.entries(geometry?.attributes ?? {}).filter(
        ([name, a]) => name !== "position" && a.itemSize <= 4 && !a.isInstancedBufferAttribute
      );
      const schema = { position: 3, normal: 3 };
      for (const [name, a] of attrs)
        schema[name] = a.itemSize;
      if (instance?.color)
        schema.color = geometry.attributes.color?.itemSize === 4 ? 4 : 3;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const total = geometry?.index?.count ?? position?.count ?? 0;
      const schemaKey = Object.keys(schema).sort().map((key) => `${key}:${schema[key]}`).join(",");
      const batchKey = (material) => {
        if (!materialIds.has(material))
          materialIds.set(material, materialIds.size);
        return `${materialIds.get(material)}|${schemaKey}|${object.layers.mask}|${object.renderOrder}|${Number(object.receiveShadow)}${material.transparent ? `|${object.uuid}` : ""}`;
      };
      if (tryRigid(object, materials, total)) return;
      const unsupported = object.isSkinnedMesh ? "skinned" : materials.some(
        (m) => m?.constructor?.name === "BillboardYMaterial"
      ) ? "billboard-material" : object.isInstancedMesh || geometry?.isInstancedBufferGeometry ? "instanced" : Object.keys(geometry?.morphAttributes ?? {}).length > 0 ? "morph" : materials.some((m) => !m) ? "missing-material" : materials.some(
        (m) => m.isShaderMaterial || m.isRawShaderMaterial
      ) ? "shader-material" : !position ? "missing-position" : total / 3 > maxTriangles ? "source-triangle-budget" : null;
      if (unsupported) {
        skip(object, unsupported);
      } else {
        try {
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(
            object.matrixWorld
          );
          const v = new THREE.Vector3();
          const mirrored = object.matrixWorld.determinant() < 0;
          const getters = ["getX", "getY", "getZ", "getW"];
          const vertexCache = geometry.index && geometry.attributes.normal && !instance?.color ? /* @__PURE__ */ new Map() : void 0;
          const read = (index) => {
            const cached = vertexCache?.get(index);
            if (cached) {
              stats.vertexCacheHits++;
              return cached;
            }
            stats.vertexTransforms++;
            v.fromBufferAttribute(position, index).applyMatrix4(
              object.matrixWorld
            );
            const p = [v.x, v.y, v.z], attributes = {};
            for (const [name, a] of attrs) {
              const values = new Array(a.itemSize);
              for (let i = 0; i < a.itemSize; i++)
                values[i] = a[getters[i]](index);
              if (name === "normal") {
                v.fromArray(values).applyMatrix3(normalMatrix).normalize();
                values.splice(0, 3, v.x, v.y, v.z);
              }
              if (name === "tangent") {
                v.fromArray(values).transformDirection(
                  object.matrixWorld
                );
                values.splice(0, 3, v.x, v.y, v.z);
                if (values.length > 3 && mirrored)
                  values[3] *= -1;
              }
              attributes[name] = values;
            }
            const vertex = { p, attributes };
            vertexCache?.set(index, vertex);
            return vertex;
          };
          const fragments = /* @__PURE__ */ new Map();
          let produced = 0, inputTriangles = 0, newCells = 0;
          const indexAt = (i) => geometry.index ? geometry.index.getX(i) : i;
          const start = Math.max(0, geometry.drawRange?.start ?? 0), end = Math.min(
            total,
            start + (geometry.drawRange?.count ?? total)
          );
          for (let offset = start; offset + 2 < end; offset += 3) {
            const triangle = [
              read(indexAt(offset)),
              read(indexAt(offset + 1)),
              read(indexAt(offset + 2))
            ];
            if (mirrored) {
              [triangle[1], triangle[2]] = [
                triangle[2],
                triangle[1]
              ];
            }
            if (!triangle.every(
              (vertex) => vertex.p.every(Number.isFinite)
            ))
              throw new Error("invalid geometry");
            const materialGroup = geometry.groups?.find(
              (g) => offset >= g.start && offset < g.start + g.count
            );
            if (Array.isArray(object.material) && !materialGroup)
              continue;
            const materialIndex = Array.isArray(object.material) ? materialGroup?.materialIndex ?? 0 : 0;
            const material = materials[materialIndex];
            if (!material || material.visible === false) continue;
            inputTriangles++;
            if (instance?.color) {
              for (const vertex of triangle) {
                const source = instance.vertexColors[materialIndex] ? vertex.attributes.color : void 0;
                vertex.attributes.color = instance.color.map(
                  (value, axis) => value * (source?.[axis] ?? 1)
                );
                if (schema.color === 4)
                  vertex.attributes.color.push(
                    source?.[3] ?? 1
                  );
              }
            }
            if (!schema.normal || !geometry.attributes.normal) {
              const normal = new THREE.Vector3().fromArray(triangle[1].p).sub(
                new THREE.Vector3().fromArray(triangle[0].p)
              ).cross(
                new THREE.Vector3().fromArray(triangle[2].p).sub(
                  new THREE.Vector3().fromArray(
                    triangle[0].p
                  )
                )
              ).normalize().toArray();
              for (const vertex of triangle)
                vertex.attributes.normal = normal;
            }
            const coords = [anchor.x, anchor.y, anchor.z];
            const triangleMin = [Infinity, Infinity, Infinity];
            const triangleMax = [-Infinity, -Infinity, -Infinity];
            for (const vertex of triangle)
              for (let axis = 0; axis < 3; axis++) {
                triangleMin[axis] = Math.min(
                  triangleMin[axis],
                  vertex.p[axis]
                );
                triangleMax[axis] = Math.max(
                  triangleMax[axis],
                  vertex.p[axis]
                );
              }
            let farthest = 0;
            for (let axis = 0; axis < 3; axis++)
              farthest = Math.max(
                farthest,
                Math.abs(triangleMin[axis] - coords[axis]),
                Math.abs(triangleMax[axis] - coords[axis])
              );
            const detailExtent = shellCells * size;
            const lastLevel = fullCoverage && farthest >= detailExtent ? Math.floor(
              Math.log2(farthest / detailExtent)
            ) + 1 : 0;
            if (!Number.isFinite(lastLevel) || lastLevel > 52)
              throw new Error("invalid cell bounds");
            for (let level = 0; level <= lastLevel; level++) {
              const gridSize = size * 2 ** level;
              const min = coords.map(
                (a, axis) => Math.floor((triangleMin[axis] - a) / gridSize)
              );
              const max = coords.map(
                (a, axis) => Math.max(
                  min[axis],
                  Math.floor(
                    (triangleMax[axis] - a - 1e-7) / gridSize
                  )
                )
              );
              if (fullCoverage || Number.isFinite(radius)) {
                const first = fullCoverage ? -shellCells : Math.floor(-radius / gridSize);
                const last = fullCoverage ? shellCells - 1 : Math.ceil(radius / gridSize) - 1;
                for (let axis = 0; axis < 3; axis++) {
                  min[axis] = Math.max(min[axis], first);
                  max[axis] = Math.min(max[axis], last);
                }
                if (min.some((value, axis) => value > max[axis]))
                  continue;
              }
              if (![...min, ...max].every(Number.isSafeInteger))
                throw new Error("invalid cell bounds");
              const range = (polygon, axis) => {
                let low = Infinity, high = -Infinity;
                for (const vertex of polygon) {
                  low = Math.min(low, vertex.p[axis]);
                  high = Math.max(high, vertex.p[axis]);
                }
                const first = Math.max(
                  min[axis],
                  Math.floor(
                    (low - coords[axis] - 1e-7) / gridSize
                  )
                );
                const last = Math.min(
                  max[axis],
                  Math.max(
                    first,
                    Math.floor(
                      (high - coords[axis] - 1e-7) / gridSize
                    )
                  )
                );
                return [first, last];
              };
              for (let x = min[0]; x <= max[0]; x++) {
                const xPolygon = clipSlab(
                  triangle,
                  0,
                  coords[0] + x * gridSize,
                  gridSize
                );
                if (xPolygon.length < 3) continue;
                const [yMin, yMax] = range(xPolygon, 1);
                for (let y = yMin; y <= yMax; y++) {
                  const xyPolygon = clipSlab(
                    xPolygon,
                    1,
                    coords[1] + y * gridSize,
                    gridSize
                  );
                  if (xyPolygon.length < 3) continue;
                  const [zMin, zMax] = range(xyPolygon, 2);
                  for (let z = zMin; z <= zMax; z++) {
                    if (!fullCoverage && Number.isFinite(radius)) {
                      const distanceSquared = [
                        x,
                        y,
                        z
                      ].reduce((sum, n) => {
                        const nearest = n < 0 ? (n + 1) * gridSize : n * gridSize;
                        return sum + nearest * nearest;
                      }, 0);
                      if (distanceSquared > radius * radius)
                        continue;
                    }
                    if (level > 0 && [x, y, z].every(
                      (n) => n >= -shellCells / 2 && n < shellCells / 2
                    ))
                      continue;
                    const xyz = [x, y, z], key = fullCoverage ? `${level}:${xyz.join(":")}` : xyz.join(":");
                    const polygon = clipSlab(
                      xyPolygon,
                      2,
                      coords[2] + z * gridSize,
                      gridSize
                    );
                    if (polygon.length < 3) continue;
                    const triangles = [];
                    for (let n = 1; n < polygon.length - 1; n++) {
                      const a = polygon[0].p, b = polygon[n].p, c = polygon[n + 1].p;
                      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
                      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
                      if (Math.hypot(
                        uy * vz - uz * vy,
                        uz * vx - ux * vz,
                        ux * vy - uy * vx
                      ) < 1e-10)
                        continue;
                      triangles.push(
                        polygon[0],
                        polygon[n],
                        polygon[n + 1]
                      );
                    }
                    if (!triangles.length) continue;
                    if (!fragments.has(key)) {
                      if (!cells.has(key) && cells.size + newCells >= maxCells)
                        throw new Error("cell bound");
                      if (!cells.has(key)) newCells++;
                      fragments.set(key, {
                        center: new THREE.Vector3(
                          anchor.x + (x + 0.5) * gridSize,
                          anchor.y + (y + 0.5) * gridSize,
                          anchor.z + (z + 0.5) * gridSize
                        ),
                        size: gridSize,
                        groups: /* @__PURE__ */ new Map()
                      });
                    }
                    const fragment = fragments.get(key);
                    if (!fragment.groups.has(materialIndex))
                      fragment.groups.set(
                        materialIndex,
                        []
                      );
                    produced += triangles.length / 3;
                    if (produced + stats.triangles > maxTriangles)
                      throw new Error("triangle bound");
                    fragment.groups.get(materialIndex).push(...triangles);
                  }
                }
              }
            }
          }
          if (stats.fragments + fragments.size > (options.maxFragments ?? 2e4))
            throw new Error("fragment memory bound");
          const needed = /* @__PURE__ */ new Set();
          for (const fragment of fragments.values())
            for (const index of fragment.groups.keys())
              needed.add(batchKey(materials[index]));
          if (batches.size + [...needed].filter((key) => !batches.has(key)).length > (options.maxBatches ?? 128))
            throw new Error("material draw bound");
          const nextAttributes = { ...attributeSizes };
          for (const [name, count] of Object.entries(schema))
            nextAttributes[name] = Math.max(
              nextAttributes[name] ?? 0,
              count
            );
          if (Object.values(nextAttributes).reduce(
            (sum, count) => sum + count,
            0
          ) > 64)
            throw new Error("attribute memory bound");
          Object.assign(attributeSizes, nextAttributes);
          for (const [key, fragment] of fragments) {
            let cell = cells.get(key);
            if (!cell) {
              cell = {
                center: fragment.center,
                size: fragment.size,
                delay: 0,
                seed: 0,
                spans: []
              };
              cells.set(key, cell);
            }
            for (const [index, vertices] of fragment.groups) {
              const material = materials[index], materialKey = batchKey(material);
              let batch = batches.get(materialKey);
              if (!batch) {
                batch = {
                  material,
                  schema,
                  layers: object.layers.mask,
                  renderOrder: object.renderOrder,
                  receiveShadow: object.receiveShadow,
                  pieces: [],
                  sortSphere: material.transparent ? (geometry.boundingSphere?.clone() ?? localBounds(
                    geometry
                  ).getBoundingSphere(
                    new THREE.Sphere()
                  )).applyMatrix4(object.matrixWorld) : void 0
                };
                batches.set(materialKey, batch);
              }
              batch.pieces.push({
                cell,
                cellKey: key,
                source: object.name || object.uuid,
                sourceId: object.uuid,
                vertices
              });
            }
          }
          stats.fragments += fragments.size;
          stats.triangles += produced;
          stats.sourceTriangles += inputTriangles;
          if (produced)
            preparedSources.add(instance?.owner ?? object);
          if (instance && fragments.size) {
            stats.instances++;
            try {
              options.onInstance?.(
                instance.owner,
                instance.index
              );
            } catch {
            }
          }
          hide(object);
        } catch (error) {
          skip(
            object,
            error instanceof Error ? error.message : "invalid-geometry"
          );
        }
      }
    }
  };
  for (const root of roots) {
    let parent = root?.parent, hidden = false;
    while (parent) {
      hidden ||= parent.visible === false || parent.userData?.worldTravelBackground === true;
      parent = parent.parent;
    }
    if (!hidden) collect(root);
  }
  const attributeState = (attribute) => attribute ? [
    attribute,
    attribute.array,
    attribute.count,
    attribute.itemSize,
    attribute.normalized,
    attribute.version,
    attribute.data,
    attribute.data?.array,
    attribute.data?.version
  ] : [attribute];
  const sourceState = (object) => {
    const geometry = object.geometry;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const state = [
      object.parent,
      object.visible,
      geometry,
      object.material,
      object.layers?.mask,
      object.renderOrder,
      object.receiveShadow,
      object.castShadow,
      object.count,
      ...object.matrixWorld?.elements ?? [],
      ...attributeState(object.instanceMatrix),
      ...attributeState(object.instanceColor),
      geometry?.drawRange?.start,
      geometry?.drawRange?.count,
      ...attributeState(geometry?.index)
    ];
    for (const name of Object.keys(geometry?.attributes ?? {}).sort())
      state.push(name, ...attributeState(geometry.attributes[name]));
    for (const group of geometry?.groups ?? [])
      state.push(group.start, group.count, group.materialIndex);
    for (const material of materials)
      state.push(
        material,
        material?.side,
        material?.transparent,
        material?.vertexColors,
        material?.visible
      );
    return state;
  };
  const sameState = (left, right) => left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const sourceStates = new Map(
    candidates.map((object) => [object, sourceState(object)])
  );
  const sourceRoots = roots.map((root) => ({ root, parent: root?.parent }));
  const sceneMatrix = [...scene.matrixWorld.elements];
  const scanSources = (includeHidden = false) => {
    const found = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
    const scan = (object) => {
      if (!object || seen.has(object) || object === container) return;
      seen.add(object);
      if (options.exclude?.(object) || object.userData?.worldRevealExclude === true || object.userData?.worldTravelBackground === true || !includeHidden && object.visible === false)
        return;
      if (object.isMesh) found.add(object);
      for (const child of object.children ?? []) scan(child);
    };
    for (const { root } of sourceRoots) {
      let parent = root?.parent, excluded = false;
      while (parent) {
        excluded ||= options.exclude?.(parent) || parent.userData?.worldRevealExclude === true || parent.userData?.worldTravelBackground === true || !includeHidden && parent.visible === false;
        parent = parent.parent;
      }
      if (!excluded) scan(root);
    }
    return found;
  };
  const addedSources = () => [...scanSources()].filter(
    (object) => !preparedSources.has(object) && (!sourceStates.has(object) || !sameState(sourceStates.get(object), sourceState(object)))
  );
  let instanceReads = 0;
  const maxInstances = Number.isFinite(options.maxInstances) ? Math.max(0, Math.floor(options.maxInstances)) : 4096;
  for (const object of candidates.splice(0)) {
    const geometry = object.geometry;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!object.isInstancedMesh || geometry?.isInstancedBufferGeometry || object.isSkinnedMesh || Object.keys(geometry?.morphAttributes ?? {}).length || materials.some(
      (m) => !m || m.isShaderMaterial || m.isRawShaderMaterial || m.constructor?.name === "BillboardYMaterial"
    )) {
      candidates.push(object);
      continue;
    }
    try {
      const count = object.count;
      if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(object.instanceMatrix?.count) || object.instanceMatrix.itemSize !== 16 || count > object.instanceMatrix.count || typeof object.getMatrixAt !== "function")
        throw new Error("invalid instance matrices");
      if (instanceReads + count > maxInstances)
        throw new Error("instance work bound");
      instanceReads += count;
      const colorAttribute = object.instanceColor;
      if (colorAttribute && (colorAttribute.itemSize !== 3 || colorAttribute.count < count))
        throw new Error("invalid instance colors");
      const expanded = [];
      for (let index = 0; index < count; index++) {
        const matrix = new THREE.Matrix4();
        object.getMatrixAt(index, matrix);
        matrix.premultiply(object.matrixWorld);
        if (!matrix.elements.every(Number.isFinite))
          throw new Error("invalid instance matrix");
        const color = colorAttribute ? [
          colorAttribute.getX(index),
          colorAttribute.getY(index),
          colorAttribute.getZ(index)
        ] : void 0;
        if (color && !color.every(Number.isFinite))
          throw new Error("invalid instance color");
        const virtualMaterials = color ? materials.map((source) => {
          if (!colorMaterials.has(source)) {
            const material = source.clone();
            material.vertexColors = true;
            material.onBeforeCompile = source.onBeforeCompile;
            material.customProgramCacheKey = source.customProgramCacheKey;
            colorMaterials.set(source, material);
            materialClones.push({
              source,
              clone: material,
              vertexColors: true
            });
          }
          return colorMaterials.get(source);
        }) : materials;
        const virtual = {
          isMesh: true,
          visible: true,
          geometry,
          material: Array.isArray(object.material) ? virtualMaterials : virtualMaterials[0],
          matrixWorld: matrix,
          name: `${object.name || object.uuid}[${index}]`,
          uuid: `${object.uuid}:${index}`,
          layers: object.layers,
          renderOrder: object.renderOrder,
          receiveShadow: object.receiveShadow
        };
        expanded.push(virtual);
        instanceSources.set(virtual, {
          owner: object,
          index,
          color,
          vertexColors: materials.map(
            (material) => material.vertexColors === true
          )
        });
      }
      candidates.push(...expanded);
      hide(object);
    } catch (error) {
      skip(
        object,
        error instanceof Error ? error.message : "invalid instances"
      );
    }
  }
  if (Number.isFinite(radius)) {
    const ordered = candidates.map((object) => {
      const bounds = localBounds(object.geometry).clone().applyMatrix4(object.matrixWorld);
      const extent = bounds.getSize(new THREE.Vector3());
      return {
        object,
        distance: bounds.distanceToPoint(anchorVector),
        footprint: extent.x * extent.z / Math.max(size, extent.y)
      };
    });
    ordered.sort(
      (a, b) => a.distance - b.distance || b.footprint - a.footprint
    );
    for (const entry of ordered) visit(entry.object);
  } else for (const object of candidates) visit(object);
  stats.baseTriangles = stats.triangles;
  stats.baseClipTests = clipTests;
  if (options.refinement && cells.size) {
    const minSize = Number.isFinite(options.refinement.minCellSize) ? Math.max(0.125, Math.min(size, options.refinement.minCellSize)) : size;
    const maxSize = Number.isFinite(options.refinement.maxCellSize) ? Math.max(minSize, options.refinement.maxCellSize) : Infinity;
    const detailRadius = Number.isFinite(options.refinement.detailRadius) ? Math.max(minSize, options.refinement.detailRadius) : 8;
    const piecesByCell = /* @__PURE__ */ new Map();
    for (const batch of batches.values())
      for (const piece of batch.pieces) {
        if (!piecesByCell.has(piece.cellKey))
          piecesByCell.set(piece.cellKey, []);
        piecesByCell.get(piece.cellKey).push({ batch, piece });
      }
    const rejected = /* @__PURE__ */ new Set();
    const limitCounts = {};
    const recordRefinementLimit = (reason, decisive = false) => {
      stats.refinementLimited = 1;
      limitCounts[reason] = (limitCounts[reason] ?? 0) + 1;
      if (decisive || limitCounts[reason] > (limitCounts[stats.refinementLimit] ?? 0))
        stats.refinementLimit = reason;
    };
    const priority = (cell) => {
      const distance = cell.center.distanceTo(focus ?? anchorVector);
      const desired = Math.min(
        maxSize,
        minSize * 2 ** Math.max(
          0,
          Math.floor(
            Math.log2(Math.max(1, distance / detailRadius))
          )
        )
      );
      return {
        ratio: cell.size / desired,
        apparent: cell.size / Math.max(detailRadius, distance)
      };
    };
    const appendTriangle = (output, polygon) => {
      for (let index = 1; index < polygon.length - 1; index++) {
        const a = polygon[0].p, b = polygon[index].p, c = polygon[index + 1].p;
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        if (Math.hypot(
          uy * vz - uz * vy,
          uz * vx - ux * vz,
          ux * vy - uy * vx
        ) >= 1e-10)
          output.push(polygon[0], polygon[index], polygon[index + 1]);
      }
    };
    const finitePoint = (point) => point && [point.x, point.y, point.z].every(Number.isFinite);
    const focus = finitePoint(options.refinement.focus) ? new THREE.Vector3().copy(options.refinement.focus) : void 0;
    const forward = focus && finitePoint(options.refinement.forward) ? new THREE.Vector3().copy(options.refinement.forward) : void 0;
    if (forward?.lengthSq() > 1e-10) forward.normalize();
    const hasForward = forward?.lengthSq() > 1e-10;
    if (focus)
      measureView = (cell) => {
        const dx = cell.center.x - focus.x, dy = cell.center.y - focus.y, dz = cell.center.z - focus.z;
        const distance = Math.hypot(dx, dy, dz);
        const apparent = cell.size / Math.max(0.5, distance);
        const visibility = hasForward ? 0.04 + 0.96 * clamp3(
          ((dx * forward.x + dy * forward.y + dz * forward.z + cell.size * Math.sqrt(3) / 2) / Math.max(0.5, distance) - 0.1) / 0.4
        ) : 1;
        return { apparent, visibility };
      };
    function* refinementCandidates() {
      if (!focus) {
        for (let pass = 0; pass < 6; pass++) {
          const previous = stats.refinedCells;
          const pending = [...cells].map(([key, cell]) => ({
            key,
            cell,
            ...priority(cell)
          })).filter(
            ({ key, ratio }) => ratio > 1.01 && !rejected.has(key)
          ).sort(
            (a, b) => b.ratio - a.ratio || b.apparent - a.apparent
          );
          for (const entry of pending) yield entry;
          if (stats.refinedCells === previous) return;
        }
        return;
      }
      const heap = [];
      let order = 0;
      const before = (a, b) => a.apparent > b.apparent || a.apparent === b.apparent && (a.ratio > b.ratio || a.ratio === b.ratio && a.order < b.order);
      const push = (key, cell, depth) => {
        const { ratio } = priority(cell);
        if (depth >= 6 || ratio <= 1.01 || rejected.has(key)) return;
        const { apparent, visibility } = measureView(cell);
        const entry = {
          key,
          cell,
          depth,
          apparent: apparent * visibility,
          ratio,
          order: order++
        };
        let index = heap.length;
        heap.push(entry);
        while (index > 0) {
          const parent = index - 1 >> 1;
          if (!before(entry, heap[parent])) break;
          heap[index] = heap[parent];
          index = parent;
        }
        heap[index] = entry;
      };
      const pop = () => {
        const entry = heap[0], last = heap.pop();
        if (heap.length) {
          let index = 0;
          while (index * 2 + 1 < heap.length) {
            let child = index * 2 + 1;
            if (child + 1 < heap.length && before(heap[child + 1], heap[child]))
              child++;
            if (!before(heap[child], last)) break;
            heap[index] = heap[child];
            index = child;
          }
          heap[index] = last;
        }
        return entry;
      };
      for (const [key, cell] of cells) push(key, cell, 0);
      while (heap.length) {
        const entry = pop();
        yield entry;
        if (!cells.has(entry.key))
          for (let index = 0; index < 8; index++) {
            const key = `${entry.key}/${index}`;
            const child = cells.get(key);
            if (child) push(key, child, entry.depth + 1);
          }
      }
    }
    for (const { key, cell } of refinementCandidates()) {
      if (stats.triangles >= maxTriangles || clipTests >= (options.maxClipTests ?? 25e4)) {
        recordRefinementLimit(
          stats.triangles >= maxTriangles ? "triangles" : "clipping",
          true
        );
        break;
      }
      stats.refinementAttempts++;
      const owned = piecesByCell.get(key);
      const previousTriangles = owned.reduce(
        (sum, { piece }) => sum + piece.vertices.length / 3,
        0
      );
      const childSize = cell.size / 2;
      const center = [cell.center.x, cell.center.y, cell.center.z];
      const children = /* @__PURE__ */ new Map();
      const additions = [];
      let triangles = 0;
      try {
        for (const { batch, piece } of owned) {
          const pieces = /* @__PURE__ */ new Map();
          const divide = (polygon, axis, child) => {
            if (polygon.length < 3) return;
            if (axis === 3) {
              if (!pieces.has(child)) pieces.set(child, []);
              appendTriangle(pieces.get(child), polygon);
              return;
            }
            const min = Math.min(
              ...polygon.map((vertex) => vertex.p[axis])
            );
            const max = Math.max(
              ...polygon.map((vertex) => vertex.p[axis])
            );
            if (min >= center[axis] - 1e-7) {
              divide(polygon, axis + 1, child | 1 << axis);
            } else if (max <= center[axis] + 1e-7) {
              divide(polygon, axis + 1, child);
            } else {
              if (++clipTests > (options.maxClipTests ?? 25e4))
                throw new Error("refinement clipping bound");
              divide(
                clip(polygon, axis, center[axis], false),
                axis + 1,
                child
              );
              divide(
                clip(polygon, axis, center[axis], true),
                axis + 1,
                child | 1 << axis
              );
            }
          };
          for (let index = 0; index < piece.vertices.length; index += 3)
            divide(piece.vertices.slice(index, index + 3), 0, 0);
          for (const [child, vertices] of pieces) {
            if (!vertices.length) continue;
            triangles += vertices.length / 3;
            if (stats.triangles - previousTriangles + triangles > maxTriangles)
              throw new Error("refinement triangle bound");
            let childCell = children.get(child);
            if (!childCell) {
              childCell = {
                center: new THREE.Vector3(
                  ...center.map(
                    (value, axis) => value + (child & 1 << axis ? 1 : -1) * childSize / 2
                  )
                ),
                size: childSize,
                delay: 0,
                seed: 0,
                spans: []
              };
              children.set(child, childCell);
            }
            additions.push({
              batch,
              piece: {
                cell: childCell,
                cellKey: `${key}/${child}`,
                source: piece.source,
                sourceId: piece.sourceId,
                vertices
              }
            });
          }
        }
        if (cells.size - 1 + children.size > maxCells)
          throw new Error("refinement cell bound");
        const fragmentGrowth = new Set(
          additions.map(
            ({ piece }) => `${piece.cellKey}|${piece.sourceId}`
          )
        ).size - new Set(owned.map(({ piece }) => piece.sourceId)).size;
        if (stats.fragments + fragmentGrowth > (options.maxFragments ?? 2e4))
          throw new Error("refinement fragment bound");
        cells.delete(key);
        piecesByCell.delete(key);
        for (const { piece } of owned) piece.vertices = [];
        for (const [child, childCell] of children)
          cells.set(`${key}/${child}`, childCell);
        for (const addition of additions) {
          addition.batch.pieces.push(addition.piece);
          const childKey = addition.piece.cellKey;
          if (!piecesByCell.has(childKey))
            piecesByCell.set(childKey, []);
          piecesByCell.get(childKey).push(addition);
        }
        stats.triangles += triangles - previousTriangles;
        stats.fragments += fragmentGrowth;
        stats.refinedCells++;
      } catch (error) {
        rejected.add(key);
        const message = error instanceof Error ? error.message : "";
        recordRefinementLimit(
          {
            "refinement triangle bound": "triangles",
            "refinement cell bound": "cells",
            "refinement fragment bound": "fragments",
            "refinement clipping bound": "clipping"
          }[message] ?? "invalid"
        );
      }
    }
    for (const batch of batches.values())
      batch.pieces = batch.pieces.filter(
        (piece) => piece.vertices.length
      );
  }
  stats.clipTests = clipTests;
  stats.refinementClipTests = clipTests - stats.baseClipTests;
  const motionCells = new Map([...cells, ...rigidCells]);
  const configureRevealAnchor = (nextAnchor, nextWaveExtent) => {
    const fixedAnchor = snapshotRevealAnchor(nextAnchor);
    if (Number.isFinite(nextWaveExtent) && nextWaveExtent > 0)
      waveExtent = nextWaveExtent;
    const schedule = buildRadialCellSchedule(
      [...motionCells].map(([key, cell]) => ({
        key,
        center: cell.center
      })),
      fixedAnchor,
      {
        radius: Number.isFinite(radius) ? radius : void 0,
        fullRange: fullCoverage,
        direction,
        extent: waveExtent
      }
    );
    container.userData.worldRevealSchedule = schedule.map((step) => ({
      ...step,
      delay: step.fraction * WORLD_TILE_MAX_DELAY,
      span: WORLD_TILE_SPAN
    }));
    stats.maxDistance = 0;
    for (const step of schedule) {
      stats.maxDistance = Math.max(stats.maxDistance, step.distance);
      const cell = motionCells.get(step.key);
      cell.seed = step.seed;
      cell.delay = step.fraction * WORLD_TILE_MAX_DELAY;
      cell.motion = {
        center: cell.center,
        anchor: fixedAnchor,
        mode,
        delay: cell.delay,
        cellSize: cell.size,
        seed: cell.seed,
        surfaceNormal: cell.surfaceNormal
      };
    }
  };
  const surfaceBounds = /* @__PURE__ */ new Map();
  const surfacePoint = new THREE.Vector3();
  for (const batch of batches.values())
    for (const piece of batch.pieces) {
      const cell = piece.cell;
      if (!surfaceBounds.has(cell))
        surfaceBounds.set(cell, new THREE.Box3());
      const bounds = surfaceBounds.get(cell);
      const normal = cell.surfaceNormal ??= { x: 0, y: 0, z: 0 };
      for (let i = 0; i < piece.vertices.length; i += 3) {
        const a = piece.vertices[i].p, b = piece.vertices[i + 1].p, c = piece.vertices[i + 2].p;
        bounds.expandByPoint(surfacePoint.fromArray(a));
        bounds.expandByPoint(surfacePoint.fromArray(b));
        bounds.expandByPoint(surfacePoint.fromArray(c));
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        normal.x += Math.abs(uy * vz - uz * vy);
        normal.y += Math.abs(uz * vx - ux * vz);
        normal.z += Math.abs(ux * vy - uy * vx);
      }
    }
  for (const [cell, bounds] of surfaceBounds)
    cell.pivot = bounds.getCenter(new THREE.Vector3());
  surfaceBounds.clear();
  configureRevealAnchor(anchor);
  stats.cells = cells.size;
  stats.levels = new Set([...cells.values()].map((cell) => cell.size)).size;
  for (const cell of cells.values()) {
    stats.maxCellSize = Math.max(stats.maxCellSize, cell.size);
    stats.minCellSize = stats.minCellSize ? Math.min(stats.minCellSize, cell.size) : cell.size;
    if (measureView?.(cell).visibility >= 0.5) {
      stats.viewCells++;
      const key = String(cell.size);
      stats.viewCellSizeCounts[key] = (stats.viewCellSizeCounts[key] ?? 0) + 1;
    }
  }
  stats.batches = batches.size;
  stats.vertices = stats.triangles * 3;
  const base = {};
  for (const [name, count] of Object.entries(attributeSizes))
    base[name] = new Float32Array(stats.vertices * count);
  const positions = new THREE.BufferAttribute(
    new Float32Array(stats.vertices * 3),
    3
  );
  const normals = new THREE.BufferAttribute(
    new Float32Array(stats.vertices * 3),
    3
  );
  positions.setUsage(THREE.DynamicDrawUsage);
  normals.setUsage(THREE.DynamicDrawUsage);
  const tangents = attributeSizes.tangent ? new THREE.BufferAttribute(
    new Float32Array(stats.vertices * attributeSizes.tangent),
    attributeSizes.tangent
  ) : null;
  tangents?.setUsage(THREE.DynamicDrawUsage);
  const glowColors = new THREE.BufferAttribute(
    new Float32Array(stats.vertices * 3),
    3
  );
  glowColors.setUsage(THREE.DynamicDrawUsage);
  const glowUV = new Float32Array(stats.vertices * 2);
  const auxiliary = /* @__PURE__ */ new Map();
  const frontRecords = [];
  let cursor = 0;
  for (const batch of batches.values()) {
    const start = cursor, spans = [];
    const auxKey = `${batch.layers}|${batch.renderOrder}`;
    if (!auxiliary.has(auxKey))
      auxiliary.set(auxKey, {
        glow: [],
        backs: /* @__PURE__ */ new Map(),
        layers: batch.layers,
        renderOrder: batch.renderOrder
      });
    const aux = auxiliary.get(auxKey);
    const backSide = batch.material.side === THREE.BackSide ? THREE.FrontSide : THREE.BackSide;
    if (!aux.backs.has(backSide)) aux.backs.set(backSide, []);
    const backIndices = aux.backs.get(backSide);
    for (const piece of batch.pieces) {
      const span = {
        start: cursor,
        count: piece.vertices.length,
        cellKey: piece.cellKey,
        source: piece.source
      };
      piece.cell.spans.push(span);
      spans.push(span);
      const center = piece.cell.center;
      for (let n = 0; n < piece.vertices.length; n++) {
        const vertex = piece.vertices[n];
        base.position.set(vertex.p, cursor * 3);
        for (const [name, count] of Object.entries(attributeSizes)) {
          if (name === "position") continue;
          const values = vertex.attributes[name];
          for (let i = 0; i < count; i++)
            base[name][cursor * count + i] = values?.[i] ?? (name === "color" || name === "tangent" && i === 3 ? 1 : 0);
        }
        const tri = Math.floor(n / 3) * 3;
        const pa = piece.vertices[tri].p, pb = piece.vertices[tri + 1].p, pc = piece.vertices[tri + 2].p;
        const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2], vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
        const abs = [
          Math.abs(uy * vz - uz * vy),
          Math.abs(uz * vx - ux * vz),
          Math.abs(ux * vy - uy * vx)
        ];
        const axis = abs[0] > abs[1] && abs[0] > abs[2] ? 0 : abs[1] > abs[2] ? 1 : 2;
        const axes = axis === 0 ? [2, 1] : axis === 1 ? [0, 2] : [0, 1];
        const centers = [center.x, center.y, center.z];
        glowUV[cursor * 2] = (vertex.p[axes[0]] - centers[axes[0]]) / piece.cell.size + 0.5;
        glowUV[cursor * 2 + 1] = (vertex.p[axes[1]] - centers[axes[1]]) / piece.cell.size + 0.5;
        aux.glow.push(cursor);
        backIndices.push(cursor);
        cursor++;
      }
    }
    frontRecords.push({ batch, start, count: cursor - start, spans });
    batch.pieces.length = 0;
  }
  const fixed = /* @__PURE__ */ new Map();
  for (const [name, values] of Object.entries(base))
    if (!["position", "normal", "tangent"].includes(name))
      fixed.set(
        name,
        new THREE.BufferAttribute(values, attributeSizes[name])
      );
  for (const { batch, start, count, spans } of frontRecords) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", positions);
    geometry.setAttribute("normal", normals);
    for (const name of Object.keys(batch.schema)) {
      if (name === "tangent") geometry.setAttribute(name, tangents);
      else if (fixed.has(name))
        geometry.setAttribute(name, fixed.get(name));
    }
    geometry.setDrawRange(start, count);
    geometry.userData.worldRevealRanges = spans;
    const bounds = new THREE.Box3();
    const point = new THREE.Vector3();
    for (let i = start; i < start + count; i++)
      bounds.expandByPoint(point.fromArray(base.position, i * 3));
    geometry.boundingSphere = batch.sortSphere?.clone() ?? bounds.getBoundingSphere(new THREE.Sphere());
    geometry.boundingSphere.radius += size * 2;
    const mesh = new THREE.Mesh(geometry, frontMaterial(batch.material));
    mesh.name = `world-batch:${stats.drawCalls++}`;
    mesh.userData.worldRevealSources = [
      ...new Set(spans.map((span) => span.source))
    ];
    mesh.layers.mask = batch.layers;
    mesh.renderOrder = batch.renderOrder;
    mesh.receiveShadow = batch.receiveShadow;
    mesh.frustumCulled = false;
    container.add(mesh);
    geometries.push(geometry);
  }
  const glow = createWorldTileGlowMaterial(THREE);
  const tileUV = new THREE.BufferAttribute(glowUV, 2);
  const backMaterials = /* @__PURE__ */ new Map();
  for (const aux of auxiliary.values()) {
    if (aux.glow.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", positions);
      geometry.setAttribute("color", glowColors);
      geometry.setAttribute("uv", tileUV);
      geometry.setIndex(aux.glow);
      const mesh = new THREE.Mesh(geometry, glow.material);
      mesh.name = "world-tile-glow";
      mesh.layers.mask = aux.layers;
      mesh.renderOrder = aux.renderOrder + 1;
      mesh.frustumCulled = false;
      container.add(mesh);
      geometries.push(geometry);
    }
    for (const [side, indices] of aux.backs) {
      if (!indices.length) continue;
      if (!backMaterials.has(side))
        backMaterials.set(
          side,
          createWorldTileBackMaterial(THREE, side)
        );
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", positions);
      geometry.setAttribute("uv", tileUV);
      geometry.setIndex(indices);
      const mesh = new THREE.Mesh(
        geometry,
        backMaterials.get(side).material
      );
      mesh.name = "world-tile-back";
      stats.backDrawCalls++;
      mesh.layers.mask = aux.layers;
      mesh.renderOrder = aux.renderOrder;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      container.add(mesh);
      geometries.push(geometry);
    }
  }
  stats.drawCalls = container.children.length + [...rigidRecords.values()].reduce(
    (sum, record) => sum + record.drawCalls - 1,
    0
  );
  const rigidTransform = new THREE.Matrix4();
  const rotation = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
  let previousProgress = -1;
  const setProgress = (value) => {
    if (disposed || parked) return;
    progress = clamp3(value);
    if (progress === previousProgress) return;
    previousProgress = progress;
    const intact = mode === "dissolve" ? progress === 0 : progress === 1;
    scene.background = intact ? background : black;
    scene.fog = intact ? fog : null;
    for (const [object, visible] of originals)
      object.visible = intact ? visible : false;
    container.visible = mode === "dissolve" ? progress > 0 && progress < 1 : progress < 1;
    let changed = false;
    for (const cell of motionCells.values()) {
      const sample = sampleWorldCell(progress, cell.motion, cell.sample);
      cell.sample = sample;
      const identity = sample.visible && sample.scale === 1 && sample.glow === 0 && sample.rotation.x === 0 && sample.rotation.y === 0 && sample.rotation.z === 0 && sample.offset.x === 0 && sample.offset.y === 0 && sample.offset.z === 0;
      const unchanged = !sample.visible ? "hidden" : identity ? "settled" : "";
      if (unchanged && unchanged === cell.unchanged) continue;
      cell.unchanged = unchanged;
      const rigid = rigidRecords.get(cell);
      if (!rigid) changed = true;
      euler.set(sample.rotation.x, sample.rotation.y, sample.rotation.z);
      quaternion.setFromEuler(euler);
      rotation.makeRotationFromQuaternion(quaternion);
      const m = rotation.elements, scale = sample.visible ? sample.scale : 0;
      const pivot = cell.pivot ?? cell.center;
      const cx = pivot.x, cy = pivot.y, cz = pivot.z;
      if (rigid) {
        const rigidScale = scale * (mode === "dissolve" ? Math.max(
          0,
          Math.cos(
            Math.max(
              Math.abs(sample.rotation.x),
              Math.abs(sample.rotation.y),
              Math.abs(sample.rotation.z)
            )
          )
        ) : 1);
        rigid.proxy.visible = sample.visible && rigidScale > 1e-7;
        if (identity) rigid.proxy.matrix.copy(rigid.matrix);
        else {
          rigidTransform.copy(rotation);
          const elements = rigidTransform.elements;
          for (let column = 0; column < 3; column++) {
            const start = column * 4;
            elements[start] *= rigidScale;
            elements[start + 1] *= rigidScale;
            elements[start + 2] *= rigidScale;
          }
          elements[12] = cx + sample.offset.x - rigidScale * (m[0] * cx + m[4] * cy + m[8] * cz);
          elements[13] = cy + sample.offset.y - rigidScale * (m[1] * cx + m[5] * cy + m[9] * cz);
          elements[14] = cz + sample.offset.z - rigidScale * (m[2] * cx + m[6] * cy + m[10] * cz);
          rigid.proxy.matrix.multiplyMatrices(
            rigidTransform,
            rigid.matrix
          );
        }
        rigid.proxy.matrixWorldNeedsUpdate = true;
      }
      for (const span of cell.spans)
        for (let i = span.start; i < span.start + span.count; i++) {
          const j = i * 3, x = (base.position[j] - cx) * scale, y = (base.position[j + 1] - cy) * scale, z = (base.position[j + 2] - cz) * scale;
          positions.array[j] = cx + sample.offset.x + m[0] * x + m[4] * y + m[8] * z;
          positions.array[j + 1] = cy + sample.offset.y + m[1] * x + m[5] * y + m[9] * z;
          positions.array[j + 2] = cz + sample.offset.z + m[2] * x + m[6] * y + m[10] * z;
          const nx = base.normal[j], ny = base.normal[j + 1], nz = base.normal[j + 2];
          normals.array[j] = m[0] * nx + m[4] * ny + m[8] * nz;
          normals.array[j + 1] = m[1] * nx + m[5] * ny + m[9] * nz;
          normals.array[j + 2] = m[2] * nx + m[6] * ny + m[10] * nz;
          glowColors.array[j] = glowColors.array[j + 1] = glowColors.array[j + 2] = sample.glow;
          if (tangents) {
            const k = i * attributeSizes.tangent, tx = base.tangent[k], ty = base.tangent[k + 1], tz = base.tangent[k + 2];
            tangents.array[k] = m[0] * tx + m[4] * ty + m[8] * tz;
            tangents.array[k + 1] = m[1] * tx + m[5] * ty + m[9] * tz;
            tangents.array[k + 2] = m[2] * tx + m[6] * ty + m[10] * tz;
            if (attributeSizes.tangent === 4)
              tangents.array[k + 3] = base.tangent[k + 3];
          }
        }
    }
    if (changed) {
      positions.needsUpdate = true;
      normals.needsUpdate = true;
      glowColors.needsUpdate = true;
      if (tangents) tangents.needsUpdate = true;
    }
  };
  for (const root of options.hideRoots ?? []) {
    let source = root, background2 = false;
    while (source) {
      background2 ||= source.userData?.worldTravelBackground === true;
      source = source.parent;
    }
    if (!background2 && root && root !== scene && root !== container)
      hide(root);
  }
  setProgress(0);
  let activeHook;
  const isIntact = () => mode === "dissolve" ? progress === 0 : progress === 1;
  const attachHook = () => {
    const hook = {
      previous: scene.onBeforeRender,
      callback: void 0
    };
    hook.callback = function(...args) {
      hook.previous?.apply(this, args);
      if (disposed || parked || activeHook !== hook || isIntact()) return;
      for (const object of originals.keys()) object.visible = false;
    };
    activeHook = hook;
    scene.onBeforeRender = hook.callback;
  };
  const detachHook = () => {
    if (activeHook && scene.onBeforeRender === activeHook.callback)
      scene.onBeforeRender = activeHook.previous;
    activeHook = void 0;
  };
  attachHook();
  let sourceDisposed = false;
  let disposedSourceName = "";
  const sourceLabel = (object) => String(
    object?.name || object?.uuid || object?.constructor?.name || "source"
  ).slice(0, 96);
  const stateLabel = (value) => {
    if (value === null || typeof value !== "object")
      return String(value).slice(0, 64);
    return `${value.constructor?.name ?? "object"}${value.uuid ? `#${String(value.uuid).slice(0, 36)}` : ""}`;
  };
  const firstChangedState = (before, after) => {
    for (let index = 0; index < Math.max(before.length, after.length); index++)
      if (index >= before.length || index >= after.length || !Object.is(before[index], after[index]))
        return index;
    return -1;
  };
  const sourceGeometries = new Set(
    [...preparedSources].map((object) => object.geometry)
  );
  const sourceGeometryDisposed = (event) => {
    sourceDisposed = true;
    const source = [...preparedSources].find(
      (object) => sourceStates.get(object)?.[2] === event?.target
    );
    disposedSourceName = sourceLabel(source ?? event?.target);
  };
  for (const geometry of sourceGeometries)
    geometry?.addEventListener?.("dispose", sourceGeometryDisposed);
  const canReuse = () => {
    const miss = (reason) => {
      stats.reuseMiss = reason;
      return false;
    };
    stats.reuseMiss = "";
    if (disposed) return miss("disposed");
    if (sourceDisposed)
      return miss(`geometry-disposed:${disposedSourceName}`);
    if (!parked && !isIntact()) return miss("active-transition");
    scene.updateMatrixWorld(true);
    const sceneChanged = firstChangedState(
      sceneMatrix,
      scene.matrixWorld.elements
    );
    if (sceneChanged >= 0)
      return miss(
        `scene-matrix[${sceneChanged}]:${stateLabel(
          sceneMatrix[sceneChanged]
        )}->${stateLabel(scene.matrixWorld.elements[sceneChanged])}`
      );
    for (const { root, parent } of sourceRoots)
      if (root?.parent !== parent)
        return miss(
          `${sourceLabel(root)} parent:${stateLabel(
            parent
          )}->${stateLabel(root?.parent)}`
        );
    const present = scanSources();
    for (const object of preparedSources) {
      if (!present.has(object)) {
        let hidden = object;
        while (hidden && hidden.visible !== false)
          hidden = hidden.parent;
        return miss(
          hidden ? `${sourceLabel(object)} hidden:${sourceLabel(hidden)}` : `${sourceLabel(object)} missing-or-excluded`
        );
      }
      const before = sourceStates.get(object), after = sourceState(object);
      const index = firstChangedState(before, after);
      if (index >= 0)
        return miss(
          `${sourceLabel(object)} state[${index}]:${stateLabel(
            before[index]
          )}->${stateLabel(after[index])}`
        );
    }
    return true;
  };
  const park = () => {
    if (disposed) return false;
    if (parked) return true;
    if (!isIntact()) {
      for (const [object, visible] of originals) object.visible = visible;
      scene.background = background;
      scene.fog = fog;
    }
    parked = true;
    container.visible = false;
    container.removeFromParent();
    detachHook();
    return true;
  };
  candidates.length = 0;
  instanceSources.clear();
  geometryBounds.clear();
  materialIds.clear();
  visited.clear();
  batches.clear();
  frontRecords.length = 0;
  auxiliary.clear();
  fixed.clear();
  cells.clear();
  rigidCells.clear();
  return {
    stats,
    setProgress,
    park,
    canReuse,
    getAddedSources() {
      if (disposed) return [];
      scene.updateMatrixWorld(true);
      return addedSources();
    },
    restart(next) {
      let nextAnchor;
      try {
        nextAnchor = snapshotRevealAnchor(next?.anchor);
      } catch {
        return false;
      }
      if (next.mode !== "reveal" && next.mode !== "dissolve" || next.direction !== void 0 && next.direction !== "inward" && next.direction !== "outward" || !canReuse())
        return false;
      for (const object of addedSources())
        if (!(options.hideRoots ?? []).includes(object))
          originals.delete(object);
      park();
      background = scene.background;
      fog = scene.fog;
      for (const object of originals.keys())
        originals.set(object, object.visible);
      for (const record of materialClones) {
        const { source, clone } = record;
        clone.copy(source);
        clone.onBeforeCompile = source.onBeforeCompile;
        clone.customProgramCacheKey = source.customProgramCacheKey;
        if (record.side !== void 0) clone.side = record.side;
        if (record.vertexColors !== void 0)
          clone.vertexColors = record.vertexColors;
        if (record.color)
          clone.color.multiply(
            new THREE.Color().fromArray(record.color)
          );
        clone.needsUpdate = true;
      }
      mode = next.mode;
      direction = next.direction;
      waveExtent = next.waveExtent;
      configureRevealAnchor(nextAnchor);
      parked = false;
      previousProgress = -1;
      scene.add(container);
      setProgress(0);
      attachHook();
      return true;
    },
    setRevealAnchor(nextAnchor, nextWaveExtent) {
      if (disposed || parked) return;
      configureRevealAnchor(nextAnchor, nextWaveExtent);
      previousProgress = -1;
      setProgress(progress);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      detachHook();
      if (!parked) {
        for (const [object, visible] of originals)
          object.visible = visible;
        scene.background = background;
        scene.fog = fog;
      }
      container.removeFromParent();
      geometries.forEach((g) => g.dispose());
      geometries.length = 0;
      container.clear();
      delete container.userData.worldRevealSchedule;
      for (const name of Object.keys(base))
        base[name] = new Float32Array(0);
      for (const attribute of [positions, normals, glowColors, tangents])
        if (attribute) attribute.array = new Float32Array(0);
      glow.dispose();
      backMaterials.forEach((back) => back.dispose());
      backMaterials.clear();
      frontMaterials.forEach((material) => material.dispose());
      frontMaterials.clear();
      colorMaterials.forEach((material) => material.dispose());
      colorMaterials.clear();
      rigidMaterials.forEach((material) => material.dispose());
      rigidMaterials.clear();
      rigidRecords.clear();
      rigidCells.clear();
      motionCells.clear();
      instanceSources.clear();
      geometryBounds.clear();
      candidates.length = 0;
      batches.clear();
      cells.clear();
      originals.clear();
      materialClones.length = 0;
      preparedSources.clear();
      sourceStates.clear();
      sourceRoots.length = 0;
      for (const geometry of sourceGeometries)
        geometry?.removeEventListener?.(
          "dispose",
          sourceGeometryDisposed
        );
      sourceGeometries.clear();
    }
  };
}

// ../oncyber/web/frontend/features/lobby/travelGlowTexture.ts
function createTravelGlowTexture(THREE) {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size * 2 - 1;
      const v = (y + 0.5) / size * 2 - 1;
      const distance = Math.hypot(u, v) - 0.7925;
      const angle = Math.atan2(v, u);
      const angularWidth = angle < 0 ? 0.065 : 0.24;
      const trail = Math.exp(-0.5 * (angle / angularWidth) ** 2);
      const core = Math.exp(-0.5 * (distance / 6e-3) ** 2);
      const bloom = Math.exp(-0.5 * (distance / 0.022) ** 2);
      const index = (y * size + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(
        255 * Math.min(1, trail * (core * 0.9 + bloom * 0.28))
      );
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
function sampleTravelGlowAngle(elapsedMs) {
  const turns = Math.max(0, elapsedMs) / 1e3;
  const tau = Math.PI * 2;
  return -turns * tau - 0.6 * Math.sin(turns % 1 * tau);
}
export {
  createTravelGlowTexture,
  createWorldCubeReveal,
  sampleTravelGlowAngle
};
