/**
 * The options the classic room kit picks its model with. Scene3D starts the
 * room download early with the same options, so both choose the same file.
 *
 * @param {{ preferLowResolution?: boolean, gpuTier?: string, isMobile?: boolean,
 *   compressedSupport?: boolean, skin?: any, editing?: boolean }} [options]
 */
export function classicRoomModelOptions({
    preferLowResolution = false,
    gpuTier,
    isMobile = false,
    compressedSupport = false,
    skin,
    editing = false,
} = {}) {
    return {
        preferLowResolution: !!preferLowResolution,
        quality: gpuTier,
        isMobile: !!isMobile,
        compressedSupport: !!compressedSupport,
        skin,
        // A direct visit on a desktop whose GPU is not low starts with the mid
        // file and sharpens to high once the frame rate allows (see
        // roomTextureUpgradeController). Phones, lobby entry, low GPUs and
        // the editor keep their own order.
        midFirst:
            !editing &&
            !isMobile &&
            !preferLowResolution &&
            !!gpuTier &&
            gpuTier !== "low",
    };
}

/** Room variants share authored geometry; their primary difference is texture size. */
export function selectRoomModelSource(room = {}, options = {}) {
    const {
        preferLowResolution = false,
        quality = "high",
        isMobile = false,
        compressedSupport = false,
        skin,
        midFirst = false,
        hour = new Date().getHours(),
    } = options;
    const low = preferLowResolution || quality === "low";
    const compressed = compressedSupport && (preferLowResolution || isMobile);
    const tiers = [
        ...(compressed ? ["low_compressed"] : []),
        ...(low
            ? ["low", "mid", "high"]
            : midFirst
            ? ["mid", "high", "low"]
            : ["high", "mid", "low"]),
    ];
    // Starting below high means the room may sharpen after arrival.
    const refine = !low && !compressed && midFirst;
    const night = room.type === "cycle" && !(hour > 6 && hour < 20);
    const select = (paths, source) => {
        if (!paths) return null;
        // Preserve an authored night variant even when only its high tier exists.
        const keys = night
            ? [...tiers.map((tier) => `night_${tier}`), ...tiers]
            : tiers;
        for (const key of keys) {
            if (typeof paths[key] === "string" && paths[key].trim()) {
                const quality = key.replace(/^night_/, "");
                return {
                    url: paths[key],
                    quality,
                    source,
                    cycle: key.startsWith("night_") ? "night" : "day",
                    ...(refine && quality !== "high" ? { refine: true } : {}),
                };
            }
        }
        return null;
    };
    const selectedSkin = room.skins?.[skin];
    const skinModel = select(selectedSkin?.paths, "skin");
    if (skinModel) return { ...skinModel, background: selectedSkin.background };
    const roomPaths = {
        ...room.paths,
        high: room.paths?.high || room.path,
        low: room.paths?.low || room.path_low,
        mid: room.paths?.mid || room.path_mid,
    };
    const model = select(roomPaths, "room");
    if (model) return model;
    return {
        url: room.uPath?.fileURL,
        quality: "original",
        source: "upload",
        cycle: "day",
    };
}

/**
 * Every other file this room could load, in the order to try them when the
 * selected one cannot be read (a gateway that answers with an empty file, for
 * instance): the same tiers selectRoomModelSource walks, minus its choice.
 */
export function roomModelFallbacks(room = {}, options = {}, selected) {
    const fallbacks = [];
    const seen = new Set([selected?.url]);
    let remaining = room;
    // Each pass drops the chosen file, so the next pass returns the next one.
    for (let i = 0; i < 12; i++) {
        const next = selectRoomModelSource(remaining, options);
        if (!next?.url || next.source === "upload") break;
        if (!seen.has(next.url)) {
            seen.add(next.url);
            fallbacks.push({ ...next, refine: undefined });
        }
        remaining = withoutRoomModelUrl(remaining, next.url);
    }
    return fallbacks;
}

function withoutRoomModelUrl(room, url) {
    const strip = (paths) =>
        paths &&
        Object.fromEntries(
            Object.entries(paths).filter(([, value]) => value !== url)
        );
    const skins = room.skins
        ? Object.fromEntries(
              Object.entries(room.skins).map(([name, skin]) => [
                  name,
                  { ...skin, paths: strip(skin?.paths) },
              ])
          )
        : room.skins;
    return {
        ...room,
        skins,
        paths: strip({
            ...room.paths,
            high: room.paths?.high || room.path,
            low: room.paths?.low || room.path_low,
            mid: room.paths?.mid || room.path_mid,
        }),
        path: undefined,
        path_low: undefined,
        path_mid: undefined,
        uPath: undefined,
    };
}

/** Bounded development evidence: never expose signed queries or complete URLs. */
export function publishRoomModelSource(source) {
    if (
        process.env.NODE_ENV !== "development" ||
        typeof document === "undefined"
    )
        return;
    try {
        const target = document.documentElement;
        target.setAttribute("data-native-model-quality", source.quality);
        target.setAttribute("data-native-model-source", source.source);
        target.setAttribute("data-native-model-cycle", source.cycle);
        const url = new URL(source.url, document.baseURI);
        const file =
            url.searchParams.get("filename") ||
            url.pathname.split("/").pop() ||
            "model";
        target.setAttribute("data-native-model-file", file.slice(0, 96));
    } catch {
        // Diagnostic data never participates in scene readiness.
    }
}

/** Stay within the exact authored skin and day/night export chosen for arrival. */
/**
 * What a room file is, apart from how it is labelled: the IPFS content id
 * when the URL has one, otherwise the URL without its `filename` label.
 * Uploaded rooms often list the same file under every tier
 * (`/ipfs/<cid>?filename=…-low.glb`, `…-mid.glb`, `…-high.glb`).
 */
export function roomFileIdentity(url) {
    if (typeof url !== "string") return "";
    const ipfs = url.match(/\/ipfs\/([A-Za-z0-9]{32,})/);
    if (ipfs) return `ipfs:${ipfs[1]}`;
    try {
        const parsed = new URL(url.trim(), "https://local.invalid");
        parsed.searchParams.delete("filename");
        parsed.hash = "";
        return parsed.toString().replace(/^https?:/, "");
    } catch {
        return url.trim();
    }
}

/** True when two room URLs point at the same file. */
export function isSameRoomFile(a, b) {
    return !!a && !!b && roomFileIdentity(a) === roomFileIdentity(b);
}

export function selectRoomTextureUpgradeSource(
    room = {},
    initial,
    options = {}
) {
    if (!initial || initial.source === "upload") return null;
    const paths =
        initial.source === "skin"
            ? room.skins?.[options.skin]?.paths
            : {
                  ...room.paths,
                  high: room.paths?.high || room.path,
                  mid: room.paths?.mid || room.path_mid,
              };
    if (!paths) return null;
    const targetTiers =
        options.isMobile || options.quality === "low"
            ? ["mid"]
            : ["high", "mid"];
    const rank = { low_compressed: 0, low: 0, mid: 1, high: 2 };
    for (const quality of targetTiers) {
        if (!(rank[quality] > rank[initial.quality])) continue;
        const key = initial.cycle === "night" ? `night_${quality}` : quality;
        const url = paths[key];
        // A tier that is the same file as the one loaded has nothing to add:
        // downloading it again would only repeat the whole room.
        if (
            typeof url === "string" &&
            url.trim() &&
            !isSameRoomFile(url, initial.url)
        ) {
            return {
                url,
                quality,
                source: initial.source,
                cycle: initial.cycle,
            };
        }
    }
    return null;
}
