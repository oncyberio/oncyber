/**
 * Starts a space's downloads from the landing page before the click: the
 * page's server data (handed to the router), its scripts, and the room file
 * the page will pick. Same warmup the lobby's Explore cards use, but for a
 * direct visit, which picks the room by the remembered GPU tier.
 */
import { warmDestination } from "@features/lobby/destinationWarmup";
import type { WarmEntry } from "@features/lobby/destinationWarmupSource";
import {
    gpuTierPath,
    readRememberedGpuTier,
} from "@components/_3DExhibit-v2/three/utils/gpuTierMemory";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/device";
import type { LandingCard } from "./types";

export { CARD_WARM_DWELL_MS } from "@features/lobby/destinationWarmupSource";

export function directEntry(): WarmEntry {
    const remembered = readRememberedGpuTier();
    return {
        kind: "direct",
        gpuTier: remembered ? gpuTierPath(remembered) : null,
        isMobile: !!IS_MOBILE,
    };
}

/** Whether the card opens a space (not a template, build or setup card). */
export function opensSpace(card: LandingCard | undefined) {
    return (
        !!card?.href && !card.buildStatus && !/^(template|build)-/.test(card.id)
    );
}

export function warmSpace(card: LandingCard | undefined) {
    if (!opensSpace(card)) return false;
    return warmDestination(card.href, directEntry());
}
