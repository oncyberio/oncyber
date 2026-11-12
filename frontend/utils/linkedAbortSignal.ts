/** Link a request to its scene lifetime, and release source listeners when the
 * request completes even if neither source ever aborts. */
export function linkedAbortSignal(
    signals: readonly (AbortSignal | undefined)[]
) {
    const controller = new AbortController();
    const sources = Array.from(new Set(signals.filter(Boolean)));
    const dispose = () => {
        for (const source of sources)
            source.removeEventListener("abort", abort);
    };
    const abort = () => {
        const source = sources.find((value) => value.aborted);
        dispose();
        controller.abort(source?.reason);
    };
    for (const source of sources) {
        if (source.aborted) {
            abort();
            break;
        }
        source.addEventListener("abort", abort, { once: true });
    }
    return { signal: controller.signal, dispose };
}
