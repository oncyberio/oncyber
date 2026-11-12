import { User } from "@uitypes/user";
import {
    isLobbyDestinationPreparing,
    waitForLobbyDestinationEntry,
} from "./lobbyDestinationBridge";
import { Experience } from "@uitypes/experience";
import { RoomParameters } from "@uitypes/roomParameters";
import {
    getDestination,
    getDestination as _getDestination,
    getExhibit,
    getExhibitByCustomLink as _getExhibitByCustomLink,
    getExhibitPreviews,
    getUserByWalletId,
    getUserProfiles,
} from "./saveToDb";
import { formatExhibit } from "./metadata/formatExhibit";

export async function getExhibitById(id: string): Promise<Experience> {
    //

    const result = await getExhibit(id);

    // Using direct firebase calls seems to incur some
    // perf. overheads when we load a lot of portal data at once

    return result.exhibit || null;
}

export async function getExhibitByCustomLink(
    link: string
): Promise<Experience> {
    //

    const result = await _getExhibitByCustomLink(link);

    return result.exhibit || null;
}

export async function getUser(walletId: string): Promise<User> {
    const response = await getUserByWalletId(walletId);

    if (response.success) {
        // @ts-ignore
        return response?.user || response;
    }

    return null;
}

let exhibitsCache: Record<string, Promise<Experience>> = {};

let destinationsCache: Record<string, Promise<RoomParameters>> = {};

let usersCache: Record<string, Promise<User>> = {};

function checkPortalRequest(signal?: AbortSignal) {
    if (!signal?.aborted) return;
    const error = new Error("Portal metadata load was cancelled");
    error.name = "AbortError";
    throw error;
}

export async function getPortalDestination(room: string, signal?: AbortSignal) {
    //
    if (!room) return null;
    checkPortalRequest(signal);

    let promise = destinationsCache[room];
    if (promise == null) {
        await waitForLobbyDestinationEntry(signal);
        checkPortalRequest(signal);
        promise = destinationsCache[room] ||= getDestination(room);
    }

    return promise;
}

export async function getPortalExhibit(id: string, signal?: AbortSignal) {
    //
    if (!id) return null;
    checkPortalRequest(signal);

    let promise = exhibitsCache[id];
    if (promise == null) {
        await waitForLobbyDestinationEntry(signal);
        checkPortalRequest(signal);
        promise = exhibitsCache[id] ||= getExhibitById(id);
    }

    return promise;
}

// Portal owners are only drawn on the portal's info card (name, avatar). A
// world can have thousands of portals, each with a different owner, so
// lookups made in the same turn share one batched profile read instead of one
// request per owner. A failed batch falls back to one read per owner.
/** Most wallets per batched profile request. */
export const PORTAL_OWNER_BATCH_SIZE = 50;

let pendingOwners: Record<string, (user: Promise<User>) => void> = null;

const ownerOrPlaceholder = (user: User) => user || ({ walletId: user } as any);

function flushOwnerBatch() {
    const pending = pendingOwners;
    pendingOwners = null;
    const owners = Object.keys(pending);
    for (let i = 0; i < owners.length; i += PORTAL_OWNER_BATCH_SIZE) {
        const chunk = owners.slice(i, i + PORTAL_OWNER_BATCH_SIZE);
        const batch = getUserProfiles(chunk);
        chunk.forEach((owner) =>
            pending[owner](
                batch.then(
                    (byWallet) =>
                        ownerOrPlaceholder(byWallet[owner.toLowerCase()]),
                    () => getUser(owner).then(ownerOrPlaceholder)
                )
            )
        );
    }
}

function requestOwner(owner: string): Promise<User> {
    return new Promise((resolve) => {
        if (pendingOwners == null) {
            pendingOwners = {};
            setTimeout(flushOwnerBatch, 0);
        }
        pendingOwners[owner] = resolve;
    });
}

/** A portal owner's public profile: enough for the portal's info card. */
export async function getPortalOwner(owner: string, signal?: AbortSignal) {
    if (!owner) return null;
    checkPortalRequest(signal);

    const key = owner.toLowerCase();

    let promise = usersCache[key];

    if (promise == null) {
        await waitForLobbyDestinationEntry(signal);
        checkPortalRequest(signal);
        promise = usersCache[key] ||= requestOwner(owner);
    }

    return promise;
}

let accountsCache: Record<string, Promise<User>> = {};

/**
 * The owner's full account, including linked wallets. Only gated portals need
 * it, when someone opens one, so it is read then and once per owner.
 */
export function getPortalOwnerAccount(owner: string): Promise<User> {
    if (!owner) return Promise.resolve(null);
    const key = owner.toLowerCase();
    return (accountsCache[key] ||= getUser(owner).catch(() => {
        delete accountsCache[key];
        return null;
    }));
}

// Portal previews only need an exhibit's doc fields (owner, info, gating).
// Requests made in the same turn of the event loop share one batched read;
// a failed batch falls back to the full read for each exhibit.
let previewsCache: Record<string, Promise<Experience>> = {};

/** Most exhibit ids per batched preview request (keeps the URL short). */
export const PORTAL_PREVIEW_BATCH_SIZE = 50;

let pendingPreviews: Record<string, (exhibit: Promise<Experience>) => void> =
    null;

function flushPreviewBatch() {
    const pending = pendingPreviews;
    pendingPreviews = null;
    const ids = Object.keys(pending);
    for (let i = 0; i < ids.length; i += PORTAL_PREVIEW_BATCH_SIZE) {
        const chunk = ids.slice(i, i + PORTAL_PREVIEW_BATCH_SIZE);
        const batch = getExhibitPreviews(chunk).then((list) => {
            const byId: Record<string, Experience> = {};
            list.forEach((it) => (byId[it.id] = it));
            return byId;
        });
        chunk.forEach((id) =>
            pending[id](
                batch.then(
                    (byId) => byId[id] || null,
                    () => getPortalExhibit(id)
                )
            )
        );
    }
}

function requestPreview(id: string): Promise<Experience> {
    return new Promise((resolve) => {
        if (pendingPreviews == null) {
            pendingPreviews = {};
            setTimeout(flushPreviewBatch, 0);
        }
        pendingPreviews[id] = resolve;
    });
}

/**
 * The doc-level fields of a portal's exhibit, enough to draw its preview and
 * ask for its password. Opening the portal needs the full exhibit
 * (`getPortalExhibit`): artworks, portals and kitbash are not included here.
 */
export async function getPortalPreviewExhibit(
    id: string,
    signal?: AbortSignal
) {
    //
    if (!id) return null;
    checkPortalRequest(signal);

    // A full exhibit already loaded carries every preview field.
    let promise = exhibitsCache[id] || previewsCache[id];
    if (promise == null) {
        await waitForLobbyDestinationEntry(signal);
        checkPortalRequest(signal);
        promise =
            exhibitsCache[id] || (previewsCache[id] ||= requestPreview(id));
    }

    return promise;
}

let preloadInitiated = false;

/**
 * Warms the portal previews of a world: one batched read for every portal's
 * exhibit, then each distinct destination and owner once. Call it once the
 * world is showing, so none of it competes with the room download.
 */
export async function preloadExhibitPortalData(
    exhibit: Experience,
    signal: AbortSignal
) {
    // A prepared native document is still downloading its renderer and room.
    // Do not let speculative portal metadata compete with that critical path.
    // Renderer cache misses wait for revealed entry as well.
    if (signal.aborted || isLobbyDestinationPreparing() || preloadInitiated)
        return;

    preloadInitiated = true;

    exhibitsCache[exhibit.id] = Promise.resolve(exhibit);

    const noop = () => {};

    // Back portals and same-owner worlds show this owner's card.
    getPortalOwner(exhibit.owner, signal).catch(noop);

    const ids = Array.from(
        new Set(
            Object.values(exhibit.portals || {})
                .map((portal) => portal?.exhibitId)
                .filter((id) => id && id !== exhibit.id)
        )
    );

    ids.forEach((id) => {
        getPortalPreviewExhibit(id, signal)
            .then((preview) => {
                if (signal.aborted || preview == null) return;

                getPortalDestination(preview.info?.room).catch(noop);

                getPortalOwner(preview.owner).catch(noop);
            })
            .catch(noop);
    });
}
