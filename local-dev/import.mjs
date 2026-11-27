// Puts a copy of a real space into the running local stack.
//
// `pnpm world import <link or id>` (scripts/world-import.mjs) reads a space
// from a site the terminal is signed in to, and hands it here. The copy is
// made for debugging: it opens at the same link on localhost, the local
// demo account owns it, and nothing done to it reaches the real space.
//
//   localCopy(exported)   what will be written, and what was left off. Pure.
//   writeLocalCopy(copy)  writes it to the Firestore emulator, and only there.
import { connect } from "node:net";

/** The demo account of local-dev/seed.mjs: it owns every copy. */
export const LOCAL_OWNER = "demo-user-1";
export const LOCAL_SITE = "http://localhost:13000";
export const FIRESTORE_EMULATOR = "127.0.0.1:8085";

const filled = (value) =>
    !!value && typeof value === "object" && Object.keys(value).length > 0;

/**
 * @param {{ id: string, space: object, destination: { id: string, doc: object } | null }} exported
 *        what the site's `exhibit.exportSpace` returned
 * @param {{ owner?: string, now?: number }} [options]
 */
export function localCopy(
    exported,
    { owner = LOCAL_OWNER, now = Date.now() } = {}
) {
    if (!exported?.id || !exported.space || typeof exported.space !== "object")
        throw new Error("the site returned no space to copy");
    const { gating, kitbash, portals, ...rest } = exported.space;
    const leftOff = [];
    const doc = {
        ...rest,
        owner,
        editors: [],
        // A new version, so no cached view of an earlier copy is served.
        lastUpdatedAt: now,
        lastContentUpdatedAt: now,
    };

    // A gate checks a password or a wallet the local stack cannot check:
    // the copy would lock its own developer out.
    if (filled(gating))
        leftOff.push(
            `its gate (${Object.keys(gating).join(
                ", "
            )}): the copy opens for anyone`
        );
    if (exported.space.owner && exported.space.owner !== owner)
        leftOff.push(
            "its owner and editors: the local demo account owns the copy"
        );

    // Where the real space keeps them: large spaces hold kitbash and
    // portals in sub-collections, and the app reads them from there.
    const split = { kitbash: {}, portals: {} };
    if (doc.hasKitbash) split.kitbash = kitbash ?? {};
    else if (filled(kitbash)) doc.kitbash = kitbash;
    if (doc.storageVersion === 2) {
        split.portals = portals ?? {};
        doc.portals = {};
    } else doc.portals = portals ?? {};

    const runtime =
        doc.runtime?.kind && doc.runtime.kind !== "cyber" ? doc.runtime : null;
    return {
        id: exported.id,
        owner,
        doc,
        kitbash: split.kitbash,
        portals: split.portals,
        destination: exported.destination ?? null,
        leftOff,
        about: {
            name: doc.info?.headline || exported.id,
            link: doc.info?.customLink || "",
            room: doc.info?.room || "",
            artworks: Object.keys(doc.artworks ?? {}).length,
            kitbash: Object.keys(kitbash ?? {}).length,
            portals: Object.keys(portals ?? {}).length,
            scripts: (doc.worldScripts ?? []).length,
            runtime: runtime
                ? { kind: runtime.kind, url: runtime.url ?? "" }
                : null,
        },
    };
}

/** What the copy is and where it opens, as lines. */
export function describeCopy(
    copy,
    { site = LOCAL_SITE, linkTaken = false } = {}
) {
    const { about } = copy;
    const path =
        about.link && !linkTaken ? `/${about.link}` : `/spaces/${copy.id}`;
    const lines = [
        `Copied "${about.name}" into the local stack.`,
        `  open    ${site}${path}`,
        `  edit    sign in as demo@example.com (it owns the copy), then ${site}/studio`,
        `  holds   ${about.artworks} artworks, ${about.kitbash} placed objects, ${about.portals} portals` +
            (about.scripts
                ? `, ${about.scripts} world script${
                      about.scripts === 1 ? "" : "s"
                  }`
                : ""),
    ];
    if (copy.destination)
        lines.push(`  world   ${about.room} (copied with it)`);
    else if (about.room)
        lines.push(`  world   ${about.room} (the app's own, or already here)`);
    if (about.runtime)
        lines.push(
            `  runs    outside content (${about.runtime.kind}) from ${
                about.runtime.url || "its own address"
            }, framed by the page`
        );
    if (about.scripts)
        lines.push(
            "  scripts show where NEXT_PUBLIC_WORLD_SCRIPTS=1 is set for the local site"
        );
    if (linkTaken)
        lines.push(
            `  its link /${about.link} is another local space's, so the copy has none`
        );
    for (const item of copy.leftOff) lines.push(`  left off: ${item}`);
    lines.push(
        "Models and images load from where the real space keeps them. Nothing done here reaches the real space."
    );
    return lines;
}

/** True when something answers at `host:port`. */
export function reachable(address, timeoutMs = 1500) {
    const [host, port] = address.split(":");
    return new Promise((done) => {
        const socket = connect({ host, port: Number(port) });
        const finish = (up) => {
            socket.destroy();
            done(up);
        };
        socket.setTimeout(timeoutMs, () => finish(false));
        socket.once("connect", () => finish(true));
        socket.once("error", () => finish(false));
    });
}

/**
 * Writes the copy to the Firestore emulator. Refuses anything else: the
 * project is `demo-oncyber`, which Firebase keeps offline, and the seed's
 * own `app()` throws without an emulator address.
 *
 * @returns {Promise<{ linkTaken: boolean }>}
 */
export async function writeLocalCopy(copy) {
    process.env.FIRESTORE_EMULATOR_HOST ||= FIRESTORE_EMULATOR;
    if (!(await reachable(process.env.FIRESTORE_EMULATOR_HOST)))
        throw new Error(
            `the local stack is not running (nothing at ${process.env.FIRESTORE_EMULATOR_HOST}). Start it with \`pnpm dev:local\`, then run this again.`
        );
    const { app, revive, firestoreTypes } = await import("./seed.mjs");
    const db = app().firestore();
    const { Timestamp } = firestoreTypes();

    const spaces = db.collection("exhibits");
    const ref = spaces.doc(copy.id);
    const doc = revive(copy.doc);
    // The view carries the date as text; the app reads a timestamp.
    const created = new Date(copy.doc.createdAt);
    doc.createdAt = Timestamp.fromDate(
        Number.isNaN(created.getTime()) ? new Date() : created
    );

    // One link, one space: another local space keeps a link it already has.
    let linkTaken = false;
    const link = doc.info?.customLink;
    if (link) {
        const holders = await spaces
            .where("info.customLink", "==", link)
            .limit(2)
            .get();
        linkTaken = holders.docs.some((other) => other.id !== copy.id);
        if (linkTaken) doc.info = { ...doc.info, customLink: "" };
    }

    // An earlier copy's objects must not survive beside this one's.
    for (const name of ["kitbash", "portals"]) {
        const old = await ref.collection(name).listDocuments();
        for (let i = 0; i < old.length; i += 400) {
            const batch = db.batch();
            for (const one of old.slice(i, i + 400)) batch.delete(one);
            await batch.commit();
        }
    }
    await ref.set(doc);
    const writes = [
        ...Object.entries(copy.kitbash).map(([id, item]) => [
            ref.collection("kitbash").doc(id),
            item,
        ]),
        ...Object.entries(copy.portals).map(([id, item]) => [
            ref.collection("portals").doc(id),
            item,
        ]),
    ];
    for (let i = 0; i < writes.length; i += 400) {
        const batch = db.batch();
        for (const [target, item] of writes.slice(i, i + 400)) {
            const { id: _id, ...data } = item ?? {};
            batch.set(target, revive(data));
        }
        await batch.commit();
    }
    await db
        .collection("users")
        .doc(copy.owner)
        .collection("exhibits")
        .doc(copy.id)
        .set({ id: copy.id, invited: false });

    if (copy.destination) {
        // Templates are found by slug: write over the one that has it.
        const worlds = db.collection("new-destinations");
        const slug = copy.destination.doc.slug;
        const held = slug
            ? await worlds.where("slug", "==", slug).limit(1).get()
            : null;
        const id = held && !held.empty ? held.docs[0].id : copy.destination.id;
        await worlds.doc(id).set(revive(copy.destination.doc));
    }
    return { linkTaken };
}
