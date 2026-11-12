import type { Experience } from "@uitypes/experience";
import type { RoomParameters } from "@uitypes/roomParameters";

/**
 * A space as one self-contained JSON file: the space record, the room it is
 * built on, and a list of every file it points to. Nothing in it needs
 * Firebase or an account to read, so a static viewer, a fork or an archive
 * job can rebuild the space from the file alone.
 *
 * Bump SPACE_EXPORT_VERSION when a field changes meaning; readers should
 * refuse versions they do not know.
 */
export const SPACE_EXPORT_FORMAT = "oncyber.space";
export const SPACE_EXPORT_VERSION = 1;

export interface SpaceExportFile {
    url: string;
    /** IPFS content id when the URL is content-addressed. */
    cid?: string;
    /** Where in the record the URL was found, as a dotted path. */
    at: string[];
}

export interface SpaceExport {
    format: typeof SPACE_EXPORT_FORMAT;
    version: typeof SPACE_EXPORT_VERSION;
    exportedAt: string;
    source: { id: string; url: string };
    /**
     * "native" renders with the Oncyber engine from `space` and `room`.
     * "external" is a page at `space.runtime.url`, hosted outside Oncyber;
     * the file can describe it but cannot keep it alive.
     */
    kind: "native" | "external";
    space: Partial<Experience>;
    room: RoomParameters | null;
    files: {
        /** Content-addressed: anyone can pin these by `cid`. */
        pinned: SpaceExportFile[];
        /** Plain URLs on someone's server; these can disappear. */
        hosted: SpaceExportFile[];
    };
}

/**
 * Fields that are caches of other records, live state, or private, and so
 * do not belong in a portable copy of the space.
 */
const DROPPED_FIELDS = [
    "ownerData",
    "portalExhibits",
    "portalsDestinations",
    "portalsOwners",
    "pendingTransaction",
    "invited",
    "mock",
    "isAdminCurator",
    "isCurator",
] as const;

export interface BuildSpaceExportOptions {
    exhibit: Experience;
    room?: RoomParameters | null;
    exportedAt?: Date;
    origin?: string;
}

export function buildSpaceExport({
    exhibit,
    room = null,
    exportedAt = new Date(),
    origin = "https://oncyber.io",
}: BuildSpaceExportOptions): SpaceExport {
    const space = clonePlain(exhibit) as Partial<Experience>;

    for (const field of DROPPED_FIELDS) delete (space as any)[field];

    // A world password never leaves the server in a readable form, but
    // documents from before hashing still carry it, and the studio holds
    // the plain value right after setting one. Keep only the visitor
    // message.
    if (space.gating?.password) {
        const { message } = space.gating.password;
        space.gating.password = message ? { message } : {};
    }

    const roomCopy = room ? (clonePlain(room) as RoomParameters) : null;

    const found = new Map<string, SpaceExportFile>();
    collectUrls(space, ["space"], found);
    collectUrls(roomCopy, ["room"], found);

    const files = [...found.values()].sort((a, b) =>
        a.url < b.url ? -1 : a.url > b.url ? 1 : 0
    );

    const slug = exhibit.info?.customLink;
    const base = origin.replace(/\/+$/, "");

    return {
        format: SPACE_EXPORT_FORMAT,
        version: SPACE_EXPORT_VERSION,
        exportedAt: exportedAt.toISOString(),
        source: {
            id: exhibit.id,
            url: slug ? `${base}/${slug}` : `${base}/spaces/${exhibit.id}`,
        },
        kind: isExternal(exhibit) ? "external" : "native",
        space,
        room: roomCopy,
        files: {
            pinned: files.filter((it) => it.cid),
            hosted: files.filter((it) => !it.cid),
        },
    };
}

/**
 * Only the signed-in owner may export. The studio reports userRole "owner"
 * in its local and memory modes too, so the account must also match the
 * space's owner.
 */
export function canExportSpace({
    isAnonymous,
    userRole,
    userId,
    owner,
}: {
    isAnonymous: boolean;
    userRole: string | null | undefined;
    userId: string | null | undefined;
    owner: string | null | undefined;
}) {
    return (
        !isAnonymous &&
        userRole === "owner" &&
        !!userId &&
        !!owner &&
        owner.toLowerCase() === userId.toLowerCase()
    );
}

export function spaceExportFileName(exhibit: Experience, date = new Date()) {
    const name =
        (exhibit.info?.customLink || exhibit.info?.headline || exhibit.id)
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || exhibit.id;
    const day = date.toISOString().slice(0, 10);
    return `${name}-${day}.oncyber.json`;
}

function isExternal(exhibit: Experience) {
    const kind = (exhibit.runtime as { kind?: string })?.kind;
    return kind != null && kind !== "cyber";
}

/** JSON round trip: drops functions, undefined and class instances. */
function clonePlain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value ?? null));
}

const URL_PATTERN = /^(https?|ipfs|ar):\/\//i;

// CIDv0 (base58, "Qm...") and CIDv1 in base32 ("b...").
const CID = "(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})";
const IPFS_SCHEME = new RegExp(`^ipfs://(?:ipfs/)?${CID}`, "i");
const IPFS_PATH = new RegExp(`/ipfs/${CID}`);
const IPFS_SUBDOMAIN = new RegExp(`^https?://${CID}\\.ipfs\\.`);

export function ipfsCidOf(url: string): string | undefined {
    const match =
        url.match(IPFS_SCHEME) ||
        url.match(IPFS_PATH) ||
        url.match(IPFS_SUBDOMAIN);
    return match?.[1];
}

function collectUrls(
    value: unknown,
    path: string[],
    found: Map<string, SpaceExportFile>
) {
    if (value == null) return;

    if (typeof value === "string") {
        const url = value.trim();
        if (!URL_PATTERN.test(url)) return;
        const at = path.join(".");
        const entry = found.get(url);
        if (entry) {
            if (!entry.at.includes(at)) entry.at.push(at);
            return;
        }
        const cid = ipfsCidOf(url);
        found.set(url, cid ? { url, cid, at: [at] } : { url, at: [at] });
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, i) => collectUrls(item, [...path, `${i}`], found));
        return;
    }

    if (typeof value === "object") {
        for (const [key, item] of Object.entries(value)) {
            collectUrls(item, [...path, key], found);
        }
    }
}

/** Downloads the export in the browser. */
export function downloadSpaceExport(data: SpaceExport, fileName: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
}
