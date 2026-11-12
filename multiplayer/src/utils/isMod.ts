import fetch from "node-fetch";
import { provesUser } from "../identity/oncyberToken";

export const ADMINS = ["0xf02cb30a8963e6fe8cc7650a6169e603357650ad", "0xfd22004806a6846ea67ad883356be810f0428793", "0x76db02500f7631d57bc2dcdca9d4cf782b99e119", "0xd40b63bf04a44e43fbfe5784bcf22acaab34a180", "0x04173063c0c491470b735954790f94ed307aae9d", "0x911765e6cbf6f1dfc7c1bacc01be7e32612aa541", "0x3d055040d91414fbdc0a9eb0cb4e1bdf222fb1e1", "0x6ce28936ee5f6c2dcf33b731df675bdbd60b5593", "0x07387f22320e879959bbfc38400e69bbdd638c19", "0x9c360296bd72c940080f168e5cb0b4ce5f7e8036", "0xdbeb624f6a8c6ff6e66182da3de04d525ddbad6f"];

// This check runs server-to-server from the VM on every join/login/kick/
// voice-range. It used to blindly hit the public site: from a datacenter IP
// with no browser, Vercel's bot protection challenges/rate-limits those calls,
// and every failure mode (challenge page, 429, timeout, missing field) was
// swallowed upstream as "not a mod" — which is how a whole room loses its mods.
//
// Knobs (both optional, see infra/vm/.env.example):
// - ONCYBER_API_URL: override the API origin (e.g. one not behind bot
//   protection). Defaults to prod.
// - VERCEL_PROTECTION_BYPASS: the "Protection Bypass for Automation" secret
//   from Vercel project settings, sent as x-vercel-protection-bypass.
const API_URL = process.env.ONCYBER_API_URL || "https://oncyber.io/api";

const FETCH_TIMEOUT_MS = 5000;

// The check fires per join/login/kick/voice-range, so cache owner/editors
// briefly: far fewer API calls (keeps us under the rate limiter), and a
// transient API hiccup doesn't flip a room's mods to false. Negative results
// expire fast so a real outage recovers quickly.
const MOD_CACHE_TTL_MS = 60 * 1000;
const MOD_CACHE_MISS_TTL_MS = 10 * 1000;
const MOD_CACHE_MAX = 500;

type ExhibitModInfo = { owner?: string; editors: string[] };

const modInfoCache = new Map<
    string,
    { ts: number; value: ExhibitModInfo | null }
>();

function readModCache(key: string): ExhibitModInfo | null | undefined {
    const hit = modInfoCache.get(key);
    if (!hit) return undefined;

    const ttl = hit.value ? MOD_CACHE_TTL_MS : MOD_CACHE_MISS_TTL_MS;

    if (Date.now() - hit.ts > ttl) {
        modInfoCache.delete(key);
        return undefined;
    }

    return hit.value;
}

function writeModCache(key: string, value: ExhibitModInfo | null): void {
    modInfoCache.set(key, { ts: Date.now(), value });

    if (modInfoCache.size > MOD_CACHE_MAX) {
        // Evict the least-recently-used entry (Map preserves insertion order).
        const oldest = modInfoCache.keys().next().value;
        if (oldest !== undefined) modInfoCache.delete(oldest);
    }
}

async function fetchExhibit(url: string): Promise<any> {
    const headers: Record<string, string> = { Accept: "application/json" };

    const bypass = process.env.VERCEL_PROTECTION_BYPASS;
    if (bypass) headers["x-vercel-protection-bypass"] = bypass;

    let response;
    try {
        response = await fetch(url, {
            headers,
            timeout: FETCH_TIMEOUT_MS,
        });
    } catch (err) {
        console.error("checkIsMod: exhibit fetch error", url, err);
        return null;
    }

    if (!response.ok) {
        console.error(
            "checkIsMod: exhibit fetch failed",
            response.status,
            url
        );
        return null;
    }

    try {
        const data: any = await response.json();
        return data?.exhibit ?? null;
    } catch (err) {
        // Bot-protection challenge pages come back as HTML, not JSON.
        console.error("checkIsMod: exhibit response not JSON", url);
        return null;
    }
}

async function getExhibitModInfo(
    exhibitId: string
): Promise<ExhibitModInfo | null> {
    const cached = readModCache(exhibitId);
    if (cached !== undefined) return cached;

    // https://oncyber.io/api/exhibit?id=BMaHL6ath4joAQY4pNt6&type=FETCH_SINGLE_EXHIBIT
    let exhibit = await fetchExhibit(
        `${API_URL}/exhibit?id=${encodeURIComponent(
            exhibitId
        )}&type=FETCH_SINGLE_EXHIBIT`
    );

    // Room metadata.exhibitId is pinned from the first joiner's `currentSpace`,
    // and some entry points (e.g. the standalone gl loader) send the space
    // slug instead of the exhibit doc id — fall back to the customLink lookup.
    if (exhibit == null) {
        exhibit = await fetchExhibit(
            `${API_URL}/exhibit?customLink=${encodeURIComponent(
                exhibitId
            )}&type=GET_EXHIBIT_BY_CUSTOM_LINK`
        );
    }

    const info: ExhibitModInfo | null = exhibit
        ? {
              owner: exhibit.owner,
              editors: Array.isArray(exhibit.editors) ? exhibit.editors : [],
          }
        : null;

    writeModCache(exhibitId, info);

    return info;
}

export async function checkIsMod(userId: string, exhibitId: string, token: string): Promise<boolean> {
    const uid = userId?.toLowerCase?.();

    if (!uid || !exhibitId) return false;

    // userId comes from the client; only a verified session can claim it.
    if (!provesUser(uid, token)) return false;

    if (ADMINS.includes(uid)) {
        return true;
    }

    const exhibit = await getExhibitModInfo(exhibitId);

    if (exhibit == null) {
        return false;
    }

    if (exhibit.owner?.toLowerCase?.() === uid) {
        return true;
    }

    // if not a space editor then not an admin
    return exhibit.editors.some((it) => it?.toLowerCase?.() === uid);
}
