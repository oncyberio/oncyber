export function startPerf(ts, name) {
    //
    ts[name] = performance.now();
}

export function endPerf(ts, name) {
    //
    ts[name] = performance.now() - ts[name];
}
