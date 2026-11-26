import * as THREE from "three/webgpu";
import {
    Fn,
    abs,
    attribute,
    cameraPosition,
    cameraViewMatrix,
    distance,
    float as tslFloat,
    fwidth,
    length,
    max,
    min,
    mix,
    normalize,
    positionLocal,
    select,
    smoothstep,
    texture as textureNode,
    uv,
    varyingProperty,
    vec2,
    vec3,
    vec4,
    Discard,
    If,
} from "three/tsl";
import { actionTokens } from "@styles/tokens/action";
import { lobbyTokens } from "@styles/tokens/lobby";
import { coverageToSdf } from "./sdf";
import {
    Glyph,
    TagText,
    emMetres,
    fitName,
    layoutTag,
    tagName,
} from "./layout";

/**
 * Name tags over avatars, in the lobby and in spaces: the visitor's picture
 * and name in a small glass chip, drawn in the 3D scene.
 *
 * The text is a signed distance field, built at runtime from the site's own
 * font (Aeonik where the licensed files are deployed), so it stays sharp at
 * every distance and size instead of blurring like a bitmap. The chip and
 * the round picture are shaped in the shader. Everything is one instanced
 * draw, depth tested, so walls still hide tags and VR shows them in both
 * eyes. Tags keep a readable size on screen (lobbyTokens.nameTag).
 */

const T = lobbyTokens.nameTag;
const FAMILY = actionTokens.type.family;
const WEIGHT = 500;
/** Glyph raster size; the field keeps edges sharp far above it. */
const GLYPH_PX = 42;
const BUFFER = 7;
const RADIUS = 7;
const ROW_PX = Math.ceil(GLYPH_PX * 1.45) + 2 * BUFFER;
const GLYPH_ATLAS = 1024;
const PHOTO_ATLAS = 1024;
const PHOTO_PX = 128;
const PHOTO_COLUMNS = PHOTO_ATLAS / PHOTO_PX;
const PHOTO_TILES = PHOTO_COLUMNS * PHOTO_COLUMNS;
/** A tag is the chip, the picture and up to this many glyphs. */
const MAX_GLYPHS = 30;
const UPLOAD_MS = 80;
/** Metres a tag is drawn toward the camera; see positionNode. */
const DEPTH_BIAS = 0.3;
/** How far the rim moves the chip's fill toward white, and its extra opacity. */
const RIM_MIX = 0.38;
const RIM_ALPHA = 0.2;

function hexColor(hex: string) {
    const value = hex.replace("#", "");
    const color = new THREE.Color(`#${value.slice(0, 6)}`);
    const alpha = value.length >= 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1;
    return { color, alpha };
}

type Photo = { index: number; url: string; lastUsed: number };

type Shown = {
    text: TagText;
    photo: Photo | null;
    x: number;
    y: number;
    z: number;
    opacity: number;
    pinned: boolean;
    depth: number;
};

export type NameTagOptions = {
    /** Fade a tag out between these camera distances (metres). */
    closeFade?: [number, number];
    /** Shown when a picture fails to load. */
    fallbackPhoto?: string;
    /**
     * Wraps the tags' geometry and materials in the engine's own mesh type
     * (spaces route meshes through their render pipeline).
     */
    createMesh?: (
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        occlusionMaterial: THREE.Material
    ) => THREE.Mesh;
};

export function createNameTags(
    parent: THREE.Object3D,
    capacity = 64,
    options: NameTagOptions = {}
) {
    const [closeNear, closeFar] = options.closeFade ?? [0.4, 1];
    const maxInstances = capacity * (MAX_GLYPHS + 2);

    // Glyphs: coverage drawn by the browser, turned into distance.
    const scratch = document.createElement("canvas");
    scratch.width = GLYPH_PX * 3 + 2 * BUFFER;
    scratch.height = ROW_PX;
    const scratchContext = scratch.getContext("2d", {
        willReadFrequently: true,
    });
    if (!scratchContext) throw new Error("Name tag glyphs unavailable");
    const fontCss = `${WEIGHT} ${GLYPH_PX}px ${FAMILY}`;
    const glyphData = new Uint8Array(GLYPH_ATLAS * GLYPH_ATLAS);
    const glyphTexture = new THREE.DataTexture(
        glyphData,
        GLYPH_ATLAS,
        GLYPH_ATLAS,
        THREE.RedFormat,
        THREE.UnsignedByteType
    );
    glyphTexture.minFilter = THREE.LinearFilter;
    glyphTexture.magFilter = THREE.LinearFilter;
    glyphTexture.generateMipmaps = false;
    glyphTexture.flipY = false;
    glyphTexture.needsUpdate = true;
    let glyphs = new Map<string, Glyph>();
    let texts = new Map<string, TagText>();
    let capHeight = 0.7;
    let shelfX = 0;
    let shelfY = 0;
    let generation = 0;

    const resetGlyphs = () => {
        glyphs = new Map();
        texts = new Map();
        glyphData.fill(0);
        shelfX = shelfY = 0;
        generation++;
        scratchContext.font = fontCss;
        const cap = scratchContext.measureText("H").actualBoundingBoxAscent;
        if (cap > 0) capHeight = cap / GLYPH_PX;
        dirty = true;
    };

    function rasterGlyph(char: string): Glyph | null {
        const ctx = scratchContext;
        ctx.font = fontCss;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        const m = ctx.measureText(char);
        const ascent = Math.ceil(m.actualBoundingBoxAscent || 0);
        const descent = Math.ceil(m.actualBoundingBoxDescent || 0);
        const left = Math.ceil(m.actualBoundingBoxLeft || 0);
        const inkWidth = Math.min(
            scratch.width - 2 * BUFFER,
            Math.ceil((m.actualBoundingBoxRight || 0) + left)
        );
        const inkHeight = Math.min(ROW_PX - 2 * BUFFER, ascent + descent);
        if (inkWidth <= 0 || inkHeight <= 0)
            return {
                u: 0,
                v: 0,
                du: 0,
                dv: 0,
                left: 0,
                top: 0,
                width: 0,
                height: 0,
            };
        const w = inkWidth + 2 * BUFFER;
        const h = inkHeight + 2 * BUFFER;
        if (shelfX + w > GLYPH_ATLAS) {
            shelfX = 0;
            shelfY += ROW_PX;
        }
        if (shelfY + ROW_PX > GLYPH_ATLAS) return null;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#fff";
        ctx.fillText(char, BUFFER + left, BUFFER + ascent);
        const pixels = ctx.getImageData(0, 0, w, h).data;
        const alpha = new Uint8Array(w * h);
        for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3];
        const field = coverageToSdf(alpha, w, h, RADIUS);
        for (let row = 0; row < h; row++)
            glyphData.set(
                field.subarray(row * w, row * w + w),
                (shelfY + row) * GLYPH_ATLAS + shelfX
            );
        const glyph: Glyph = {
            u: shelfX / GLYPH_ATLAS,
            v: shelfY / GLYPH_ATLAS,
            du: w / GLYPH_ATLAS,
            dv: h / GLYPH_ATLAS,
            left: (-left - BUFFER) / GLYPH_PX,
            top: (ascent + BUFFER) / GLYPH_PX,
            width: w / GLYPH_PX,
            height: h / GLYPH_PX,
        };
        shelfX += w + 1;
        dirty = true;
        return glyph;
    }

    const measure = (text: string) => {
        scratchContext.font = fontCss;
        return scratchContext.measureText(text).width / GLYPH_PX;
    };

    function textFor(name: string): TagText | null {
        const cached = texts.get(name);
        if (cached) return cached;
        const fitted = Array.from(fitName(Array.from(name), measure));
        const placed: TagText["glyphs"] = [];
        let prefix = "";
        for (const char of fitted.slice(0, MAX_GLYPHS)) {
            // Prefix widths keep the font's kerning between letters.
            const x = measure(prefix);
            prefix += char;
            let glyph = glyphs.get(char);
            if (!glyph) {
                const made = rasterGlyph(char);
                if (!made) {
                    // Atlas full: start over with just what's on screen now.
                    resetGlyphs();
                    return null;
                }
                glyph = made;
                glyphs.set(char, glyph);
            }
            placed.push({ glyph, x });
        }
        const text = { glyphs: placed, width: measure(prefix) };
        if (texts.size > 512) texts.clear();
        texts.set(name, text);
        return text;
    }

    // Pictures: square tiles; the shader rounds them.
    const photoCanvas = document.createElement("canvas");
    photoCanvas.width = photoCanvas.height = PHOTO_ATLAS;
    const photoContext = photoCanvas.getContext("2d");
    if (!photoContext) throw new Error("Name tag pictures unavailable");
    const photoTexture = new THREE.CanvasTexture(photoCanvas);
    photoTexture.flipY = false;
    photoTexture.colorSpace = THREE.SRGBColorSpace;
    photoTexture.generateMipmaps = true;
    photoTexture.minFilter = THREE.LinearMipmapLinearFilter;
    photoTexture.magFilter = THREE.LinearFilter;
    photoTexture.anisotropy = 4;
    const photos = new Map<string, Photo>();
    const freePhotos = Array.from(
        { length: PHOTO_TILES },
        (_, i) => PHOTO_TILES - 1 - i
    );
    let disposed = false;
    let dirty = true;
    let lastUpload = 0;

    const paintPhoto = (photo: Photo, image: HTMLImageElement | null) => {
        const x = (photo.index % PHOTO_COLUMNS) * PHOTO_PX;
        const y = Math.floor(photo.index / PHOTO_COLUMNS) * PHOTO_PX;
        photoContext.fillStyle = T.photoFill;
        photoContext.fillRect(x, y, PHOTO_PX, PHOTO_PX);
        if (image?.naturalWidth) {
            // Cover the tile, like object-fit: cover.
            const side = Math.min(image.naturalWidth, image.naturalHeight);
            try {
                photoContext.drawImage(
                    image,
                    (image.naturalWidth - side) / 2,
                    (image.naturalHeight - side) / 2,
                    side,
                    side,
                    x,
                    y,
                    PHOTO_PX,
                    PHOTO_PX
                );
            } catch {
                // An empty bubble beats a broken frame.
            }
        }
        dirty = true;
    };

    function photoFor(url: string, now: number) {
        let photo = photos.get(url);
        if (photo) {
            photo.lastUsed = now;
            return photo;
        }
        let index = freePhotos.pop();
        if (index === undefined) {
            let oldest: Photo | undefined;
            for (const candidate of photos.values())
                if (
                    candidate.lastUsed < now &&
                    (!oldest || candidate.lastUsed < oldest.lastUsed)
                )
                    oldest = candidate;
            if (!oldest) return null;
            photos.delete(oldest.url);
            index = oldest.index;
        }
        photo = { index, url, lastUsed: now };
        photos.set(url, photo);
        paintPhoto(photo, null);
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        const current = photo;
        image.onload = () => {
            if (!disposed && photos.get(url) === current)
                paintPhoto(current, image);
        };
        image.onerror = () => {
            const fallback = options.fallbackPhoto;
            if (fallback && image.src !== fallback) image.src = fallback;
        };
        image.src = url;
        return photo;
    }

    // One instanced quad per piece.
    const base = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute("position", base.getAttribute("position"));
    geometry.setAttribute("uv", base.getAttribute("uv"));
    const attr = (size: number) =>
        new THREE.InstancedBufferAttribute(
            new Float32Array(maxInstances * size),
            size
        ).setUsage(THREE.DynamicDrawUsage);
    // xyz: the tag's centre in the world; w: metres per em.
    const anchors = attr(4);
    // xy: piece centre in ems; zw: piece size in ems.
    const quads = attr(4);
    // An atlas rectangle, or the chip's width, height and shadow margin.
    const rects = attr(4);
    // x: kind; y: opacity (2 marks your own tag, which stays up close).
    const styles = attr(2);
    geometry.setAttribute("anchor", anchors);
    geometry.setAttribute("quad", quads);
    geometry.setAttribute("rect", rects);
    geometry.setAttribute("tagStyle", styles);
    geometry.instanceCount = 0;

    const fill = hexColor(T.fill);
    const rim = hexColor(T.border);
    const ink = new THREE.Color(T.ink);

    function buildMaterial(occlusion: boolean) {
        const material = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false,
        });
        material.toneMapped = false;
        material.forceSinglePass = true;
        const anchor = attribute("anchor", "vec4");
        const quad = attribute("quad", "vec4");
        const rect = attribute("rect", "vec4");
        const style = attribute("tagStyle", "vec2");
        material.positionNode = Fn(() => {
            // Facing the screen: the camera's own right and up axes.
            const right = vec3(
                cameraViewMatrix[0].x,
                cameraViewMatrix[1].x,
                cameraViewMatrix[2].x
            );
            const up = vec3(
                cameraViewMatrix[0].y,
                cameraViewMatrix[1].y,
                cameraViewMatrix[2].y
            );
            const local = quad.xy.add(positionLocal.xy.mul(quad.zw));
            varyingProperty("float", "vClose").assign(
                smoothstep(
                    tslFloat(closeNear),
                    tslFloat(closeFar),
                    distance(cameraPosition, anchor.xyz)
                )
            );
            // Drawn a little toward the camera, so a tag grown to its
            // readable size doesn't cut into the wall right behind its owner.
            const toCamera = normalize(cameraPosition.sub(anchor.xyz));
            return anchor.xyz
                .add(right.mul(local.x).add(up.mul(local.y)).mul(anchor.w))
                .add(toCamera.mul(DEPTH_BIAS));
        })();
        const glyphSample = textureNode(
            glyphTexture,
            vec2(
                rect.x.add(uv().x.mul(rect.z)),
                rect.y.add(uv().y.oneMinus().mul(rect.w))
            )
        );
        const photoSample = textureNode(
            photoTexture,
            vec2(
                rect.x.add(uv().x.mul(rect.z)),
                rect.y.add(uv().y.oneMinus().mul(rect.w))
            )
        );
        material.colorNode = Fn(() => {
            const kind = style.x;
            const opacity = style.y;
            const centred = uv().sub(0.5);

            // Chip: a pill, a one pixel rim and a soft shadow.
            const p = centred.mul(quad.zw);
            const half = rect.xy.mul(0.5);
            const radius = half.y;
            const q = abs(p).sub(half).add(radius);
            const d = length(max(q, vec2(0)))
                .add(min(max(q.x, q.y), 0))
                .sub(radius);
            const aa = max(fwidth(d), 0.0001);
            const inside = smoothstep(aa.mul(0.5), aa.mul(-0.5), d);
            // A steady 1.5 px rim just inside the edge: thinner rims
            // alias away on some edges at small sizes.
            const ring = smoothstep(aa.mul(2), aa.mul(1.5), d.negate());
            const chipRgb = mix(
                vec3(fill.color.r, fill.color.g, fill.color.b),
                vec3(rim.color.r, rim.color.g, rim.color.b),
                ring.mul(RIM_MIX)
            );
            const chipBody = mix(
                tslFloat(fill.alpha),
                tslFloat(Math.min(1, fill.alpha + RIM_ALPHA)),
                ring
            ).mul(inside);
            const shadow = smoothstep(rect.z, 0, max(d, 0))
                .mul(0.32)
                .mul(inside.oneMinus());
            const chipAlpha = chipBody.add(shadow);
            const chipColor = chipRgb.mul(chipBody.div(max(chipAlpha, 0.0001)));

            // Glyph: cut the field at its outline, one screen pixel soft.
            const field = glyphSample.r;
            const w = max(fwidth(field).mul(0.75), 1 / 255);
            const glyphAlpha = smoothstep(
                tslFloat(0.5).sub(w),
                tslFloat(0.5).add(w),
                field
            );

            // Picture: a circle.
            const r = length(centred);
            const ra = max(fwidth(r), 0.0001);
            const photoAlpha = smoothstep(
                tslFloat(0.5),
                tslFloat(0.5).sub(ra),
                r
            );

            const isChip = kind.lessThan(0.5);
            const isGlyph = kind.lessThan(1.5);
            const color = occlusion
                ? vec3(0)
                : select(
                      isChip,
                      chipColor,
                      select(
                          isGlyph,
                          vec3(ink.r, ink.g, ink.b),
                          photoSample.rgb
                      )
                  );
            const shape = select(
                isChip,
                chipAlpha,
                select(isGlyph, glyphAlpha, photoAlpha)
            );
            const alpha = shape
                .mul(opacity.min(1))
                .mul(varyingProperty("float", "vClose").max(opacity.sub(1)));
            If(alpha.lessThan(0.004), () => {
                Discard();
            });
            return vec4(color, alpha);
        })();
        return material;
    }

    const material = buildMaterial(false);
    const occlusionMaterial = buildMaterial(true);
    const mesh = options.createMesh
        ? options.createMesh(geometry, material, occlusionMaterial)
        : new THREE.Mesh(geometry, material);
    mesh.name = "name-tags";
    mesh.frustumCulled = false;
    // Over the scene's other see-through things, under nothing solid.
    mesh.renderOrder = 10;
    parent.add(mesh);

    // The font is a web font: redraw every glyph once it (or a fallback
    // swap) finishes loading.
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    const onFonts = () => {
        if (!disposed) resetGlyphs();
    };
    fonts?.addEventListener?.("loadingdone", onFonts);
    void fonts
        ?.load(fontCss)
        .then(onFonts)
        .catch(() => {});
    resetGlyphs();

    let shown: Shown[] = [];
    let skipped = 0;

    return {
        mesh,
        /** Tags drawn last frame. */
        get count() {
            return shown.length;
        },
        begin() {
            shown = [];
            skipped = 0;
        },
        /** x, y, z is the tag's centre, just above the head. */
        show(
            id: string,
            name: string,
            photoUrl: string,
            x: number,
            y: number,
            z: number,
            /** Keep it visible next to the camera (your own tag). */
            pinned = false,
            opacity = 1
        ) {
            void id;
            if (shown.length >= capacity || opacity <= 0.004) return;
            const startGeneration = generation;
            let text = textFor(tagName(name));
            // The atlas started over: lay the name out again in the new one.
            if (!text && generation !== startGeneration)
                text = textFor(tagName(name));
            if (!text) {
                skipped++;
                return;
            }
            const photo = photoUrl
                ? photoFor(photoUrl, performance.now())
                : null;
            shown.push({
                text,
                photo,
                x,
                y,
                z,
                opacity,
                pinned,
                depth: 0,
            });
        },
        /**
         * Writes the frame's tags. `viewportHeight` (CSS pixels) keeps them
         * at a readable size on screen; leave it 0 in VR.
         */
        end(camera: THREE.Camera, viewportHeight = 0) {
            const view = camera.matrixWorldInverse.elements;
            const projection = camera.projectionMatrix.elements;
            const pixelsPerUnit =
                (viewportHeight / 2) *
                ((camera as THREE.PerspectiveCamera).isPerspectiveCamera
                    ? projection[5]
                    : 0);
            for (const tag of shown)
                tag.depth = -(
                    view[2] * tag.x +
                    view[6] * tag.y +
                    view[10] * tag.z +
                    view[14]
                );
            // Back to front, so soft edges blend over farther tags.
            shown.sort((a, b) => b.depth - a.depth);
            let n = 0;
            for (const tag of shown) {
                if (tag.depth <= 0) continue;
                const em = emMetres(tag.depth, pixelsPerUnit);
                const photo = tag.photo
                    ? {
                          u:
                              ((tag.photo.index % PHOTO_COLUMNS) * PHOTO_PX) /
                              PHOTO_ATLAS,
                          v:
                              (Math.floor(tag.photo.index / PHOTO_COLUMNS) *
                                  PHOTO_PX) /
                              PHOTO_ATLAS,
                          du: PHOTO_PX / PHOTO_ATLAS,
                          dv: PHOTO_PX / PHOTO_ATLAS,
                      }
                    : null;
                const opacity = tag.pinned ? 2 : Math.min(1, tag.opacity);
                for (const piece of layoutTag(tag.text, capHeight, photo)) {
                    if (n >= maxInstances) break;
                    anchors.setXYZW(n, tag.x, tag.y, tag.z, em);
                    quads.setXYZW(n, piece.x, piece.y, piece.w, piece.h);
                    rects.setXYZW(n, piece.r0, piece.r1, piece.r2, piece.r3);
                    styles.setXY(n, piece.kind, opacity);
                    n++;
                }
            }
            geometry.instanceCount = n;
            if (n) {
                anchors.needsUpdate = true;
                quads.needsUpdate = true;
                rects.needsUpdate = true;
                styles.needsUpdate = true;
            }
            const now = performance.now();
            if (dirty && now - lastUpload >= UPLOAD_MS) {
                dirty = false;
                lastUpload = now;
                glyphTexture.needsUpdate = true;
                photoTexture.needsUpdate = true;
            }
            return skipped;
        },
        dispose() {
            disposed = true;
            fonts?.removeEventListener?.("loadingdone", onFonts);
            mesh.removeFromParent();
            geometry.dispose();
            base.dispose();
            material.dispose();
            occlusionMaterial.dispose();
            glyphTexture.dispose();
            photoTexture.dispose();
            photos.clear();
            glyphs.clear();
            texts.clear();
        },
    };
}

export type NameTags = ReturnType<typeof createNameTags>;
