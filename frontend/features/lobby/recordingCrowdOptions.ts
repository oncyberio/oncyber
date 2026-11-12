/** URL options for the staged recording crowd. Kept free of engine imports so
 * the landing page can read the crowd size without loading the lobby. */
/**
 * A staged crowd for recording videos of the lobby. URL-only, never stored,
 * never sent to the lobby server: other visitors don't see these people.
 *
 *   ?crowd=40              how many people (up to 250)
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

export const RECORDING_CROWD_MAX = 250;
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
