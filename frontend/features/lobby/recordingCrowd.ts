import { EMOTES } from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants";
import { LOBBY_SPAWN_CENTER } from "./lobbySpawn";
import type { LobbyParticipant } from "./sceneTypes";

/**
 * A staged crowd for recording videos of the lobby. URL-only, never stored,
 * never sent to the lobby server: other visitors don't see these people.
 *
 *   ?crowd=40              how many people (up to 80)
 *   ?crowdTravel=8         how many of them travel with you (up to 16)
 *   ?crowdWallet=a.eth,0x… also dress people in avatars these wallets own
 *   ?crowdAvatars=id,id    catalogue avatars to use (defaults to the first ones)
 *   ?crowdNames=0          hide their name tags
 *   ?crowdSeed=7           another arrangement of the same crowd
 */
export interface RecordingCrowdOptions {
    count: number;
    travel: number;
    wallets: string[];
    avatarIds: string[];
    names: boolean;
    seed: number;
}

export const RECORDING_CROWD_MAX = 80;
export const RECORDING_CROWD_TRAVEL_MAX = 16;

const integer = (value: string | null, fallback: number, max: number) => {
    if (value == null || value === "") return fallback;
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed)
        ? Math.max(0, Math.min(max, parsed))
        : fallback;
};

export function parseRecordingCrowd(
    search: string
): RecordingCrowdOptions | null {
    const params = new URLSearchParams(search);
    const count = integer(params.get("crowd"), 0, RECORDING_CROWD_MAX);
    if (!count) return null;
    const list = (name: string) =>
        (params.get(name) || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 16);
    return {
        count,
        travel: Math.min(
            count,
            integer(params.get("crowdTravel"), 8, RECORDING_CROWD_TRAVEL_MAX)
        ),
        wallets: list("crowdWallet").filter((wallet) =>
            /^(0x[0-9a-f]{40}|[a-z0-9-]+(\.[a-z0-9-]+)*\.eth)$/i.test(wallet)
        ),
        avatarIds: list("crowdAvatars"),
        names: params.get("crowdNames") !== "0",
        seed: integer(params.get("crowdSeed"), 1, 1_000_000),
    };
}

export function readRecordingCrowd(): RecordingCrowdOptions | null {
    try {
        return parseRecordingCrowd(window.location.search);
    } catch {
        return null;
    }
}

export interface CrowdAvatar {
    url: string;
    image?: string;
}

// Handles of the kind people use in the lobby. Invented, not real accounts.
const NAMES = [
    "mira",
    "kenji.eth",
    "lena_pixel",
    "théo",
    "nova42",
    "ada",
    "jules",
    "sam.eth",
    "glitchfrog",
    "yuki",
    "oscar",
    "ines",
    "marco.eth",
    "zara",
    "pixelpilgrim",
    "noor",
    "felix",
    "amara",
    "hugo",
    "lucia.eth",
    "kai",
    "maya",
    "dex",
    "sofia",
    "tomasz",
    "aiko",
    "rafa",
    "elena",
    "otto.eth",
    "selin",
    "bruno",
    "chloe",
    "ravi",
    "ines.eth",
    "leo",
    "hana",
    "ibrahim",
    "clara",
    "milo",
    "farah",
    "jonas",
    "luz",
    "pablo.eth",
    "rin",
    "victor",
    "ayla",
    "nico",
    "imani",
    "quentin",
    "sasha",
    "omar",
    "bea",
    "arjun",
    "lila.eth",
    "yann",
    "keiko",
    "diego",
    "vera",
    "malik",
    "ruth",
    "anouk",
    "tariq",
    "freya",
    "emeka",
    "louise",
    "ken",
    "paz",
    "soren",
    "nadia",
    "iggy",
    "wren",
    "salma",
    "juno",
    "basile",
    "mei",
    "andres",
    "kofi",
    "ilse",
    "yara",
    "dario",
];

/** Small deterministic generator so one seed always stages the same scene. */
function random(seed: number) {
    let state = seed >>> 0 || 1;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const emoteIndex = (name: string) =>
    EMOTES.findIndex((emote) => emote.name === name);
// Waving is common in a crowd; dancing is the exception.
const EMOTE_POOL = [
    "WAVING",
    "WAVING",
    "WAVING",
    "CHAABI",
    "HIPHOP",
    "SHUFFLING",
]
    .map(emoteIndex)
    .filter((index) => index >= 0);

/** Facing that walks toward (dx, dz), matching the lobby movement model. */
const facing = (dx: number, dz: number) => Math.atan2(-dx, -dz);
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

interface Leg {
    /** Seconds from the start of the loop. */
    start: number;
    walk: number;
    pause: number;
    from: { x: number; z: number };
    to: { x: number; z: number };
    /** Facing while paused at `to`, before turning to the next leg. */
    rest: number;
    emote: number;
}

interface Plan {
    person: LobbyParticipant;
    /** Talkers stand still; walkers loop through legs. */
    legs?: Leg[];
    loop?: number;
    offset: number;
    rotation: number;
    sway: number;
    emotes: { at: number; length: number; index: number }[];
    emoteCycle: number;
}

export interface RecordingCrowd {
    participants: LobbyParticipant[];
    /** The people who stand next to you and travel with you. */
    travelIds: string[];
    sample(nowMs: number): LobbyParticipant[];
}

/**
 * People in small groups chatting, some strolling between groups and pausing,
 * a few waving or dancing now and then, and a ring of friends around the
 * arrival spot who travel with you.
 */
export function createRecordingCrowd(
    options: RecordingCrowdOptions,
    avatars: readonly CrowdAvatar[]
): RecordingCrowd {
    const rand = random(options.seed * 7919 + options.count);
    const pick = <T>(items: readonly T[]) =>
        items[Math.floor(rand() * items.length)];
    const center = LOBBY_SPAWN_CENTER;
    const plans: Plan[] = [];
    const names = [...NAMES].sort(() => rand() - 0.5);
    let made = 0;
    const person = (x: number, z: number, rotation: number) => {
        const index = made++;
        const avatar = avatars.length
            ? avatars[index % avatars.length]
            : undefined;
        return {
            id: `recording-crowd-${index}`,
            name: options.names ? names[index % names.length] : "",
            x,
            y: 0,
            z,
            rotation,
            vrmUrl: avatar?.url,
            avatar: avatar?.image,
            scale: 1,
            animation: -1,
            floor: true,
            speed: 0,
            restConfirmed: true,
        } satisfies LobbyParticipant;
    };
    const emotes = (chance: number) => {
        const cycle = 18 + rand() * 22;
        const list = [] as Plan["emotes"];
        if (EMOTE_POOL.length && rand() < chance)
            list.push({
                at: rand() * (cycle - 5),
                length: 2.5 + rand() * 2.5,
                index: pick(EMOTE_POOL),
            });
        return { emotes: list, emoteCycle: cycle };
    };

    // Friends: a loose half ring just behind and beside the arrival spot, so
    // they are in frame and close when you leave together.
    const travelIds: string[] = [];
    for (let i = 0; i < options.travel; i++) {
        const side = i % 2 ? 1 : -1;
        const slot = Math.floor(i / 2);
        const angle = side * (0.55 + slot * 0.42) + (rand() - 0.5) * 0.2;
        const radius = 2.4 + (slot % 2) * 0.9 + rand() * 0.5;
        const x = center.x + Math.sin(angle) * radius;
        const z = center.z - Math.cos(angle) * radius * 0.8;
        const look = facing(center.x - x, center.z - z) + (rand() - 0.5) * 0.6;
        const p = person(x, z, look);
        travelIds.push(p.id);
        plans.push({
            person: p,
            offset: rand() * 100,
            rotation: look,
            sway: 0.08 + rand() * 0.1,
            ...emotes(0.4),
        });
    }

    // Groups of 2-5 people facing each other, spread over the floor ahead.
    const remaining = options.count - options.travel;
    const walkers = Math.round(remaining * 0.3);
    let talkers = remaining - walkers;
    const groups: { x: number; z: number }[] = [];
    while (talkers > 0) {
        const size = Math.min(talkers, 2 + Math.floor(rand() * 4));
        let x = 0,
            z = 0;
        for (let attempt = 0; attempt < 30; attempt++) {
            const angle = (rand() - 0.5) * Math.PI * 1.7;
            const distance = 5.5 + Math.sqrt(rand()) * 13;
            x = center.x + Math.sin(angle) * distance;
            z = center.z - Math.cos(angle) * distance;
            if (groups.every((g) => Math.hypot(g.x - x, g.z - z) > 3.2)) break;
        }
        groups.push({ x, z });
        const radius = 0.75 + size * 0.15;
        const start = rand() * Math.PI * 2;
        for (let i = 0; i < size; i++) {
            const angle =
                start + (i / size) * Math.PI * 2 + (rand() - 0.5) * 0.4;
            const px = x + Math.cos(angle) * radius;
            const pz = z + Math.sin(angle) * radius;
            const look = facing(x - px, z - pz) + (rand() - 0.5) * 0.35;
            plans.push({
                person: person(px, pz, look),
                offset: rand() * 100,
                rotation: look,
                sway: 0.05 + rand() * 0.12,
                ...emotes(0.3),
            });
        }
        talkers -= size;
    }

    // Walkers stroll from group to group, pausing near each.
    const stops = groups.length ? groups : [{ x: center.x, z: center.z - 8 }];
    for (let i = 0; i < walkers; i++) {
        const route: { x: number; z: number }[] = [];
        const count = 3 + Math.floor(rand() * 2);
        for (let s = 0; s < count; s++) {
            const g = pick(stops);
            const angle = rand() * Math.PI * 2;
            const r = 1.9 + rand() * 0.8;
            route.push({
                x: g.x + Math.cos(angle) * r,
                z: g.z + Math.sin(angle) * r,
            });
        }
        const legs: Leg[] = [];
        let time = 0;
        const pace = 1.1 + rand() * 0.6; // average m/s along a leg
        for (let s = 0; s < route.length; s++) {
            const from = route[s];
            const to = route[(s + 1) % route.length];
            const distance = Math.max(
                0.5,
                Math.hypot(to.x - from.x, to.z - from.z)
            );
            const walk = distance / pace;
            const pause = 2 + rand() * 5;
            const next = route[(s + 2) % route.length];
            legs.push({
                start: time,
                walk,
                pause,
                from,
                to,
                rest: facing(next.x - to.x, next.z - to.z),
                emote:
                    rand() < 0.25 && EMOTE_POOL.length ? pick(EMOTE_POOL) : -1,
            });
            time += walk + pause;
        }
        const first = legs[0];
        const look = facing(
            first.to.x - first.from.x,
            first.to.z - first.from.z
        );
        plans.push({
            person: person(first.from.x, first.from.z, look),
            legs,
            loop: time,
            offset: rand() * time,
            rotation: look,
            sway: 0,
            emotes: [],
            emoteCycle: 1,
        });
    }

    const participants = plans.map((plan) => plan.person);
    const samples = participants.map((p) => ({ ...p }));
    let started: number | undefined;
    const sample = (nowMs: number) => {
        started ??= nowMs;
        const elapsed = Math.max(0, (nowMs - started) / 1000);
        plans.forEach((plan, index) => {
            const out = samples[index];
            const time = elapsed + plan.offset;
            if (!plan.legs) {
                out.x = plan.person.x;
                out.z = plan.person.z;
                out.speed = 0;
                // Small weight shifts read as listening, not as a statue.
                out.rotation =
                    plan.rotation +
                    Math.sin(time * 0.37) * plan.sway +
                    Math.sin(time * 0.11 + 1.3) * plan.sway * 0.6;
                const phase = time % plan.emoteCycle;
                const active = plan.emotes.find(
                    (e) => phase >= e.at && phase < e.at + e.length
                );
                out.animation = active ? active.index : -1;
                return;
            }
            const local = time % plan.loop;
            const leg =
                plan.legs.find(
                    (l) =>
                        local >= l.start && local < l.start + l.walk + l.pause
                ) || plan.legs[plan.legs.length - 1];
            const t = local - leg.start;
            const dx = leg.to.x - leg.from.x;
            const dz = leg.to.z - leg.from.z;
            const heading = facing(dx, dz);
            if (t < leg.walk) {
                // Ease in and out so they start and stop like people do.
                const u = t / leg.walk;
                const along = (1 - Math.cos(Math.PI * u)) / 2;
                const distance = Math.hypot(dx, dz);
                out.x = leg.from.x + dx * along;
                out.z = leg.from.z + dz * along;
                out.speed =
                    ((Math.PI * distance) / (2 * leg.walk)) *
                    Math.sin(Math.PI * u);
                out.rotation = heading;
                out.animation = -1;
                out.restConfirmed = false;
            } else {
                const rest = t - leg.walk;
                out.x = leg.to.x;
                out.z = leg.to.z;
                out.speed = 0;
                out.restConfirmed = true;
                // Turn toward the next leg during the last second of a pause.
                const turn = Math.max(
                    0,
                    Math.min(1, (rest - (leg.pause - 1)) / 1)
                );
                const eased = turn * turn * (3 - 2 * turn);
                out.rotation = heading + wrap(leg.rest - heading) * eased;
                out.animation =
                    leg.emote >= 0 && rest > 0.4 && rest < leg.pause - 1.2
                        ? leg.emote
                        : -1;
            }
        });
        return samples;
    };
    return { participants, travelIds, sample };
}

/** Owned avatars first and evenly mixed with the catalogue ones. */
export function mixCrowdAvatars(
    owned: readonly CrowdAvatar[],
    catalogue: readonly CrowdAvatar[],
    maxModels = 20
): CrowdAvatar[] {
    const seen = new Set<string>();
    const unique = (items: readonly CrowdAvatar[]) =>
        items.filter((item) => {
            if (!item.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });
    const mine = unique(owned).slice(0, Math.ceil(maxModels / 2));
    const theirs = unique(catalogue).slice(0, maxModels - mine.length);
    const result: CrowdAvatar[] = [];
    for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
        if (theirs[i]) result.push(theirs[i]);
        if (mine[i]) result.push(mine[i]);
    }
    return result;
}
