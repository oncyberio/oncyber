/**
 * The "gallery" frame style: a moulding with real depth, an optional mat
 * (passe-partout) and an optional wall label, laid out from the artwork's own
 * size so portrait, square, landscape and very wide images all frame alike.
 *
 * Stored on the artwork as `data.frame`. The moulding colour stays in
 * `data.borderColor`, so a client that doesn't know `frame` still draws its
 * flat border in that colour, recolouring works the same for both styles,
 * and a space without `frame` renders exactly as before.
 *
 * Everything here is plain math so the engine and Studio share it.
 */

export interface ArtworkFrame {
    style: "gallery";
    /** Moulding width, % of the artwork's reference side. */
    width?: number;
    /** How far the moulding stands off the mat, as a multiple of its width. */
    depth?: number;
    /** Draw a mat between the moulding and the art. */
    mat?: boolean;
    /** Mat width, % of the artwork's reference side. */
    matWidth?: number;
    /** Mat colour, "#rrggbb". */
    matColor?: string;
    /** Show a wall label with the title and artist, when the art has a title. */
    label?: boolean;
    /**
     * Optional gallery credit typed by the artist, mostly for uploaded art
     * that has no on-chain metadata. Any field left empty falls back to the
     * artwork's own data (title) or is left off the label.
     */
    credit?: GalleryCredit | null;
}

export interface GalleryCredit {
    /** Artist name, the label's headline. */
    artist?: string;
    /** Where the artist is based, e.g. "New York". */
    location?: string;
    /** Artwork title; the artwork's own title when empty. */
    title?: string;
    /** X handle, without the "@". */
    x?: string;
    /** Website, without "https://". */
    website?: string;
}

export const GALLERY_CREDIT_FIELDS = [
    "artist",
    "location",
    "title",
    "x",
    "website",
] as const;

/** Longest value kept per credit field. */
export const GALLERY_CREDIT_MAX: Record<keyof GalleryCredit, number> = {
    artist: 48,
    location: 48,
    title: 80,
    x: 15,
    website: 60,
};

export type GalleryFrame = Required<Omit<ArtworkFrame, "credit">> & {
    credit: GalleryCredit | null;
};

export const GALLERY_FRAME_DEFAULTS: GalleryFrame = {
    style: "gallery",
    width: 5,
    depth: 1,
    mat: true,
    matWidth: 12,
    matColor: "#ece8e1",
    label: false,
    credit: null,
};

export const GALLERY_FRAME_LIMITS = {
    width: [1.5, 15],
    depth: [0.3, 3],
    matWidth: [0, 30],
} as const;

/** Moulding colours offered in Studio; the first is the default. */
export const GALLERY_FRAME_COLORS = ["#141414", "#5d4e43", "#cba781", "#f2f0eb"];

/** The moulding colour: the artwork's frame colour, or near-black. */
export function galleryMouldingColor(borderColor: unknown) {
    return hex(borderColor, GALLERY_FRAME_COLORS[0]);
}

/** Mat colours offered in Studio; the first is the default. */
export const GALLERY_MAT_COLORS = ["#ece8e1", "#d9d4cc", "#fbfaf7", "#1c1c1c"];

const HEX = /^#[0-9a-f]{6}$/i;

function clamp(value: number, [min, max]: readonly [number, number]) {
    return Math.min(max, Math.max(min, value));
}

function num(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : fallback;
}

function hex(value: unknown, fallback: string) {
    return typeof value === "string" && HEX.test(value)
        ? value.toLowerCase()
        : fallback;
}

/**
 * The gallery settings with defaults filled in and values clamped, or null
 * when the artwork uses the flat border (no `frame`, or a style this
 * version doesn't know).
 */
export function normalizeFrame(frame: unknown): GalleryFrame | null {
    if (frame == null || typeof frame !== "object") return null;

    const it = frame as ArtworkFrame;

    if (it.style !== "gallery") return null;

    const d = GALLERY_FRAME_DEFAULTS;
    const limits = GALLERY_FRAME_LIMITS;

    return {
        style: "gallery",
        width: clamp(num(it.width, d.width), limits.width),
        depth: clamp(num(it.depth, d.depth), limits.depth),
        mat: typeof it.mat === "boolean" ? it.mat : d.mat,
        matWidth: clamp(num(it.matWidth, d.matWidth), limits.matWidth),
        matColor: hex(it.matColor, d.matColor),
        label: it.label === true,
        credit: normalizeCredit(it.credit),
    };
}

/** "@jarlan", "x.com/jarlan", "https://twitter.com/jarlan/" → "jarlan". */
function cleanHandle(value: string) {
    return value
        .replace(/^https?:\/\//i, "")
        .replace(/^(www\.)?(x|twitter)\.com\//i, "")
        .replace(/^@+/, "")
        .replace(/[/?#].*$/, "")
        .replace(/[^A-Za-z0-9_]/g, "");
}

/** "https://www.jarlan.com/" → "jarlan.com"; keeps a path. */
function cleanWebsite(value: string) {
    return value
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .replace(/\/+$/, "")
        .replace(/\s+/g, "");
}

/**
 * The credit fields trimmed, tidied and cut to length, or null when every
 * field is empty (so an untouched form stores nothing).
 */
export function normalizeCredit(credit: unknown): GalleryCredit | null {
    if (credit == null || typeof credit !== "object") return null;
    const it = credit as Record<string, unknown>;
    const out: GalleryCredit = {};
    for (const key of GALLERY_CREDIT_FIELDS) {
        const raw = it[key];
        if (typeof raw !== "string") continue;
        let value = raw.replace(/\s+/g, " ").trim();
        if (key === "x") value = cleanHandle(value);
        if (key === "website") value = cleanWebsite(value);
        value = value.slice(0, GALLERY_CREDIT_MAX[key]).trim();
        if (value) out[key] = value;
    }
    return Object.keys(out).length ? out : null;
}

/**
 * The length frame and mat widths are a share of: the shorter side, but at
 * least a quarter of the longer one. Very wide panoramas would otherwise get
 * a hairline frame, and very tall strips a hairline at the sides.
 */
export function referenceSide(width: number, height: number) {
    const short = Math.min(width, height);
    const long = Math.max(width, height);
    return Math.max(short, long * 0.25);
}

export type FramePart = "backing" | "mat" | "frame" | "label";

/** An axis-aligned box in the artwork's frame, centre and size. */
export interface FrameBox {
    part: FramePart;
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
}

export interface GalleryFrameLayout {
    boxes: FrameBox[];
    /** The label's front face, for its text; null when there is no label. */
    label: { x: number; y: number; z: number; w: number; h: number } | null;
    /** Outer size of the moulding. */
    outer: { w: number; h: number };
}

export interface GalleryFrameLayoutOptions {
    /** Art size, before the artwork's scale. */
    width: number;
    height: number;
    /** The room's artwork depth: the art plane sits at +depth / 2. */
    depth: number;
    /** The artwork's scale; z only moves the wall and the art plane. */
    scale?: { x: number; y: number; z: number };
    frame: GalleryFrame;
    /** Draw the label (the caller checks the art has a title). */
    withLabel?: boolean;
    /** A gallery-credit label: larger, and taller for its extra lines. */
    creditLabel?: boolean;
}

/** Four boxes around a `w` × `h` opening, `t` wide, from z0 to z1. */
function ring(
    w: number,
    h: number,
    t: number,
    z0: number,
    z1: number,
    part: FramePart
): FrameBox[] {
    const z = (z0 + z1) / 2;
    const d = z1 - z0;
    const outerW = w + 2 * t;
    return [
        { part, x: 0, y: (h + t) / 2, z, w: outerW, h: t, d },
        { part, x: 0, y: -(h + t) / 2, z, w: outerW, h: t, d },
        { part, x: -(w + t) / 2, y: 0, z, w: t, h, d },
        { part, x: (w + t) / 2, y: 0, z, w: t, h, d },
    ];
}

/**
 * The frame's boxes, centred on the artwork and in its axes, in world units
 * (the artwork's scale is applied, its rotation and position are not).
 *
 * From the wall out: a backing behind the art, the art, the mat a little in
 * front of it (so the art sits in the mat's window), then a stepped
 * moulding whose outer ring stands proudest.
 */
export function galleryFrameLayout({
    width,
    height,
    depth,
    scale = { x: 1, y: 1, z: 1 },
    frame,
    withLabel = false,
    creditLabel = false,
}: GalleryFrameLayoutOptions): GalleryFrameLayout {
    const W = width * scale.x;
    const H = height * scale.y;
    const ref = referenceSide(W, H);

    const frameWidth = (ref * frame.width) / 100;
    const matWidth = frame.mat ? (ref * frame.matWidth) / 100 : 0;

    const zBack = (-depth / 2) * scale.z;
    const zArt = (depth / 2) * scale.z;
    // The art sits just behind the mat's face, like a print under a mat.
    const zMat = zArt + (matWidth > 0 ? ref * 0.006 : 0);
    const lip = frameWidth * 0.45 * frame.depth;
    const zStep = zMat + lip * 0.55;
    const zFront = zMat + lip;

    const boxes: FrameBox[] = [];

    // Behind the art: shows through transparent images instead of the wall.
    const gap = ref * 0.001;
    boxes.push({
        part: "backing",
        x: 0,
        y: 0,
        z: (zBack + zArt - gap) / 2,
        w: W,
        h: H,
        d: zArt - gap - zBack,
    });

    if (matWidth > 0) boxes.push(...ring(W, H, matWidth, zBack, zMat, "mat"));

    const openW = W + 2 * matWidth;
    const openH = H + 2 * matWidth;
    const inner = frameWidth * 0.4;
    const outerRing = frameWidth - inner;

    boxes.push(...ring(openW, openH, inner, zBack, zStep, "frame"));
    boxes.push(
        ...ring(
            openW + 2 * inner,
            openH + 2 * inner,
            outerRing,
            zBack,
            zFront,
            "frame"
        )
    );

    const outer = { w: openW + 2 * frameWidth, h: openH + 2 * frameWidth };

    let label: GalleryFrameLayout["label"] = null;

    if (withLabel) {
        const w = ref * (creditLabel ? 0.36 : 0.3);
        const h = w * (creditLabel ? GALLERY_CREDIT_ASPECT : 0.45);
        const thick = h * 0.08;
        const x = outer.w / 2 + ref * 0.08 + w / 2;
        const y = -outer.h / 2 + h / 2;
        boxes.push({
            part: "label",
            x,
            y,
            z: zBack + thick / 2,
            w,
            h,
            d: thick,
        });
        label = { x, y, z: zBack + thick, w, h };
    }

    return { boxes, label, outer };
}

/** Height / width of a gallery-credit label (the reference plates are 278 × 159). */
export const GALLERY_CREDIT_ASPECT = 0.58;

const FILE_NAME = /\.[a-z0-9]{2,5}$/i;
const ACCOUNT_ID = /^(0x[0-9a-f]{6,}|tz[123][A-Za-z0-9]{20,}|[A-Za-z0-9]{24,})$/i;
const PLACEHOLDER =
    /^(untitled|null|undefined|no description provided\.?|nulladdress)$/i;

function text(value: unknown, max: number) {
    if (typeof value !== "string") return "";
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean || PLACEHOLDER.test(clean)) return "";
    return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

/** "SANCTUM_low2.jpg" → "SANCTUM low2". */
function fileTitle(name: string) {
    return name
        .replace(FILE_NAME, "")
        .replace(/[_\-.+]+/g, " ")
        .replace(/\(\d+\)/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export interface GalleryLabelText {
    title: string;
    artist: string;
    /** Set when the label shows a gallery credit (artist headline). */
    credit?: {
        artist: string;
        location: string;
        title: string;
        x: string;
        website: string;
    };
}

/**
 * The label's words. With a gallery credit, the artist's own fields (the
 * title falls back to the artwork's). Otherwise the artwork's own data: its
 * name (a file name is tidied) and the creator's username when there is
 * one. Null when there is nothing to show, so no label is drawn.
 */
export function galleryLabelText(
    data: any,
    credit?: GalleryCredit | null
): GalleryLabelText | null {
    const raw = text(data?.name, 80);
    const own = FILE_NAME.test(raw) ? fileTitle(raw) : raw;

    const c = normalizeCredit(credit);
    if (c && (c.artist || c.title || own)) {
        const title = c.title || own;
        return {
            title,
            artist: c.artist || "",
            credit: {
                artist: c.artist || "",
                location: c.location || "",
                title,
                x: c.x || "",
                website: c.website || "",
            },
        };
    }

    const title = own;
    if (!title) return null;

    const person = text(
        data?.creator?.user?.username || data?.creator?.username,
        48
    );
    const artist = person && !ACCOUNT_ID.test(person) ? person : "";

    return { title, artist };
}
