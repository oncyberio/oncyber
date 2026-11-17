/**
 * Wait at most `timeout` ms for the artworks in view to finish loading.
 *
 * `getArtworks` is read on every check because the space can close while we
 * wait: the studio takes an automatic cover 5 s after a space opens, and
 * people often leave sooner. When the artworks are gone we stop the timers
 * and reject, instead of reading a null container every 500 ms.
 */
export function waitForArtworks(
    getArtworks: () => { hasArtworksLoading(camera: unknown): boolean } | null,
    camera: unknown,
    timeout = 0
): Promise<void> {
    return new Promise((resolve, reject) => {
        let iv: ReturnType<typeof setInterval> = null;

        let tid: ReturnType<typeof setTimeout> = null;

        const stop = () => {
            clearTimeout(tid);
            if (iv) clearInterval(iv);
        };

        // true or false while the space is open, null once it closed.
        const check = () => {
            const artworks = getArtworks();

            if (!artworks) {
                stop();
                reject(new Error("The space closed before artworks loaded"));
                return null;
            }

            return artworks.hasArtworksLoading(camera);
        };

        tid = setTimeout(() => {
            stop();

            const loading = check();

            if (loading === null) return;

            if (loading) {
                reject(new Error("Please wait for artworks to load"));
            } else {
                resolve();
            }
        }, timeout);

        if (timeout) {
            iv = setInterval(() => {
                if (check() === false) {
                    stop();
                    resolve();
                }
            }, 500);
        }
    });
}
