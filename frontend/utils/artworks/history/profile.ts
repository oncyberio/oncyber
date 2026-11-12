// Share profile lookups across visible activity rows, including duplicate accounts.
const cache = new Map<string, { until: number; image: string | null }>();
const pending = new Map<string, Promise<string | null>>();
const queue: Array<() => void> = [];
let active = 0;

function drain() {
    while (active < 3 && queue.length) queue.shift()();
}

export function fetchOpenSeaProfileImage(
    address: string
): Promise<string | null> {
    if (!/^0x[a-f\d]{40}$/i.test(address || "")) return Promise.resolve(null);
    const id = address.toLowerCase();
    const entry = cache.get(id);
    if (entry?.until > Date.now()) return Promise.resolve(entry.image);
    if (pending.has(id)) return pending.get(id);
    // Avoid an unbounded queue if a large timeline is scrolled rapidly.
    if (pending.size >= 100) return Promise.resolve(null);
    const request = new Promise<string | null>((resolve) => {
        queue.push(async () => {
            active++;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12000);
            let image: string = null;
            let ttl = 30000;
            try {
                const response = await fetch(
                    `/api/opensea-profile?address=${id}`,
                    { signal: controller.signal }
                );
                if (!response.ok) throw new Error("Profile unavailable");
                const profile = await response.json();
                if (
                    typeof profile.profile_image_url === "string" &&
                    profile.profile_image_url.startsWith("https://")
                ) {
                    image = profile.profile_image_url;
                }
                ttl = 3600000;
            } catch {
                // Profile failures never interrupt artwork activity.
            } finally {
                clearTimeout(timer);
                if (cache.size >= 1000) cache.delete(cache.keys().next().value);
                cache.set(id, { image, until: Date.now() + ttl });
                pending.delete(id);
                active--;
                resolve(image);
                drain();
            }
        });
    });
    pending.set(id, request);
    drain();
    return request;
}
