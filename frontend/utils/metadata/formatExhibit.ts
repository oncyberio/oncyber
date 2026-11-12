// Three-free modules: this file is reached from _app, so importing
// `@3constants` or `spaceutils` here put three.js on every page.
import { AUDIO_TYPES } from "@components/_3DExhibit-v2/three/shellconstants";
import { coordsToId as _coordsToId } from "@components/_3DExhibit-v2/three/utils/spacecoords";
import { ArtworkData, Experience, PortalData, XYZ } from "@uitypes/experience";
import { deepClone, findByValue } from "@utils/js";
import { getSlug } from "@utils/saveToDb";

import scaleData from "./scaleData.json";
import { getDefaultEnvMapIntensity } from "@components/_3DExhibit-v2/utils/envmaps";
import { isSupportedRuntime } from "@utils/runtimeKind";

export interface ScaleData {
    scale: number;
    oldUserHeight: number;
    // jump: number;
    // playerSpeed: number;
    // gravity: number;
    placeholders?: Record<string, string>;
}

const USER_HEIGHT = 2.3;

const naRoomScale: ScaleData = {
    scale: 1,
    oldUserHeight: USER_HEIGHT,
    placeholders: {},
};

export function coordsToId(object, uid, exhibit) {
    const id = _coordsToId(object, uid);

    const roomScale = getRoomScale(exhibit);

    if (roomScale == null) return id;

    return toOldId(id, roomScale);
}

function getIdComponents(id: string) {
    let [coords, uid] = id.split("@");

    let coordsArr = coords.split("X");

    const position = coordsArr.slice(0, 3).join("X");
    const rotation = coordsArr.slice(3, 6).join("X");

    return { position, rotation, uid };
}

function getOriginalCoords(id: string, roomScale: ScaleData) {
    //
    let [coords, uid] = id.split("@");

    let [x, y, z, _x, _y, _z] = coords.split("X").map((n) => +n);

    let posId = [x, y, z].join("X");

    let newPosId = roomScale.placeholders?.[posId];

    let newRotation = { _x, _y, _z };

    if (newPosId != null) {
        [x, y, z] = newPosId.split("X").map((n) => +n);
    } else {
        ({ x, y, z } = toNewXYZ({ x, y, z }, roomScale));
    }

    return {
        position: { x, y, z },
        rotation: newRotation,
    };
}

export function toNewId(id: string, roomScale: ScaleData): string {
    //
    let { position, rotation, uid } = getIdComponents(id);

    let newPos = roomScale.placeholders?.[position];

    if (!newPos) return id;

    let newId = newPos + "X" + rotation;

    if (uid) {
        newId += `@${uid}`;
    }

    return newId;
}

export function toOldId(id: string, roomScale: ScaleData): string {
    //
    let { position, rotation, uid } = getIdComponents(id);

    let oldPos = findByValue(position, roomScale.placeholders);

    if (oldPos == null) return id;

    let oldId = oldPos + "X" + rotation;

    if (uid) {
        oldId += `@${uid}`;
    }

    return oldId;
}

export function toNewXYZ(position: XYZ, roomScale: ScaleData): XYZ {
    return {
        x: position.x * roomScale.scale,
        y: position.y * roomScale.scale,
        z: position.z * roomScale.scale,
    };
}

export function toOldXYZ(position: XYZ, roomScale: ScaleData): XYZ {
    return {
        x: position.x / roomScale.scale,
        y: position.y / roomScale.scale,
        z: position.z / roomScale.scale,
    };
}

export function toNewVolume(volume: number, roomScale: ScaleData) {
    const userHeightScale =
        roomScale.scale / (USER_HEIGHT / roomScale.oldUserHeight);

    return volume * userHeightScale;
}

export function toOldVolume(volume: number, roomScale: ScaleData) {
    const userHeightScale =
        roomScale.scale / (USER_HEIGHT / roomScale.oldUserHeight);

    return volume / userHeightScale;
}

export function portalToNewScale(item: PortalData, roomScale: ScaleData) {
    //
    if (!item.id || item.spawn == null) return item;

    item.spawn.position = toNewXYZ(item.spawn.position, roomScale);

    const { position, rotation } = getOriginalCoords(item.id, roomScale);
    item.spawn.originalPosition = position;
    item.spawn.originalRotation = rotation;

    return item;
}

export function portalToOldScale(item: PortalData, roomScale: ScaleData) {
    //
    if (!item.id || item.spawn == null) return item;

    item.spawn.position = toOldXYZ(item.spawn.position, roomScale);

    delete item.spawn.originalPosition;
    delete item.spawn.originalRotation;

    return item;
}

export function artworkToNewScale(item: ArtworkData, roomScale: ScaleData) {
    //
    item.position = toNewXYZ(item.position, roomScale);

    const { position, rotation } = getOriginalCoords(item.data.id, roomScale);
    item.originalPosition = position;
    item.originalRotation = rotation;

    if (item.volume) {
        item.volume = toNewVolume(item.volume, roomScale);
    }

    if (
        item.data.mime_type === "model/gltf-binary" ||
        item.data.mime_type === "model/gltf+json"
    ) {
        if (item.scale?.x) {
            item.scale = toNewXYZ(item.scale, roomScale);
        }
    }

    return item;
}

export function artworkToOldScale(item: ArtworkData, roomScale: ScaleData) {
    //
    item.position = toOldXYZ(item.position, roomScale);

    if (
        item.data.mime_type === "model/gltf-binary" ||
        item.data.mime_type === "model/gltf+json"
    ) {
        if (item.scale?.x) {
            item.scale = toOldXYZ(item.scale, roomScale);
        }
    }

    delete item.originalPosition;
    delete item.originalRotation;

    return item;
}

function getRoomScale(exhibit: Experience) {
    return scaleData[getSlug(exhibit.info.room)] || naRoomScale;
}

export function adjustExhibitScale(exhibit: Experience) {
    //
    if (exhibit.version === 1) return exhibit;

    const roomScale = getRoomScale(exhibit);

    exhibit.version = 1;

    Object.values(exhibit.portals || {}).forEach((item) => {
        portalToNewScale(item, roomScale);
    });

    Object.values(exhibit.artworks || {}).forEach((item) => {
        artworkToNewScale(item, roomScale);
    });

    return exhibit;
}

function upgradeExhibit(exhibit: Experience): Experience {
    //
    Object.values(exhibit.artworks || {}).forEach((item) => {
        // Upgrade volume
        if (item.audioType == null) {
            item.audioType = item.isBackgroundAudio
                ? AUDIO_TYPES.SPATIAL
                : AUDIO_TYPES.LOOKAT;
        }

        if (item.envmapIntensity == null) {
            item.envmapIntensity = getDefaultEnvMapIntensity(item);
        }
    });

    Object.keys(exhibit.games || {}).forEach((key) => {
        //
        const game = exhibit.games[key];

        Object.keys(game.scripts || {}).forEach((key) => {
            //
            let script = game.scripts[key];

            if (typeof script === "string") {
                //
                script = {
                    id: key,
                    code: script,
                    type: "artwork",
                };

                game.scripts[key] = script;
            }
        });
    });

    return exhibit;
}

export function formatExhibit(exhibit: Experience) {
    // Runtimes this build does not serve have no native destination or room
    // scale. Keep the document envelope for discovery/SEO and skip native
    // upgrades that assume geometry, placeholders and a room slug exist.
    if (!isSupportedRuntime(exhibit.runtime)) {
        exhibit.artworks = exhibit.artworks || {};
        exhibit.portals = exhibit.portals || {};
        return exhibit;
    }
    exhibit.info.room = getSlug(exhibit.info.room);
    exhibit = adjustExhibitScale(exhibit);
    exhibit = upgradeExhibit(exhibit);
    exhibit.portals = exhibit.portals || {};
    // `kitbash` is optional on Experience and absent on older spaces, but every
    // kitbash command writes into it directly (AddKitbashCommand /
    // RemoveKitbashCommand / DuplicateKitbashCommand) and the singleton
    // validators read it. Default it here, like portals above, so those 11 call
    // sites don't each need a guard.
    exhibit.kitbash = exhibit.kitbash || {};
    return exhibit;
}

export function formatUpdate(payload, roomScale: ScaleData) {
    //
    payload = deepClone(payload);

    if (payload.FIRESTORE_ADD_ASSET || payload.FIRESTORE_REPLACE_ASSET) {
        //
        payload.asset = artworkToOldScale(payload.asset, roomScale);
        //
    } else if (payload.FIRESTORE_UPDATE_ASSET) {
        //
        const update = payload.update;

        if (update.position) {
            update.position = toOldXYZ(update.position, roomScale);
        }

        if (update.scale) {
            update.scale = toOldXYZ(update.scale, roomScale);
        }

        if (update.volume) {
            update.volume = toOldVolume(update.volume, roomScale);
        }
        //
    } else if (payload.FIRESTORE_DELETE_ASSET) {
        //
        //
    } else if (payload.FIRESTORE_UPDATE_PORTAL) {
        //
        const update = payload.update;

        if (!update.id || !update.spawn) return;

        if (update.spawn.position) {
            update.spawn.position = toOldXYZ(update.spawn.position, roomScale);
        }
        //
    } else if (payload.FIRESTORE_DELETE_PORTAL) {
        //
    }

    return payload;
}

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    const w = window as any;
    w.scaleData = scaleData;

    w.checkRescale = function checkRescale(scaleData) {
        const placeholders = Object.keys(scaleData.placeholders);

        let result = { maxDiff: 0 };

        placeholders.forEach((p) => {
            const olds = p.split("X").map((n) => +n);
            const news = scaleData.placeholders[p].split("X").map((n) => +n);
            const rs = olds.map((n) => n * scaleData.scale);
            const diffs = rs.map((r, i) => r - news[i]);

            result.maxDiff = Math.max(result.maxDiff, ...diffs);

            result[p] = diffs.map((d) => d.toFixed()).join(" X ");
        });

        return result;
    };

    w.computeScale = function computeScale(scaleData) {
        const placeholders = Object.keys(scaleData.placeholders);

        let result = {
            computedScale: 0,
            scale: scaleData.scale,
            placeholders: {},
        };

        let cum = [];

        placeholders.forEach((p) => {
            const olds = p.split("X").map((n) => +n);
            const news = scaleData.placeholders[p].split("X").map((n) => +n);

            const scales = olds
                .map((r, i) => news[i] / r)
                .map((r) => {
                    if (!isNaN(r) && isFinite(r)) {
                        cum.push(r);
                    }
                    return r;
                })
                .map((d) => d.toFixed(4))
                .join(" X ");

            result.placeholders[p] = scales;
        });
        result.computedScale = cum.reduce((acc, n) => acc + n, 0) / cum.length;
        return result;
    };

    w.checkAllRescales = () => {
        let rs = { diffs: {}, stats: {} };

        Object.keys(scaleData).forEach((room) => {
            let r = w.checkRescale(scaleData[room]);

            rs.diffs[room] = r.maxDiff;
            rs.stats[room] = r;
        });

        return rs;
    };
}
