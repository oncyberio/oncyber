/** Texture-only refinement of an already built room. No geometry is installed. */
const MAP_SLOTS = [
    "map",
    "alphaMap",
    "aoMap",
    "lightMap",
    "bumpMap",
    "normalMap",
    "displacementMap",
    "emissiveMap",
    "metalnessMap",
    "roughnessMap",
    "clearcoatMap",
    "clearcoatNormalMap",
    "clearcoatRoughnessMap",
    "iridescenceMap",
    "iridescenceThicknessMap",
    "sheenColorMap",
    "sheenRoughnessMap",
    "specularMap",
    "specularColorMap",
    "specularIntensityMap",
    "transmissionMap",
    "thicknessMap",
];
const passes = ["diffuseMaterials", "lightingMaterials", "currentMode"];
const textureImage = (texture) => texture?.source?.data || texture?.image;
const numbers = (value) => value?.toArray?.() || value?.elements || [];
const rounded = (values) =>
    Array.from(values, (value) => Math.round(value * 1e6));
const uvState = (texture) =>
    JSON.stringify([
        texture.channel || 0,
        texture.mapping,
        texture.flipY,
        texture.wrapS,
        texture.wrapT,
        texture.minFilter,
        texture.magFilter,
        rounded(numbers(texture.offset)),
        rounded(numbers(texture.repeat)),
        rounded(numbers(texture.center)),
        Math.round((texture.rotation || 0) * 1e6),
        texture.matrixAutoUpdate === false
            ? rounded(numbers(texture.matrix))
            : null,
    ]);
const transform = (mesh) =>
    JSON.stringify([
        rounded(numbers(mesh.position)),
        rounded(numbers(mesh.quaternion)),
        rounded(numbers(mesh.scale)),
    ]);
const isSurfaceTexture = (texture) =>
    texture?.isTexture &&
    !texture.isCubeTexture &&
    !texture.isVideoTexture &&
    !texture.isDataTexture &&
    !texture.isData3DTexture &&
    !texture.isDataArrayTexture &&
    !texture.isRenderTargetTexture;

function visitRoots(roots, visit) {
    const visited = new Set();
    const walk = (node) => {
        if (!node || visited.has(node)) return;
        visited.add(node);
        visit(node);
        for (const child of node.children || []) walk(child);
    };
    for (const root of Array.isArray(roots) ? roots : [roots]) walk(root);
}

function materialBindings(material, visit, seen = new Set()) {
    if (!material || seen.has(material)) return;
    if (Array.isArray(material)) {
        for (const item of material) materialBindings(item, visit, seen);
        return;
    }
    seen.add(material);
    // Some pipeline materials expose map as a prototype getter.
    for (const key of new Set([...MAP_SLOTS, ...Object.keys(material)])) {
        if (material[key]?.isTexture) visit(material, key, material);
    }
    for (const uniform of Object.values(material.uniforms || {})) {
        if (uniform?.value?.isTexture) visit(uniform, "value", material);
        else if (Array.isArray(uniform?.value)) {
            uniform.value.forEach((value, index) => {
                if (value?.isTexture) visit(uniform.value, index, material);
            });
        }
    }
    for (const key of ["occlusionMaterial", "mirrorMaterial"])
        materialBindings(material[key], visit, seen);
}

function nodeMaterials(node) {
    const result = [
        node.material,
        node.customDepthMaterial,
        node.customDistanceMaterial,
    ];
    for (const pass of passes) result.push(...Object.values(node[pass] || {}));
    return result.filter(Boolean);
}

/** Order-independent vertex/UV signature: reordered buffers remain compatible. */
function uvGeometry(geometry, channel) {
    const position = geometry?.attributes?.position;
    const uv =
        geometry?.attributes?.[channel ? `uv${channel}` : "uv"] ||
        (channel === 1 ? geometry?.attributes?.uv2 : null);
    if (!position || !uv || uv.count !== position.count || uv.itemSize !== 2)
        return null;
    let sum = 0,
        xor = 0,
        mixed = 0;
    for (let i = 0; i < position.count; i++) {
        let hash = 2166136261;
        const values = [
            position.getX(i),
            position.getY(i),
            position.getZ(i),
            uv.getX(i),
            uv.getY(i),
        ];
        if (!values.every(Number.isFinite)) return null;
        for (const value of values)
            hash = Math.imul(hash ^ Math.round(value * 1e5), 16777619);
        sum = (sum + hash) | 0;
        xor ^= hash;
        mixed = (mixed + Math.imul(hash, hash ^ (hash >>> 16))) | 0;
    }
    return `${position.count}:${sum}:${xor}:${mixed}`;
}

export function captureRoomTextureRecords(root) {
    const records = [];
    const walk = (node, path) => {
        // Root names commonly encode the resolution/file name, not semantics.
        const here = node === root ? "" : `${path}/${node.name || ""}`;
        const materials = Array.isArray(node.material)
            ? node.material
            : [node.material];
        const geometryByChannel = new Map();
        for (const material of materials) {
            if (!material) continue;
            for (const slot of MAP_SLOTS) {
                const texture = material[slot];
                if (!isSurfaceTexture(texture)) continue;
                const channel = texture.channel || 0;
                if (!geometryByChannel.has(channel))
                    geometryByChannel.set(
                        channel,
                        uvGeometry(node.geometry, channel)
                    );
                records.push({
                    path: here,
                    meshName: node.name || "",
                    materialName: material.name || "",
                    singleMaterial: materials.length === 1,
                    slot,
                    texture,
                    geometry: geometryByChannel.get(channel),
                    transform: transform(node),
                    uv: uvState(texture),
                });
            }
        }
        for (const child of node.children || []) walk(child, here);
    };
    if (root) walk(root, "");
    return records;
}

function sameImage(a, b) {
    return (
        a === b ||
        (a?.source && a.source === b?.source) ||
        (!!textureImage(a) && textureImage(a) === textureImage(b))
    );
}

// Offline resize rounds integer image dimensions. A thin atlas can have a
// visibly different numeric aspect ratio while differing by under one pixel.
function sameImageAspect(a, b) {
    const scale = Math.min(a.width / b.width, a.height / b.height);
    return (
        Math.abs(a.width - b.width * scale) <= 1 &&
        Math.abs(a.height - b.height * scale) <= 1
    );
}

function largerImage(low, high) {
    const a = textureImage(low),
        b = textureImage(high);
    const aw = a?.width,
        ah = a?.height,
        bw = b?.width,
        bh = b?.height;
    return (
        [aw, ah, bw, bh].every((size) => Number.isFinite(size) && size > 0) &&
        bw >= aw &&
        bh >= ah &&
        (bw > aw || bh > ah) &&
        sameImageAspect(a, b)
    );
}

function matchRecords(lowRecords, highRecords, diagnostics = []) {
    const matched = new Map();
    const alreadyFull = new Map();
    const failures = new Map();
    for (const low of lowRecords) {
        let peers = highRecords.filter(
            (high) => high.path === low.path && high.slot === low.slot
        );
        if (!peers.length && low.meshName)
            peers = highRecords.filter(
                (high) =>
                    high.meshName === low.meshName && high.slot === low.slot
            );
        const named =
            low.materialName &&
            peers.filter((high) => high.materialName === low.materialName);
        if (named?.length) peers = named;
        else if (
            !low.singleMaterial ||
            peers.some((high) => !high.singleMaterial)
        )
            peers = [];
        // Duplicate semantic names can only resolve if their texture and UV
        // assignments agree. Never pair glTF material/texture array positions.
        const safe = peers.filter(
            (high) =>
                low.geometry &&
                high.geometry === low.geometry &&
                high.transform === low.transform &&
                high.uv === low.uv &&
                largerImage(low.texture, high.texture)
        );
        const fullPeers = peers.filter((high) => {
            const a = textureImage(low.texture),
                b = textureImage(high.texture);
            return (
                low.geometry &&
                high.geometry === low.geometry &&
                high.transform === low.transform &&
                high.uv === low.uv &&
                a?.width > 0 &&
                a?.height > 0 &&
                a.width === b?.width &&
                a.height === b?.height
            );
        });
        const fullCandidate = fullPeers[0]?.texture;
        const previousFull = alreadyFull.get(low.texture);
        if (
            !fullCandidate ||
            fullPeers.length !== peers.length ||
            !fullPeers.every((high) =>
                sameImage(high.texture, fullCandidate)
            ) ||
            (previousFull && !sameImage(previousFull, fullCandidate))
        )
            alreadyFull.set(low.texture, null);
        else if (!alreadyFull.has(low.texture) || previousFull !== null)
            alreadyFull.set(low.texture, fullCandidate);
        const candidate = safe[0]?.texture;
        const previous = matched.get(low.texture);
        if (
            !candidate ||
            safe.length !== peers.length ||
            !safe.every((high) => sameImage(high.texture, candidate)) ||
            (previous && !sameImage(previous, candidate))
        ) {
            matched.set(low.texture, null);
            const high = peers[0];
            const a = textureImage(low.texture),
                b = textureImage(high?.texture);
            const reason = !high
                ? "missing-semantic-match"
                : !low.geometry || !high.geometry
                ? "missing-uv"
                : peers.some((peer) => peer.geometry !== low.geometry)
                ? "geometry-uv-mismatch"
                : peers.some((peer) => peer.transform !== low.transform)
                ? "transform-mismatch"
                : peers.some((peer) => peer.uv !== low.uv)
                ? "sampler-uv-mismatch"
                : ![a?.width, a?.height, b?.width, b?.height].every(
                      (size) => Number.isFinite(size) && size > 0
                  )
                ? "unknown-dimensions"
                : a.width === b.width && a.height === b.height
                ? "same-resolution"
                : b.width < a.width || b.height < a.height
                ? "smaller-resolution"
                : !sameImageAspect(a, b)
                ? "aspect-ratio-mismatch"
                : previous && !sameImage(previous, candidate)
                ? "shared-source-conflict"
                : "ambiguous-semantic-match";
            if (!failures.has(low.texture))
                failures.set(low.texture, {
                    reason,
                    mesh: low.meshName.slice(0, 64),
                    material: low.materialName.slice(0, 64),
                    slot: low.slot,
                    low: [a?.width || 0, a?.height || 0],
                    high: [b?.width || 0, b?.height || 0],
                });
        } else if (!matched.has(low.texture) || previous !== null)
            matched.set(low.texture, candidate);
    }
    // Bounded development evidence, with no URLs, image data or object graphs.
    for (const [texture, failure] of failures)
        if (!matched.get(texture) && diagnostics.length < 32)
            diagnostics.push(failure);
    return { matched, alreadyFull };
}

function resources(gltf) {
    const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
    visitRoots([gltf?.scene, ...(gltf?.scenes || [])], (node) => {
        if (node.geometry) geometries.add(node.geometry);
        for (const material of nodeMaterials(node)) {
            const list = Array.isArray(material) ? material : [material];
            for (const item of list) {
                if (!item) continue;
                materials.add(item);
                materialBindings(item, (object, key, owner) => {
                    materials.add(owner);
                    textures.add(object[key]);
                });
            }
        }
    });
    for (const texture of gltf?.textures || [])
        if (texture?.isTexture) textures.add(texture);
    return { geometries, materials, textures };
}

function cloneForBinding(high, low) {
    // Loader stores a mesh on texture.userData; Texture.copy JSON-stringifies
    // userData, so sanitise that field without mutating the donor texture.
    const copy = Object.create(high);
    copy.userData = {};
    const replacement = new high.constructor().copy(copy);
    replacement.name = low.name || high.name;
    for (const key of [
        "mapping",
        "channel",
        "wrapS",
        "wrapT",
        "magFilter",
        "minFilter",
        "anisotropy",
        "rotation",
        "matrixAutoUpdate",
        "premultiplyAlpha",
        "flipY",
        "unpackAlignment",
        "colorSpace",
    ])
        if (key in low) replacement[key] = low[key];
    for (const key of ["offset", "repeat", "center", "matrix"])
        replacement[key]?.copy?.(low[key]);
    replacement.userData.isShared = true;
    replacement.userData.roomTextureUpgradeOwned = true;
    replacement.userData.roomTextureUpgradeLowSize = [
        textureImage(low)?.width,
        textureImage(low)?.height,
    ];
    replacement.needsUpdate = true;
    return replacement;
}

/** Capture before factories convert materials or repurpose the raw template. */
export function captureRoomTextureUpgrade(lowScene) {
    const lowRecords = captureRoomTextureRecords(lowScene);
    const lowResources = resources({ scene: lowScene });
    const lowTextures = [
        ...new Set(lowRecords.map((record) => record.texture)),
    ];
    const bindings = [];
    const bindingKeys = new WeakMap();
    const owned = new Set();
    const retired = new WeakSet();
    const fallbackImages = new Set();
    const protectedImages = new WeakSet();
    const closedImages = new WeakSet();
    const plans = new Set();
    let disposed = false;

    const closeImage = (image) => {
        if (
            !image ||
            protectedImages.has(image) ||
            closedImages.has(image) ||
            fallbackImages.has(image)
        )
            return;
        closedImages.add(image);
        image.close?.();
    };
    const own = (texture) => {
        if (
            texture.userData?.isShared &&
            !texture.userData?.roomTextureUpgradeOwned
        ) {
            const image = textureImage(texture);
            if (image && typeof image === "object") protectedImages.add(image);
            return;
        }
        texture.userData ||= {};
        texture.userData.isShared = true;
        texture.userData.roomTextureUpgradeOwned = true;
        owned.add(texture);
    };
    const bind = (roots) => {
        if (disposed) return;
        visitRoots(roots, (node) => {
            for (const material of nodeMaterials(node))
                materialBindings(material, (object, key, owner) => {
                    const texture = object[key];
                    const sources = lowTextures.filter((low) =>
                        sameImage(low, texture)
                    );
                    if (!sources.length) return;
                    let keys = bindingKeys.get(object);
                    if (!keys) bindingKeys.set(object, (keys = new Set()));
                    if (keys.has(key)) return;
                    keys.add(key);
                    bindings.push({
                        object,
                        key,
                        material: owner,
                        texture,
                        sources,
                    });
                    own(texture);
                });
        });
    };
    bind(lowScene);

    const retireReplaced = () => {
        const oldTextures = new Set(bindings.map((binding) => binding.texture));
        for (const texture of oldTextures) {
            if (
                !owned.has(texture) ||
                retired.has(texture) ||
                bindings.some(
                    (binding) => binding.object[binding.key] === texture
                )
            )
                continue;
            texture.dispose?.();
            retired.add(texture);
            const image = textureImage(texture);
            if (
                !bindings.some(
                    (binding) =>
                        textureImage(binding.object[binding.key]) === image
                )
            )
                closeImage(image);
        }
    };

    const plan = (highGLTF) => {
        const donor = resources(highGLTF);
        for (const texture of donor.textures)
            if (texture.userData?.isShared) {
                const image = textureImage(texture);
                if (image && typeof image === "object")
                    protectedImages.add(image);
            }
        const highRecords = disposed
            ? []
            : highGLTF?.roomTextureRecords ||
              captureRoomTextureRecords(highGLTF?.scene);
        const diagnostics = [];
        const { matched: mapping, alreadyFull } = matchRecords(
            lowRecords,
            highRecords,
            diagnostics
        );
        const fullTextures = new Set(
            bindings
                .filter((binding) => {
                    if (binding.object[binding.key] !== binding.texture)
                        return false;
                    const candidates = binding.sources.map((source) =>
                        alreadyFull.get(source)
                    );
                    return (
                        candidates[0] &&
                        candidates.every(
                            (candidate) =>
                                candidate && sameImage(candidate, candidates[0])
                        )
                    );
                })
                .map((binding) => binding.texture)
        );
        const groups = new Map();
        for (const binding of disposed ? [] : bindings) {
            if (binding.object[binding.key] !== binding.texture) continue;
            const candidates = binding.sources.map((source) =>
                mapping.get(source)
            );
            const high = candidates[0];
            if (
                !high ||
                !candidates.every(
                    (candidate) => candidate && sameImage(candidate, high)
                )
            )
                continue;
            let group = groups.get(binding.texture);
            if (!group)
                groups.set(
                    binding.texture,
                    (group = {
                        texture: cloneForBinding(high, binding.texture),
                        bindings: [],
                        installed: false,
                    })
                );
            group.bindings.push(binding);
        }
        let released = false;
        const total = new Set(bindings.map((binding) => binding.texture)).size;
        const result = {
            diagnostics,
            textures: [...groups.values()].map((group) => group.texture),
            get stats() {
                return {
                    total,
                    matched: groups.size,
                    alreadyFull: fullTextures.size,
                    applied: [...groups.values()].filter(
                        (group) => group.installed
                    ).length,
                };
            },
            steps(uploadTexture = () => {}) {
                return [...groups.values()].map((group) => () => {
                    if (disposed || released || group.installed) return;
                    const live = group.bindings.filter(
                        (binding) =>
                            binding.object[binding.key] === binding.texture
                    );
                    if (!live.length) return;
                    const install = (uploaded) => {
                        // null explicitly means incremental upload is unsupported;
                        // preserve low detail rather than falling back to a stall.
                        if (uploaded === null) return;
                        const replacement = uploaded?.isTexture
                            ? uploaded
                            : group.texture;
                        if (disposed || released) {
                            if (replacement !== group.texture)
                                replacement.dispose?.();
                            return;
                        }
                        const remaining = live.filter(
                            (binding) =>
                                binding.object[binding.key] === binding.texture
                        );
                        if (!remaining.length) {
                            if (replacement !== group.texture)
                                replacement.dispose?.();
                            return;
                        }
                        if (replacement !== group.texture) {
                            group.texture.dispose();
                            group.texture = replacement;
                        }
                        replacement.userData ||= {};
                        replacement.userData.isShared = true;
                        replacement.userData.roomTextureUpgradeOwned = true;
                        for (const binding of remaining) {
                            // Keep small CPU fallback images for WebGL recovery.
                            // Their old GPU allocations are still retired below.
                            if (replacement.isFramebufferTexture)
                                fallbackImages.add(
                                    textureImage(binding.texture)
                                );
                            binding.object[binding.key] = replacement;
                            // Texture-to-texture swaps do not change shader defines.
                            // Avoid recompiling every room material during movement.
                        }
                        group.installed = true;
                        owned.add(replacement);
                        retireReplaced();
                    };
                    const upload = uploadTexture(group.texture);
                    return upload?.then
                        ? upload.then(install)
                        : install(upload);
                });
            },
            dispose() {
                if (released) return;
                released = true;
                plans.delete(result);
                // Material.dispose alone does not traverse its textures. Keep
                // installed image sources alive while dropping all donor meshes.
                for (const material of donor.materials)
                    if (
                        !lowResources.materials.has(material) &&
                        !material.userData?.isShared
                    )
                        material.dispose?.();
                for (const geometry of donor.geometries)
                    if (
                        !lowResources.geometries.has(geometry) &&
                        !geometry.userData?.isShared
                    )
                        geometry.dispose?.();
                const retainedImages = new Set([...owned].map(textureImage));
                for (const group of groups.values())
                    if (!group.installed) group.texture.dispose();
                for (const texture of donor.textures) {
                    if (
                        lowResources.textures.has(texture) ||
                        texture.userData?.isShared
                    )
                        continue;
                    texture.dispose?.();
                    if (!retainedImages.has(textureImage(texture)))
                        closeImage(textureImage(texture));
                }
            },
        };
        plans.add(result);
        return result;
    };
    return {
        bind,
        plan,
        restoreLowTextureBindings() {
            if (disposed) return;
            const replaced = new Set();
            for (const binding of bindings) {
                const current = binding.object[binding.key];
                if (!current?.isFramebufferTexture || !owned.has(current))
                    continue;
                replaced.add(current);
                binding.object[binding.key] = binding.texture;
                binding.texture.needsUpdate = true;
                retired.delete(binding.texture);
            }
            for (const texture of replaced) {
                texture.dispose?.();
                owned.delete(texture);
            }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const pending of plans) pending.dispose();
            for (const texture of owned)
                if (!retired.has(texture)) texture.dispose?.();
            fallbackImages.clear();
            for (const texture of owned) closeImage(textureImage(texture));
            owned.clear();
            bindings.length = 0;
            lowRecords.length = 0;
            lowTextures.length = 0;
            lowResources.materials.clear();
            lowResources.geometries.clear();
            lowResources.textures.clear();
        },
    };
}
