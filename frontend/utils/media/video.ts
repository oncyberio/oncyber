/** A media element owns its HLS worker, requests and buffers after loading. */
const playback = new WeakMap<HTMLVideoElement, () => void>();

export function releaseArtworkVideo(video?: HTMLVideoElement | null) {
    if (!video) return;
    const cleanup = playback.get(video);
    playback.delete(video);
    try {
        cleanup?.();
    } finally {
        video.pause?.();
        video.srcObject = null;
        if (video.removeAttribute) {
            video.removeAttribute("src");
            video.load?.();
        } else {
            video.src = null;
        }
    }
}

const cancelled = () =>
    new DOMException("Artwork loading cancelled", "AbortError");

/** Event-based loading leaves no polling timer or abort listener after success. */
export function loadArtworkVideoElement(
    url: string,
    video: HTMLVideoElement,
    signal?: AbortSignal,
    muted = false
): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            video.onloadeddata = video.onerror = null;
            signal?.removeEventListener("abort", cancel);
        };
        const fail = (error: Error) => {
            cleanup();
            releaseArtworkVideo(video);
            reject(error);
        };
        const cancel = () => fail(cancelled());
        if (signal?.aborted) {
            cancel();
            return;
        }
        signal?.addEventListener("abort", cancel, { once: true });
        video.crossOrigin = "";
        video.playsInline = true;
        video.loop = true;
        video.muted = muted;
        video.onerror = () =>
            fail(
                new Error(
                    `Unable to load artwork video (${
                        video.error?.code ?? "unknown"
                    })`
                )
            );
        video.onloadeddata = () => {
            cleanup();
            video.currentTime = 0.001;
            resolve(video);
        };
        try {
            video.src = url;
            video.load();
        } catch (error) {
            fail(error);
        }
    });
}

export async function loadArtworkHlsVideo(
    url: string,
    video: HTMLVideoElement,
    signal?: AbortSignal
): Promise<HTMLVideoElement> {
    if (signal?.aborted) throw cancelled();
    const Hls = (await import("hls.js")).default;
    if (signal?.aborted) throw cancelled();
    if (!Hls.isSupported()) throw new Error("Can't play HLS stream");
    return new Promise((resolve, reject) => {
        const hls = new Hls();
        const unlink = () => {
            signal?.removeEventListener("abort", cancel);
            hls.off(Hls.Events.MEDIA_ATTACHED, ready);
        };
        const fail = (error: Error) => {
            releaseArtworkVideo(video);
            reject(error);
        };
        const cancel = () => fail(cancelled());
        const ready = () => {
            // The loader's timeout/abort signal ends here. The video controller
            // now owns playback and must destroy HLS on replacement or exit.
            unlink();
            resolve(video);
        };
        const error = (_event: string, data: { fatal: boolean }) => {
            if (data.fatal) fail(new Error("Unable to load HLS artwork"));
        };
        playback.set(video, () => {
            unlink();
            hls.off(Hls.Events.ERROR, error);
            hls.destroy();
        });
        signal?.addEventListener("abort", cancel, { once: true });
        hls.on(Hls.Events.ERROR, error);
        hls.on(Hls.Events.MEDIA_ATTACHED, ready);
        video.playsInline = true;
        try {
            hls.loadSource(url);
            hls.attachMedia(video);
        } catch (error) {
            fail(error);
        }
    });
}
