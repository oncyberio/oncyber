import { sampleTravelDeparture } from "./travelAnimationSequence";
import type {
    LobbyGroupFormation,
    LobbyParticipant,
    LobbyTravelPresentation,
} from "./sceneTypes";
import type { LobbyTravelPeer } from "./lobbyJourneyProtocol";
import { WORLD_TILE_REVEAL_MS } from "./worldTileMotion";
import {
    TRAVEL_ISOLATE_MS,
    TRAVEL_CHARGE_LEAD_MS,
    WORLD_DISSOLVE_MS,
} from "./worldTravelTiming";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => {
    const x = clamp(value);
    return x * x * (3 - 2 * x);
};

export const GROUP_GATHER_MS = 480;
export const LOBBY_RETURN_REVEAL_MS = 1100;
export const LOBBY_RETURN_TOTAL_MS = LOBBY_RETURN_REVEAL_MS;
/** Shrink at the old pose, teleport while invisible, then grow into a planted idle. */
export function sampleGroupGather(elapsed: number, reducedMotion = false) {
    if (reducedMotion) return { arrived: true, scale: 1 };
    const time = Math.max(0, elapsed);
    return time < 160
        ? { arrived: false, scale: 1 - ease(time / 160) }
        : {
              arrived: true,
              scale: ease((time - 200) / (GROUP_GATHER_MS - 200)),
          };
}

/** Use exact server poses. Missing roster entries retain only approved cached profiles. */
export function groupFormationParticipants(
    formation: LobbyGroupFormation
): LobbyParticipant[] {
    const seen = new Set<string>();
    return formation.members.slice(0, 8).flatMap((member) => {
        const pose = formation.poses[member.id];
        if (!pose || seen.has(member.id) || member.id === formation.selfId)
            return [];
        seen.add(member.id);
        return [
            {
                ...member,
                ...pose,
                floor: true,
                speed: 0,
                animation: -1,
                restConfirmed: true,
            },
        ];
    });
}

/** Relative cosmetic peers are carried across the same-origin destination bridge. */
export function groupTravelPeers(
    formation: LobbyGroupFormation
): LobbyTravelPeer[] {
    const self = formation.poses[formation.selfId];
    if (!self) return [];
    return groupFormationParticipants(formation).map((person) => ({
        id: person.id,
        name: person.name,
        avatar: person.avatar,
        vrmUrl: person.vrmUrl,
        scale: person.scale,
        offset: {
            x: person.x - self.x,
            y: person.y - self.y,
            z: person.z - self.z,
        },
        rotation: person.rotation,
    }));
}
/** Stable, bounded presentation values. No network pose or gameplay state is changed. */
export function sampleTravelPresentation(
    travel: LobbyTravelPresentation,
    now: number,
    phaseStartedAt: number
) {
    const elapsed = Math.max(0, now - travel.startedAt);
    const reduced = travel.reducedMotion;
    if (travel.phase === "return") {
        const returnProgress = reduced
            ? 1
            : clamp(elapsed / LOBBY_RETURN_REVEAL_MS);
        return {
            dissolve: 1 - returnProgress,
            returnProgress,
            returnHandoff: 1,
            returnComplete: reduced || elapsed >= LOBBY_RETURN_TOTAL_MS,
            cameraMix: 1,
            charge: 0,
            lift: 0,
            pulse: 0.55,
            opacity: 0,
            animation: "IDLE",
            pose: undefined,
        };
    }
    const charge = reduced
        ? 1
        : travel.phase === "isolate"
        ? 0
        : ease((elapsed - TRAVEL_ISOLATE_MS) / TRAVEL_CHARGE_LEAD_MS);
    const reveal =
        travel.phase === "reveal"
            ? ease((now - phaseStartedAt) / WORLD_TILE_REVEAL_MS)
            : 0;
    const dissolve =
        travel.phase === "isolate"
            ? 0
            : travel.phase === "reveal" || reduced
            ? 1
            : Number.isFinite(travel.dissolveProgress)
            ? clamp(travel.dissolveProgress)
            : Number.isFinite(travel.dissolveStartedAt)
            ? clamp((now - travel.dissolveStartedAt) / WORLD_DISSOLVE_MS)
            : 0;
    const pose = sampleTravelDeparture(elapsed, reduced);
    return {
        returnProgress: 0,
        returnHandoff: 0,
        returnComplete: false,
        dissolve,
        cameraMix: reduced ? 1 : ease(elapsed / TRAVEL_ISOLATE_MS),
        charge,
        lift: 0,
        pulse: reduced ? 0.55 : 0.55 + Math.sin(elapsed * 0.003) * 0.12,
        opacity: (1 - reveal) * (0.22 + charge * 0.38),
        animation: pose.name,
        pose,
    };
}

/** Only already-present approved IDs receive a local cinematic formation. */
export function travelParticipants(
    source: readonly LobbyParticipant[],
    travel: Pick<LobbyTravelPresentation, "partyIds">,
    anchor: { x: number; z: number },
    cameraYaw: number
): readonly LobbyParticipant[] {
    const allowed = [...new Set(travel.partyIds)].filter((id) =>
        source.some((person) => person.id === id)
    );
    const index = new Map(allowed.map((id, index) => [id, index]));
    return source.map((person) => {
        const place = index.get(person.id);
        if (place === undefined) return person;
        const column = place - (allowed.length - 1) / 2;
        const side = column * 1.15;
        const depth = -0.9 - Math.abs(column) * 0.18;
        return {
            ...person,
            x:
                anchor.x +
                Math.cos(cameraYaw) * side +
                Math.sin(cameraYaw) * depth,
            y: 0,
            z:
                anchor.z -
                Math.sin(cameraYaw) * side +
                Math.cos(cameraYaw) * depth,
            rotation: cameraYaw + Math.PI,
            speed: 0,
            floor: true,
            animation: -1,
            restConfirmed: true,
        };
    });
}
