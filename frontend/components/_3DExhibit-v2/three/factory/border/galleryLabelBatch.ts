import * as THREE from "three/webgpu";
import {
    attribute,
    Discard,
    float as tslFloat,
    Fn,
    fwidth,
    If,
    max,
    select,
    smoothstep,
    texture,
    vec3,
    vec4,
} from "three/tsl";
import { coverageToSdf } from "@features/name-tags/sdf";
import { needsShaping } from "@features/name-tags/layout";
import {
    LABEL_CORNER,
    LABEL_DEPTH,
    type GalleryLabelText,
} from "./galleryFrame";
import {
    fitPlacardRect,
    layoutGalleryLabel,
    type LabelIcon,
    type LabelLayout,
    type LabelLine,
} from "./galleryLabelLayout";

const ATLAS_SIZE = 1024;
const GLYPH_PX = 48;
const PAD = 7;
const POSITION = new THREE.Vector3();
const INK = new THREE.Color();
const QUAD = [
    [0, 0],
    [0, 1],
    [1, 1],
    [0, 0],
    [1, 1],
    [1, 0],
] as const;

type Rect = { x: number; y: number; z: number; w: number; h: number };
type Artwork = THREE.Object3D;
type Glyph = {
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
    left: number;
    top: number;
};
type LocalQuad = {
    glyph: Glyph | null;
    x: number;
    y: number;
    w: number;
    h: number;
    color: number[];
};
type Prepared = { layout: LabelLayout; quads: LocalQuad[] };
type Label = {
    rect: Rect;
    text: GalleryLabelText;
    key: string;
    prepared?: Prepared;
    rounded: boolean;
    visible: boolean;
};
type MeshFactory = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material
) => THREE.Mesh;
type Vertex = { p: number[]; uv: number[]; color: number[]; aspect: number };
type Page = {
    data: Uint8Array;
    texture: THREE.DataTexture;
    x: number;
    y: number;
    row: number;
    dirty: boolean;
    vertices: Vertex[];
    mesh?: THREE.Mesh;
    capacity: number;
};

let creditFonts: Promise<boolean> | undefined;
function creditsReady() {
    if (typeof FontFace === "undefined" || !document.fonts)
        return Promise.resolve(false);
    return (creditFonts ??= Promise.all(
        [
            ["400", "Regular"],
            ["700", "Bold"],
        ].map(([weight, file]) =>
            new FontFace(
                "Open Sans",
                `url(/fonts/OpenSans/OpenSans-${file}.woff2) format("woff2")`,
                { weight }
            ).load()
        )
    )
        .then((faces) => {
            faces.forEach((face) => document.fonts.add(face));
            return true;
        })
        .catch(() => false));
}

function makeMaterial(atlas: THREE.DataTexture) {
    const material = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        depthTest: true,
        depthWrite: true,
        fog: false,
        toneMapped: false,
    });
    const st = attribute("labelUV", "vec2");
    const aspect = attribute("labelAspect", "float");
    const ink = attribute("labelInk", "vec3");
    const field = texture(atlas, st).r;
    material.colorNode = Fn(() => {
        const width = max(fwidth(field).mul(0.75), 1 / 255);
        const glyph = smoothstep(
            tslFloat(0.5).sub(width),
            tslFloat(0.5).add(width),
            field
        );
        // The mounted board is geometry. Only lettering needs the atlas.
        const alpha = select(aspect.greaterThan(0), tslFloat(1), glyph);
        If(alpha.lessThan(0.004), () => {
            Discard();
        });
        return vec4(ink, alpha);
    })();
    return material;
}

/** World-aligned signs. One shared R8 atlas and draw per page, never a texture
 * or mesh per sign. A second page is only allocated if the first fills. */
export class GalleryLabelBatch {
    private labels = new Map<Artwork, Label>();
    private pages: Page[] = [];
    private glyphs = new Map<string, Glyph | null>();
    private canvas = document.createElement("canvas");
    private ctx: CanvasRenderingContext2D;
    private dirty = false;
    private disposed = false;
    private watchingFont = false;

    constructor(
        private parent: THREE.Object3D,
        private createMesh: MeshFactory = (g, m) => new THREE.Mesh(g, m)
    ) {
        this.canvas.width = 1008;
        this.canvas.height = 160;
        const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Gallery label glyphs unavailable");
        this.ctx = ctx;
    }

    set(art: Artwork, rect: Rect, text: GalleryLabelText, rounded: boolean) {
        const key = JSON.stringify(text);
        const previous = this.labels.get(art);
        this.labels.set(art, {
            rect,
            text,
            key,
            rounded,
            visible: art.visible,
            prepared:
                previous?.key === key && previous.rounded === rounded
                    ? previous.prepared
                    : undefined,
        });
        this.dirty = true;
        if (text.credit && !this.watchingFont) {
            this.watchingFont = true;
            void creditsReady().then((ok) => {
                if (!ok || this.disposed) return;
                // Font fallback and final Open Sans must never share glyph UVs.
                this.clearPages();
                for (const label of this.labels.values())
                    label.prepared = undefined;
                this.dirty = true;
            });
        }
    }

    remove(art: Artwork) {
        if (this.labels.delete(art)) this.dirty = true;
    }

    private addPage(): Page {
        const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE);
        const image = new THREE.DataTexture(
            data,
            ATLAS_SIZE,
            ATLAS_SIZE,
            THREE.RedFormat,
            THREE.UnsignedByteType
        );
        image.minFilter = image.magFilter = THREE.LinearFilter;
        image.generateMipmaps = false;
        image.flipY = false;
        const page = {
            data,
            texture: image,
            x: 0,
            y: 0,
            row: 0,
            vertices: [],
            capacity: 0,
            dirty: true,
        };
        this.pages.push(page);
        return page;
    }

    private reserve(w: number, h: number) {
        let page = this.pages.at(-1) ?? this.addPage();
        if (page.x + w > ATLAS_SIZE) {
            page.x = 0;
            page.y += page.row;
            page.row = 0;
        }
        if (page.y + h > ATLAS_SIZE) page = this.addPage();
        const x = page.x,
            y = page.y;
        page.x += w + 1;
        page.row = Math.max(page.row, h + 1);
        return { page, x, y, index: this.pages.length - 1 };
    }

    private raster(
        key: string,
        w: number,
        h: number,
        left: number,
        top: number,
        draw: () => void
    ) {
        this.ctx.clearRect(0, 0, w, h);
        draw();
        const rgba = this.ctx.getImageData(0, 0, w, h).data;
        const alpha = new Uint8Array(w * h);
        for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
        const field = coverageToSdf(alpha, w, h, PAD);
        const s = this.reserve(w, h);
        for (let row = 0; row < h; row++)
            s.page.data.set(
                field.subarray(row * w, row * w + w),
                (s.y + row) * ATLAS_SIZE + s.x
            );
        s.page.dirty = true;
        const glyph = { page: s.index, x: s.x, y: s.y, w, h, left, top };
        this.glyphs.set(key, glyph);
        return glyph;
    }

    private glyph(text: string, font: string, baseline: LabelLine["baseline"]) {
        const key = JSON.stringify([font, baseline, text]);
        if (this.glyphs.has(key)) return this.glyphs.get(key);
        const ctx = this.ctx;
        ctx.font = font;
        ctx.textBaseline = baseline;
        ctx.textAlign = "left";
        const m = ctx.measureText(text);
        const left = Math.ceil(m.actualBoundingBoxLeft);
        const as = Math.ceil(m.actualBoundingBoxAscent);
        const inkW = Math.ceil(m.actualBoundingBoxRight) + left;
        const inkH = Math.ceil(m.actualBoundingBoxDescent) + as;
        if (inkW <= 0 || inkH <= 0 || !Number.isFinite(inkW + inkH)) {
            this.glyphs.set(key, null);
            return null;
        }
        const w = Math.min(inkW + PAD * 2, this.canvas.width);
        const h = Math.min(inkH + PAD * 2, this.canvas.height);
        return this.raster(key, w, h, -left - PAD, -as - PAD, () => {
            ctx.fillStyle = "#fff";
            ctx.fillText(text, left + PAD, as + PAD);
        });
    }

    private icon(icon: LabelIcon) {
        const key = "icon:" + icon;
        const cached = this.glyphs.get(key);
        if (cached) return cached;
        const px = 36;
        return this.raster(key, px + PAD * 2, px + PAD * 2, -PAD, -PAD, () =>
            paintIcon(this.ctx, icon, PAD, px)
        );
    }

    private quad(
        art: Artwork,
        rect: Rect,
        layout: LabelLayout,
        rounded: boolean,
        { glyph, x, y, w, h, color }: LocalQuad
    ) {
        if (!glyph) {
            this.board(art, rect, rounded, color);
            return;
        }
        const page = this.pages[glyph.page];
        for (const [u, v] of QUAD) {
            POSITION.set(
                rect.x + ((x + u * w) / layout.width - 0.5) * rect.w,
                rect.y + (0.5 - (y + v * h) / layout.height) * rect.h,
                rect.z + rect.h * 0.002
            )
                .applyQuaternion(art.quaternion)
                .add(art.position);
            const uv = [
                (glyph.x + u * glyph.w) / ATLAS_SIZE,
                (glyph.y + v * glyph.h) / ATLAS_SIZE,
            ];
            page.vertices.push({ p: POSITION.toArray(), uv, color, aspect: 0 });
        }
    }

    private board(art: Artwork, rect: Rect, rounded: boolean, face: number[]) {
        const page = this.pages[0] ?? this.addPage();
        const hw = rect.w / 2,
            hh = rect.h / 2;
        const radius = rounded ? rect.h * LABEL_CORNER : 0;
        const bevel = rect.h * 0.0025;
        const corners = [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
        ];
        const profile = (inset: number) =>
            corners.flatMap(([sx, sy], i) => {
                if (!rounded) return [[sx * (hw - inset), sy * (hh - inset)]];
                return Array.from({ length: 5 }, (_, j) => {
                    const angle = ((i + j / 4) * Math.PI) / 2;
                    return [
                        sx * (hw - radius) + Math.cos(angle) * (radius - inset),
                        sy * (hh - radius) + Math.sin(angle) * (radius - inset),
                    ];
                });
            });
        const front = profile(bevel);
        const side = profile(0);
        const vertex = (pt: number[], z: number, color: number[]) => {
            POSITION.set(rect.x + pt[0], rect.y + pt[1], rect.z + z)
                .applyQuaternion(art.quaternion)
                .add(art.position);
            page.vertices.push({
                p: POSITION.toArray(),
                uv: [0, 0],
                color,
                aspect: 1,
            });
        };
        const depth = rect.h * LABEL_DEPTH;
        const center = [0, 0];
        for (let i = 0; i < side.length; i++) {
            const j = (i + 1) % side.length;
            // Round and square variants share the same nearly invisible cut bevel.
            const [dx, dy] = [side[j][0] - side[i][0], side[j][1] - side[i][1]];
            const n = Math.hypot(dx, dy) || 1;
            const exposure = Math.max(0, (dy * -0.45 - dx * 0.9) / n);
            // Darken only the cut edge, especially where it meets the wall.
            // The face stays smooth and unchanged; no cast shadow is needed.
            const rim = face.map((c) => c * (0.74 + 0.19 * exposure));
            const edge = face.map((c) => c * (0.46 + 0.25 * exposure));
            const contact = face.map((c) => c * (0.3 + 0.32 * exposure));
            vertex(center, 0, face);
            vertex(front[i], 0, face);
            vertex(front[j], 0, face);
            vertex(front[i], 0, face);
            vertex(side[i], -bevel, rim);
            vertex(side[j], -bevel, rim);
            vertex(front[i], 0, face);
            vertex(side[j], -bevel, rim);
            vertex(front[j], 0, face);
            vertex(side[i], -bevel, edge);
            vertex(side[i], -depth, contact);
            vertex(side[j], -depth, contact);
            vertex(side[i], -bevel, edge);
            vertex(side[j], -depth, contact);
            vertex(side[j], -bevel, edge);
        }
    }

    private assembleLine(quads: LocalQuad[], line: LabelLine) {
        const ctx = this.ctx;
        const renderFont = line.font.replace(/\d+px/, GLYPH_PX + "px");
        const text = line.text.normalize("NFC");
        const factor = line.size / GLYPH_PX;
        const color = INK.set(line.color).toArray();
        const put = (glyph: Glyph | null | undefined, x: number) => {
            if (glyph)
                quads.push({
                    glyph,
                    x: line.x + x + glyph.left * factor,
                    y: line.y + glyph.top * factor,
                    w: glyph.w * factor,
                    h: glyph.h * factor,
                    color,
                });
        };
        if (needsShaping(text)) {
            put(this.glyph(text, renderFont, line.baseline), 0);
            return;
        }
        ctx.font = line.font;
        let prefix = "";
        // Canvas pair metrics retain kerning without putting each label into
        // the atlas. Connected / reordered scripts use one shaped line above.
        for (const char of text) {
            prefix += char;
            const offset =
                ctx.measureText(prefix).width - ctx.measureText(char).width;
            put(this.glyph(char, renderFont, line.baseline), offset);
            ctx.font = line.font;
        }
    }

    private updatePage(page: Page) {
        if (page.vertices.length === 0) {
            if (page.mesh) page.mesh.visible = false;
            return;
        }
        const n = page.vertices.length;
        if (!page.mesh) {
            page.mesh = this.createMesh(
                new THREE.BufferGeometry(),
                makeMaterial(page.texture)
            );
            page.mesh.name = "gallery-label-sdf";
            page.mesh.frustumCulled = false;
            this.parent.add(page.mesh);
        }
        if (n > page.capacity) {
            const next = new THREE.BufferGeometry();
            page.capacity = Math.max(n, page.capacity * 2, 128);
            next.setAttribute("position", buffer(page.capacity, 3));
            next.setAttribute("labelUV", buffer(page.capacity, 2));
            next.setAttribute("labelInk", buffer(page.capacity, 3));
            next.setAttribute("labelAspect", buffer(page.capacity, 1));
            page.mesh.geometry.dispose();
            page.mesh.geometry = next;
        }
        const geo = page.mesh.geometry;
        const p = geo.getAttribute("position"),
            uv = geo.getAttribute("labelUV"),
            color = geo.getAttribute("labelInk"),
            aspect = geo.getAttribute("labelAspect");
        page.vertices.forEach((v, i) => {
            p.setXYZ(i, v.p[0], v.p[1], v.p[2]);
            uv.setXY(i, v.uv[0], v.uv[1]);
            color.setXYZ(i, v.color[0], v.color[1], v.color[2]);
            aspect.setX(i, v.aspect);
        });
        p.needsUpdate =
            uv.needsUpdate =
            color.needsUpdate =
            aspect.needsUpdate =
                true;
        geo.setDrawRange(0, n);
        page.mesh.visible = true;
        if (page.dirty) {
            page.texture.needsUpdate = true;
            page.dirty = false;
        }
    }

    flush() {
        for (const [art, label] of this.labels) {
            if (art.visible !== label.visible) {
                label.visible = art.visible;
                this.dirty = true;
            }
        }
        if (!this.dirty) return;
        this.dirty = false;
        for (const page of this.pages) page.vertices.length = 0;
        for (const [art, label] of this.labels) {
            if (!label.visible) continue;
            const { layout, quads } = (label.prepared ??= this.prepare(label));
            const rect = fitPlacardRect(label.rect, layout);
            for (const quad of quads)
                this.quad(art, rect, layout, label.rounded, quad);
        }
        for (const page of this.pages) this.updatePage(page);
    }

    private prepare(label: Label): Prepared {
        const layout = layoutGalleryLabel(label.text, (font, value) => {
            this.ctx.font = font;
            return this.ctx.measureText(value).width;
        });
        const quads: LocalQuad[] = [];
        // The face, cut edge, and text share the atlas-page batch.
        quads.push({
            glyph: null,
            x: 0,
            y: 0,
            w: layout.width,
            h: layout.height,
            color: INK.set(layout.background).toArray(),
        });
        for (const line of layout.lines) this.assembleLine(quads, line);
        for (const icon of layout.icons) {
            const g = this.icon(icon.icon);
            const s = icon.size / 36;
            quads.push({
                glyph: g,
                x: icon.x + g.left * s,
                y: icon.y + g.top * s,
                w: g.w * s,
                h: g.h * s,
                color: INK.set("#111111").toArray(),
            });
        }
        return { layout, quads };
    }

    private clearPages() {
        for (const { mesh, texture } of this.pages) {
            if (mesh) {
                mesh.removeFromParent();
                (mesh as THREE.Mesh & { dispose?: () => void }).dispose?.();
                mesh.geometry.dispose();
                (mesh.material as THREE.Material).dispose();
            }
            texture.dispose();
        }
        this.pages = [];
        this.glyphs.clear();
    }

    dispose() {
        this.disposed = true;
        this.clearPages();
        this.labels.clear();
    }
}

function buffer(capacity: number, width: number) {
    return new THREE.BufferAttribute(
        new Float32Array(capacity * width),
        width
    ).setUsage(THREE.DynamicDrawUsage);
}

function paintIcon(
    ctx: CanvasRenderingContext2D,
    icon: LabelIcon,
    pad: number,
    size: number
) {
    ctx.save();
    ctx.translate(pad, pad);
    ctx.scale(size / 30, size / 30);
    if (icon === "x") {
        ctx.scale(30 / 24, 30 / 24);
        ctx.fillStyle = "#111";
        ctx.fill(
            new Path2D(
                "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
            )
        );
    } else if (icon === "instagram") {
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2.6;
        ctx.stroke(
            new Path2D(
                "M9 2.5h12a6.5 6.5 0 0 1 6.5 6.5v12a6.5 6.5 0 0 1-6.5 6.5H9A6.5 6.5 0 0 1 2.5 21V9A6.5 6.5 0 0 1 9 2.5z"
            )
        );
        ctx.beginPath();
        ctx.arc(15, 15, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(22, 8, 1.75, 0, Math.PI * 2);
        ctx.fill();
    } else {
        const r = 13.5,
            center = 15;
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(center, center, r, 0, Math.PI * 2);
        for (const [x, y] of [
            [1, 0],
            [0.88, -0.48],
            [0.88, 0.48],
        ]) {
            ctx.moveTo(center - r * x, center + r * y);
            ctx.lineTo(center + r * x, center + r * y);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(center, center, r * 0.45, r, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}
