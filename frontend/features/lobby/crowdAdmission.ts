import type { LobbyParticipant } from "./sceneTypes";

export interface CrowdBudget {
    maxAvatars?: number;
    maxModels?: number;
    maxLabels?: number;
    maxNativeAvatars?: number;
    loadConcurrency?: number;
}

export function crowdBudget(value: CrowdBudget = {}) {
    const bounded = (
        value: number,
        fallback: number,
        min: number,
        max: number
    ) =>
        Number.isFinite(value)
            ? Math.max(min, Math.min(max, Math.floor(value)))
            : fallback;
    return {
        maxAvatars: bounded(value.maxAvatars, 256, 0, 10000),
        maxModels: bounded(value.maxModels, 16, 1, 64),
        maxLabels: bounded(value.maxLabels, 32, 0, 64),
        maxNativeAvatars: bounded(value.maxNativeAvatars, 16, 0, 64),
        loadConcurrency: bounded(value.loadConcurrency, 3, 1, 8),
    };
}

/** Run at the interest/LOD cadence, never once per avatar per render frame. */
export function admitCrowd(
    participants: readonly LobbyParticipant[],
    position: { x: number; z: number },
    previous: ReadonlySet<string>,
    budget: ReturnType<typeof crowdBudget>,
    defaultUrl: string,
    previousModels: ReadonlySet<string> = new Set()
) {
    const seen = new Set<string>();
    const nearest = participants
        .filter((person) => {
            if (
                !person.id ||
                seen.has(person.id) ||
                !Number.isFinite(person.x) ||
                !Number.isFinite(person.z)
            )
                return false;
            seen.add(person.id);
            return true;
        })
        .map((person) => ({
            person,
            // A small retention advantage prevents repeated loads at the cutoff.
            score:
                ((person.x - position.x) ** 2 + (person.z - position.z) ** 2) *
                (previous.has(person.id) ? 0.85 : 1),
        }))
        .sort(
            (a, b) =>
                a.score - b.score || a.person.id.localeCompare(b.person.id)
        )
        .slice(0, budget.maxAvatars);
    const models = new Set([defaultUrl]);
    const requestedModels = new Set(
        nearest.map(({ person }) => person.vrmUrl || defaultUrl)
    );
    for (const url of previousModels) {
        if (models.size >= budget.maxModels) break;
        if (requestedModels.has(url)) models.add(url);
    }
    return nearest.map(({ person }) => {
        const requested = person.vrmUrl || defaultUrl;
        if (models.size < budget.maxModels) models.add(requested);
        // Keep presence/name/portrait visible while bounding distinct VRM assets.
        return { person, url: models.has(requested) ? requested : defaultUrl };
    });
}
