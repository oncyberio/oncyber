// A game's listing: what the site shows before anyone plays. The `listing`
// block of games/<id>/game.json is checked here (the listing stage of
// `pnpm games:check`), and the catalog the site reads is generated from it
// (`pnpm games:catalog`, scripts/games/catalog.mjs). Rules for authors:
// docs/games/listing.md.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/** The devices a game can claim (games/runtime/src/devices.ts). */
export const DEVICES = ["desktop", "phone", "gamepad"];
/** The page caps a party at eight (frontend/features/games/gameParty.ts). */
export const MAX_PARTY = 8;
/** What games:check writes when a listing names no thumbnail of its own. */
export const GENERATED_THUMBNAIL = "thumbnail.jpg";
export const CATALOG_PATH = "frontend/features/games/catalog.generated.ts";
/**
 * The catalogued games' own short addresses, `{ "<slug>": "<game id>" }`,
 * beside the catalog: the site's reserved links read it
 * (frontend/utils/reservedLinks.js), so no space can take a game's slug.
 */
export const SLUGS_PATH = "frontend/features/games/catalog.slugs.json";
/** Where the site keeps the names no space or game may take (in the repository). */
const RESERVED_PATH = "frontend/utils/reservedLinks.js";

/**
 * A game's slug, the name in its short address /<slug>: 3 to 40 lowercase
 * letters and digits, in words joined by single dashes. The same rule as
 * `gameSlugProblem` in frontend/features/games/gameSlug.ts.
 */
export const GAME_SLUG = /^(?=.{3,40}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

const THUMBNAIL_TYPES = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const THUMBNAIL_MAX = 512 * 1024;
const DESCRIPTION = { min: 30, max: 200 };
const TAGLINE_MAX = 60;
const TAG = /^[a-z0-9][a-z0-9-]{1,23}$/;
const ROOM = /^[a-z0-9][a-z0-9-]{2,62}$/;

const record = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => (typeof value === "string" ? value.trim() : "");
const whole = (value, min, max) =>
    Number.isInteger(value) && value >= min && value <= max;

/**
 * The party sizes a game has a format for beyond its solo option, read from
 * the one `party` block (docs/games/party.md): `sizes: [min, max]` and
 * `formats: [{ id, sizes }]`, `solo` naming the solo format.
 */
export function partySizesOf(manifest) {
    const party = manifest?.party;
    if (!record(party) || !Array.isArray(party.formats)) return [];
    const [min, max] =
        Array.isArray(party.sizes) && party.sizes.length === 2
            ? party.sizes
            : [1, MAX_PARTY];
    const sizes = new Set();
    for (const format of party.formats)
        if (record(format) && format.id !== party.solo)
            for (const size of Array.isArray(format.sizes) ? format.sizes : [])
                if (whole(size, 2, MAX_PARTY) && size >= min && size <= max)
                    sizes.add(size);
    return [...sizes].sort((a, b) => a - b);
}

/**
 * Check a manifest's listing.
 *
 * `build` is the set of files in the published build (paths relative to
 * frontend/public/game-builds/<id>/), or null to skip the checks that need one.
 * Returns `{ findings: [{ code, message }], listing }`; `listing` is the
 * normalised listing, or null when there are findings.
 */
export function checkListing(manifest, { build = null, sizes = null } = {}) {
    const findings = [];
    const add = (code, message) => findings.push({ code, message });
    const listing = manifest?.listing;
    if (!record(listing)) {
        add(
            "LISTING_MISSING",
            "game.json has no listing; add description, players, devices and tags (docs/games/listing.md)"
        );
        return { findings, listing: null };
    }

    const description = text(listing.description);
    if (!description)
        add("LISTING_DESCRIPTION", "listing.description is missing");
    else if (
        description.length < DESCRIPTION.min ||
        description.length > DESCRIPTION.max
    )
        add(
            "LISTING_DESCRIPTION",
            `listing.description is ${description.length} characters; write ${DESCRIPTION.min} to ${DESCRIPTION.max}`
        );
    else if (/[<>]|https?:\/\//.test(description))
        add(
            "LISTING_DESCRIPTION",
            "listing.description is plain text: no markup or links"
        );

    const tagline = text(listing.tagline);
    if (!tagline || tagline.length > TAGLINE_MAX)
        add(
            "LISTING_TAGLINE",
            `listing.tagline is ${
                tagline ? "too long" : "missing"
            }; one phrase of at most ${TAGLINE_MAX} characters`
        );

    // Thumbnail: the game's own file, or the one the check takes.
    const declared = listing.thumbnail;
    let thumbnail = GENERATED_THUMBNAIL;
    if (declared !== undefined) {
        const path = text(declared).replace(/^public\//, "");
        if (
            !path ||
            path.startsWith("/") ||
            path.split("/").includes("..") ||
            !THUMBNAIL_TYPES.has(extname(path).toLowerCase())
        )
            add(
                "LISTING_THUMBNAIL",
                'listing.thumbnail must be a .jpg, .png or .webp inside the build, such as "preview.jpg"'
            );
        else if (path === GENERATED_THUMBNAIL)
            add(
                "LISTING_THUMBNAIL",
                `${GENERATED_THUMBNAIL} is the name games:check writes; name your own file differently or leave listing.thumbnail out`
            );
        else {
            thumbnail = path;
            if (build && !build.has(path))
                add(
                    "LISTING_THUMBNAIL",
                    `listing.thumbnail ${path} is not in the build`
                );
            else if (sizes?.get(path) > THUMBNAIL_MAX)
                add(
                    "LISTING_THUMBNAIL",
                    `listing.thumbnail ${path} is ${Math.round(
                        sizes.get(path) / 1024
                    )} KiB; keep it under ${THUMBNAIL_MAX / 1024} KiB`
                );
        }
    } else if (build && !build.has(GENERATED_THUMBNAIL))
        add(
            "LISTING_THUMBNAIL",
            "no thumbnail: the game never drew a frame to take one from, and listing.thumbnail names none"
        );

    // Player counts, and the party sizes they must agree with.
    const players = listing.players;
    const playersValid =
        record(players) &&
        whole(players.min, 1, 500) &&
        whole(players.max, 1, 500) &&
        players.min <= players.max;
    if (!playersValid)
        add(
            "LISTING_PLAYERS",
            "listing.players must be { min, max }: whole numbers from 1 to 500, min no larger than max"
        );
    // Party sizes are declared once, in `party` (sizes and formats).
    const partySizes = partySizesOf(manifest);
    const partyValid = listing.partySizes === undefined;
    if (!partyValid)
        add(
            "LISTING_PARTY_SIZES",
            "listing.partySizes is not a field: party sizes come from the manifest's party block (sizes and formats, docs/games/party.md)"
        );
    const page = record(manifest.page) ? manifest.page : {};
    for (const key of ["room", "socialRoom"])
        if (
            page[key] !== undefined &&
            page[key] !== null &&
            !ROOM.test(text(page[key]))
        )
            add(
                "LISTING_ROOM",
                `page.${key} must be a lowercase room label such as "oncyber-my-game-v1"`
            );
    if (page.room && page.socialRoom)
        add(
            "LISTING_ROOM",
            "page.socialRoom is for a game with no page.room: declare one or the other"
        );
    if (
        page.slug !== undefined &&
        (typeof page.slug !== "string" || !GAME_SLUG.test(page.slug))
    )
        add(
            "LISTING_SLUG",
            "page.slug is 3 to 40 lowercase letters and digits, in words joined by single dashes"
        );
    if (playersValid && partyValid) {
        const outside = partySizes.filter(
            (size) => size < players.min || size > players.max
        );
        if (outside.length)
            add(
                "LISTING_PLAYERS",
                `listing.players says ${players.min} to ${
                    players.max
                }, but the party block has a format for a party of ${outside.join(
                    ", "
                )}`
            );
        else if (players.max > 1 && !partySizes.length && !page.room)
            add(
                "LISTING_PLAYERS",
                `listing.players.max is ${players.max}, but the game has no shared room (page.room) and no party sizes, so nobody can meet in it`
            );
        else if (
            players.min > 1 &&
            !partySizes.includes(players.min) &&
            !page.room
        )
            add(
                "LISTING_PLAYERS",
                `listing.players.min is ${players.min}, but no party of ${players.min} is offered and there is no shared room to find players in`
            );
    }

    // Devices are declared once, at the top of game.json, where the device
    // check plays them (docs/games/devices.md).
    const devices = manifest.devices;
    if (listing.devices !== undefined)
        add(
            "LISTING_DEVICES",
            'listing.devices is not a field: the card shows the manifest\'s top-level "devices" (docs/games/devices.md)'
        );
    else if (
        !Array.isArray(devices) ||
        !devices.length ||
        devices.some((device) => !DEVICES.includes(device))
    )
        add(
            "LISTING_DEVICES",
            `game.json's "devices" lists where the game plays, from: ${DEVICES.join(
                ", "
            )}`
        );

    const tags = listing.tags;
    if (
        !Array.isArray(tags) ||
        tags.length < 1 ||
        tags.length > 6 ||
        tags.some((tag) => typeof tag !== "string" || !TAG.test(tag)) ||
        new Set(tags).size !== tags.length
    )
        add(
            "LISTING_TAGS",
            'listing.tags needs one to six lowercase tags such as "sports" or "co-op"'
        );

    if (findings.length) return { findings, listing: null };
    return {
        findings,
        listing: {
            tagline,
            description,
            thumbnail,
            players: { min: players.min, max: players.max },
            partySizes,
            devices: DEVICES.filter((device) => devices.includes(device)),
            tags: [...tags],
        },
    };
}

/** The catalog entry the site reads, from a manifest that passed. */
export function catalogEntry(id, manifest) {
    const { findings, listing } = checkListing(manifest);
    if (!listing)
        throw new Error(
            `games/${id}/game.json: ${findings
                .map((f) => f.message)
                .join("; ")}`
        );
    const page = record(manifest.page) ? manifest.page : {};
    const entry = {
        id,
        title: text(manifest.name) || id,
        tagline: listing.tagline,
        description: listing.description,
        thumbnail: `/game-builds/${id}/${listing.thumbnail}`,
        players: listing.players,
        partySizes: listing.partySizes,
        devices: listing.devices,
        tags: listing.tags,
        room: page.room ? text(page.room) : null,
        relay: page.relay === true,
        crowdLabel: text(page.crowdLabel),
    };
    if (page.socialRoom) entry.socialRoom = text(page.socialRoom);
    if (record(page.controls)) entry.controlsStyle = page.controls;
    // The game's short address, /<slug>, beside /games/<id>.
    if (page.slug !== undefined) {
        if (typeof page.slug !== "string" || !GAME_SLUG.test(page.slug))
            throw new Error(
                `games/${id}/game.json: page.slug is 3 to 40 lowercase letters and digits, in words joined by single dashes`
            );
        entry.slug = page.slug;
    }
    return entry;
}

/**
 * The names the site answers itself (its pages and redirects), which no
 * game's slug may be. Read from the repository; empty outside it, where
 * there is no catalog either.
 */
export function reservedSiteLinks(root) {
    const path = join(root, RESERVED_PATH);
    if (!existsSync(path)) return new Set();
    const { APP_PATHS, PAGE_REDIRECTS } = createRequire(import.meta.url)(path);
    return new Set([...APP_PATHS, ...Object.keys(PAGE_REDIRECTS)]);
}

/** Every game with a manifest, by id. */
export function readManifests(root) {
    const games = join(root, "games");
    const manifests = {};
    for (const id of readdirSync(games).sort()) {
        const path = join(games, id, "game.json");
        if (statSync(join(games, id)).isDirectory() && existsSync(path))
            manifests[id] = JSON.parse(readFileSync(path, "utf8"));
    }
    return manifests;
}

/**
 * The generated catalog's data and the hash that names it. A slug is one
 * name in the site's one space of names: `reserved` are the site's own
 * (`reservedSiteLinks`), and no two games share one.
 */
export function buildCatalog(manifests, { reserved = new Set() } = {}) {
    const games = {};
    const slugs = {};
    for (const id of Object.keys(manifests).sort()) {
        const entry = (games[id] = catalogEntry(id, manifests[id]));
        if (!entry.slug) continue;
        if (reserved.has(entry.slug))
            throw new Error(
                `games/${id}/game.json: page.slug "${entry.slug}" is one of the site's own addresses; choose another`
            );
        if (slugs[entry.slug])
            throw new Error(
                `games/${id}/game.json: page.slug "${entry.slug}" is already ${
                    slugs[entry.slug]
                }'s; choose another`
            );
        slugs[entry.slug] = id;
    }
    const hash = createHash("sha256")
        .update(JSON.stringify(games))
        .digest("hex")
        .slice(0, 16);
    return { games, hash, slugs };
}

/** The slugs file's text: `{ "<slug>": "<game id>" }`, sorted. */
export function renderSlugs({ slugs = {} }) {
    return (
        JSON.stringify(
            Object.fromEntries(
                Object.keys(slugs)
                    .sort()
                    .map((slug) => [slug, slugs[slug]])
            ),
            null,
            4
        ) + "\n"
    );
}

export function renderCatalog({ games, hash }) {
    return `// Generated by \`pnpm games:catalog\` from games/*/game.json. Don't edit:
// change the game's manifest and run it again (docs/games/listing.md).
// source: ${hash}
import type { GameEntry } from "./catalog";

export const GAMES: Record<string, GameEntry> = ${JSON.stringify(
        games,
        null,
        4
    )};
`;
}

/** Null when the committed catalog matches the manifests, else why not. */
export function catalogStale(root) {
    let hash, catalog;
    try {
        catalog = buildCatalog(readManifests(root), {
            reserved: reservedSiteLinks(root),
        });
        ({ hash } = catalog);
    } catch (error) {
        return `the catalog can't be generated: ${error.message}`;
    }
    // The slugs the site reserves must be the catalog's. No file reads as
    // no slugs.
    const slugsPath = join(root, SLUGS_PATH);
    let reserved = {};
    try {
        if (existsSync(slugsPath))
            reserved = JSON.parse(readFileSync(slugsPath, "utf8"));
    } catch {
        reserved = null;
    }
    if (
        JSON.stringify(reserved) !==
        JSON.stringify(JSON.parse(renderSlugs(catalog)))
    )
        return `${SLUGS_PATH} is out of date with the manifests; run pnpm games:catalog`;
    const path = join(root, CATALOG_PATH);
    const current = existsSync(path)
        ? /^\/\/ source: ([0-9a-f]{16})$/m.exec(readFileSync(path, "utf8"))?.[1]
        : null;
    return current === hash
        ? null
        : `${CATALOG_PATH} is out of date with the manifests; run pnpm games:catalog`;
}

/**
 * The listing stage of games:check. Takes the thumbnail from the running
 * game when the listing names none (and none was taken before, or `retake`),
 * then checks the listing against the build. `root` is the repository, or
 * null for a game outside it, which has no catalog to be stale.
 */
export async function listingStage({
    root,
    out,
    manifest,
    page,
    booted,
    retake = false,
}) {
    const generated = join(out, GENERATED_THUMBNAIL);
    const own =
        record(manifest?.listing) && manifest.listing.thumbnail !== undefined;
    let took = false;
    if (!own && booted && page && (retake || !existsSync(generated))) {
        await page.screenshot({ path: generated, type: "jpeg", quality: 82 });
        took = true;
    }
    const sizes = new Map();
    const walk = (dir, prefix = "") => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = `${prefix}${entry.name}`;
            if (entry.isDirectory()) walk(join(dir, entry.name), `${path}/`);
            else sizes.set(path, statSync(join(dir, entry.name)).size);
        }
    };
    walk(out);
    const { findings, listing } = checkListing(manifest, {
        build: new Set(sizes.keys()),
        sizes,
    });
    const stale = root ? catalogStale(root) : null;
    if (stale) findings.push({ code: "LISTING_CATALOG_STALE", message: stale });
    return {
        findings,
        summary: listing && {
            thumbnail: listing.thumbnail,
            thumbnailTaken: took,
            players: listing.players,
            partySizes: listing.partySizes,
            devices: listing.devices,
            tags: listing.tags,
        },
    };
}
