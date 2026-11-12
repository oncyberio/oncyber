export type NativeConnectionState = "connecting" | "connected" | "unavailable";

type EntryOptions = {
    signal: AbortSignal;
    onConnectionState?: (state: NativeConnectionState) => void;
    retryDelays?: readonly number[];
};

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const finish = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", finish);
            resolve();
        };
        const timer = setTimeout(finish, delay);
        if (signal.aborted) finish();
        else signal.addEventListener("abort", finish, { once: true });
    });
}

/** Access is checked by the caller. Scene readiness releases entry; the separate
 * coordinate room can join/retry later without restarting the scene or social group. */
export async function prepareNativeEntry(
    connect: (signal: AbortSignal) => Promise<boolean | void>,
    stage: () => Promise<unknown>,
    options: EntryOptions
): Promise<void> {
    const connection = new AbortController();
    let connected = false;
    const abort = () => connection.abort();
    const unlink = () => options.signal.removeEventListener("abort", abort);
    connection.signal.addEventListener("abort", unlink, { once: true });
    if (options.signal.aborted) abort();
    else options.signal.addEventListener("abort", abort, { once: true });
    const report = (state: NativeConnectionState) => {
        if (!connection.signal.aborted) options.onConnectionState?.(state);
    };
    // Observe every outcome immediately. A failed/slow room must never reject
    // entry, and an old attempt must never retry after the visitor has left.
    const background = async () => {
        const delays = options.retryDelays ?? [750, 2000];
        report("connecting");
        for (let attempt = 0; attempt <= delays.length; attempt++) {
            if (connection.signal.aborted) return;
            try {
                const result = await connect(connection.signal);
                if (connection.signal.aborted) return;
                if (result !== false) {
                    connected = true;
                    report("connected");
                    return;
                }
            } catch {
                if (connection.signal.aborted) return;
            }
            if (attempt < delays.length)
                await waitForRetry(delays[attempt], connection.signal);
        }
        report("unavailable");
    };
    void background()
        .catch(() => {})
        .finally(() => {
            // Keep the successful session tied to this entry until departure.
            if (!connected) unlink();
        });
    try {
        if (connection.signal.aborted)
            throw Object.assign(new Error("Arrival cancelled."), {
                name: "AbortError",
            });
        await stage();
        if (options.signal.aborted)
            throw Object.assign(new Error("Arrival cancelled."), {
                name: "AbortError",
            });
    } catch (error) {
        connection.abort();
        throw error;
    }
}
