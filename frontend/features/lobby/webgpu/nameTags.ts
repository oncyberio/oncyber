import * as THREE from "three/webgpu";
import {
    Discard,
    Fn,
    If,
    attribute,
    cameraPosition,
    cameraViewMatrix,
    cross,
    distance,
    normalize,
    positionLocal,
    sRGBTransferEOTF,
    smoothstep,
    texture as textureNode,
    uv,
    varyingProperty,
    vec2,
    vec3,
    vec4,
} from "three/tsl";

/**
 * Lobby name tags: the multiplayer-space usernames, ported.
 *
 * Look and mechanics follow the engine's InstanceUserName
 * (components/_3DExhibit-v2/three/factory/player/instanceusername): the same
 * UsernameGenerator canvas (bold Space Grotesk, white, avatar bubble left of
 * the centred name), packed into a shared atlas and drawn as one instanced
 * camera-facing billboard with the same size, alpha test and close fade.
 * That module hangs off the gallery engine's singletons (PipeLineMesh,
 * Emitter, Players), so the lobby carries this standalone copy instead of
 * importing the engine.
 *
 * Lobby-specific: tags are written every frame from the rendered avatar
 * positions (no 10 Hz DOM projection), the atlas is mipmapped, and new tiles
 * are uploaded in batches.
 */

const MOBILE =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(pointer: coarse)").matches ?? false);
// instanceusername/constants.js CANVAS_SIZE
const CANVAS_W = 256 * (MOBILE ? 1 : 2);
const CANVAS_H = 50 * (MOBILE ? 1 : 2);
const FONT_SIZE = 27 * (MOBILE ? 1 : 2);
const ASPECT = CANVAS_W / CANVAS_H;
// instanceusername/basegeometry.js and material SIZE.
const PLANE_H = 0.4 * 0.75;
const PLANE_W = PLANE_H * ASPECT;

/** The name tag's picture, against the engine tag's (UsernameGenerator). */
export const TAG_PHOTO_SCALE = 0.85;

const ATLAS = 2048;
const COLUMNS = Math.floor(ATLAS / CANVAS_W);
const ROWS = Math.floor(ATLAS / CANVAS_H);
const TILES = COLUMNS * ROWS;
const UPLOAD_MS = 100;
const FONT = "SpaceGrotesk";

type Tile = {
    index: number;
    key: string;
    lastUsed: number;
    image?: HTMLImageElement;
};

type Shown = {
    id: string;
    tile: Tile;
    x: number;
    y: number;
    z: number;
    distance: number;
    pinned?: boolean;
};

/** UsernameGenerator.get, drawn into an atlas tile instead of its own canvas. */
function drawUsername(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    username: string,
    avatar: CanvasImageSource | null
) {
    if (username.startsWith("Anon-")) username = "Anon";
    const textOnly = !avatar;
    const name =
        !textOnly && username.length > 18
            ? `${username.slice(0, 18)}...`
            : username;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, CANVAS_W, CANVAS_H);
    ctx.clip();
    ctx.clearRect(ox, oy, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${
        FONT_SIZE * 0.5
    }px/${FONT_SIZE}px '${FONT}', Arial, sans-serif`;
    ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    ctx.shadowBlur = 1;
    ctx.lineWidth = 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, ox + CANVAS_W / 2, oy + CANVAS_H / 2, CANVAS_W - 8);
    if (!textOnly) {
        const metrics = ctx.measureText(name);
        const margin = 10;
        // the picture is 15% smaller than the engine's tag
        const imgSize = (CANVAS_W / 10) * TAG_PHOTO_SCALE;
        const cx =
            ox + CANVAS_W / 2 - (metrics.width / 2 + imgSize / 2 + margin);
        const cy = oy + CANVAS_H / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, imgSize / 2, 0, Math.PI * 2, false);
        ctx.clip();
        try {
            ctx.drawImage(
                avatar,
                cx - imgSize / 2,
                cy - imgSize / 2,
                imgSize,
                imgSize
            );
        } catch {
            // A tag without the avatar bubble beats a broken frame.
        }
    }
    ctx.restore();
}

export function createNameTags(scene: THREE.Scene, capacity = 64) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = ATLAS;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Name tag atlas unavailable");
    const atlas = new THREE.CanvasTexture(canvas);
    atlas.flipY = false;
    atlas.generateMipmaps = true;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    atlas.anisotropy = 4;

    const base = new THREE.PlaneGeometry(PLANE_W, PLANE_H);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute("position", base.getAttribute("position"));
    geometry.setAttribute("uv", base.getAttribute("uv"));
    const offsets = new THREE.InstancedBufferAttribute(
        new Float32Array(capacity * 3),
        3
    ).setUsage(THREE.DynamicDrawUsage);
    // uv scale xy, uv offset zw (InstanceUserName's `atlas` attribute)
    const rects = new THREE.InstancedBufferAttribute(
        new Float32Array(capacity * 4),
        4
    ).setUsage(THREE.DynamicDrawUsage);
    const opacities = new THREE.InstancedBufferAttribute(
        new Float32Array(capacity),
        1
    ).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("offset", offsets);
    geometry.setAttribute("atlas", rects);
    geometry.setAttribute("opacity", opacities);
    geometry.instanceCount = 0;

    // instanceusername/material: billboard around `offset`, faded up close.
    const material = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        fog: false,
    });
    // Billboards always face the camera: one pass, one draw.
    material.forceSinglePass = true;
    const offset = attribute("offset", "vec3");
    material.positionNode = Fn(() => {
        const viewZ = vec3(
            cameraViewMatrix[0].z,
            cameraViewMatrix[1].z,
            cameraViewMatrix[2].z
        );
        const cameraUp = vec3(
            cameraViewMatrix[0].y,
            cameraViewMatrix[1].y,
            cameraViewMatrix[2].y
        );
        const look = normalize(cameraPosition.add(viewZ.mul(1500)).sub(offset));
        const right = cross(look, cameraUp);
        const up = cross(right, look);
        const position = offset
            .add(right.mul(positionLocal.x))
            .add(up.mul(positionLocal.y));
        varyingProperty("float", "vClose").assign(
            // Only fades when it would fill the view; tags stay up close.
            smoothstep(0.4, 1, distance(cameraPosition, position))
        );
        return position;
    })();
    const rect = attribute("atlas", "vec4");
    const opacity = attribute("opacity", "float");
    // Unflipped atlas seen through the billboard basis: flip both axes.
    const texel = textureNode(
        atlas,
        vec2(uv().x.oneMinus(), uv().y.oneMinus()).mul(rect.xy).add(rect.zw)
    );
    material.colorNode = Fn(() => {
        const sample = texel.toVar();
        // opacity 2 marks a tag that stays up close (your own).
        const alpha = sample.a
            .mul(opacity.min(1))
            .mul(varyingProperty("float", "vClose").max(opacity.sub(1)));
        If(alpha.lessThan(0.5), () => {
            Discard();
        });
        return vec4(sRGBTransferEOTF(sample.rgb), alpha);
    })();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "lobby-name-tags";
    mesh.frustumCulled = false;
    scene.add(mesh);

    const tiles = new Map<string, Tile>();
    const free = Array.from({ length: TILES }, (_, i) => TILES - 1 - i);
    let shown: Shown[] = [];
    let dirty = false;
    let lastUpload = 0;
    let disposed = false;

    const origin = (index: number) => ({
        x: (index % COLUMNS) * CANVAS_W,
        y: Math.floor(index / COLUMNS) * CANVAS_H,
    });
    const paint = (tile: Tile, name: string) => {
        const { x, y } = origin(tile.index);
        const image =
            tile.image?.complete && tile.image.naturalWidth ? tile.image : null;
        drawUsername(context, x, y, name, image);
        dirty = true;
    };
    // Space Grotesk is a web font: repaint once it's ready.
    void document.fonts
        ?.load(`bold ${FONT_SIZE * 0.5}px '${FONT}'`)
        .then(() => {
            if (disposed) return;
            for (const tile of tiles.values())
                paint(tile, tile.key.split("\u0000")[0]);
        })
        .catch(() => {});

    function acquire(name: string, photo: string, now: number) {
        const key = `${name}\u0000${photo}`;
        let tile = tiles.get(key);
        if (tile) {
            tile.lastUsed = now;
            return tile;
        }
        let index = free.pop();
        if (index === undefined) {
            let oldest: Tile | undefined;
            for (const candidate of tiles.values())
                if (
                    candidate.lastUsed < now &&
                    (!oldest || candidate.lastUsed < oldest.lastUsed)
                )
                    oldest = candidate;
            if (!oldest) return null;
            tiles.delete(oldest.key);
            index = oldest.index;
        }
        tile = { index, key, lastUsed: now };
        tiles.set(key, tile);
        if (photo) {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.decoding = "async";
            tile.image = image;
            const current = tile;
            image.onload = () => {
                if (!disposed && tiles.get(key) === current)
                    paint(current, name);
            };
            image.src = photo;
        }
        paint(tile, name);
        return tile;
    }

    return {
        mesh,
        get count() {
            return geometry.instanceCount;
        },
        begin() {
            shown = [];
        },
        /** y is the top of the head; the tag sits above it like in spaces. */
        show(
            id: string,
            name: string,
            photo: string,
            x: number,
            y: number,
            z: number,
            /** Keep it visible next to the camera (your own tag). */
            pinned = false
        ) {
            if (shown.length >= capacity) return;
            const tile = acquire(
                name || "Guest",
                photo || "",
                performance.now()
            );
            if (tile) shown.push({ id, tile, x, y, z, distance: 0, pinned });
        },
        end(camera: THREE.Camera) {
            const now = performance.now();
            const eye = camera.position;
            // Back to front, so the anti-aliased edges blend over farther tags.
            for (const tag of shown)
                tag.distance =
                    (tag.x - eye.x) ** 2 +
                    (tag.y - eye.y) ** 2 +
                    (tag.z - eye.z) ** 2;
            shown.sort((a, b) => b.distance - a.distance);
            shown.forEach((tag, i) => {
                const { x, y } = origin(tag.tile.index);
                offsets.setXYZ(i, tag.x, tag.y, tag.z);
                rects.setXYZW(
                    i,
                    CANVAS_W / ATLAS,
                    CANVAS_H / ATLAS,
                    x / ATLAS,
                    y / ATLAS
                );
                opacities.setX(i, tag.pinned ? 2 : 1);
            });
            geometry.instanceCount = shown.length;
            if (shown.length) {
                offsets.needsUpdate = true;
                rects.needsUpdate = true;
                opacities.needsUpdate = true;
            }
            if (dirty && now - lastUpload >= UPLOAD_MS) {
                dirty = false;
                lastUpload = now;
                atlas.needsUpdate = true;
            }
        },
        dispose() {
            disposed = true;
            scene.remove(mesh);
            geometry.dispose();
            base.dispose();
            material.dispose();
            atlas.dispose();
            tiles.clear();
        },
    };
}

export type NameTags = ReturnType<typeof createNameTags>;
