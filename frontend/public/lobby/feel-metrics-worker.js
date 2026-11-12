// Shared by the headless lab and the browser's dedicated metrics worker.
export function completeFeelReport({ samples, ...report }) {
    for (const [name, values] of Object.entries(samples)) {
        // Typed-array numeric sort avoids comparator callbacks and repeated copies.
        const sorted = values instanceof Float64Array ? values : Float64Array.from(values);
        sorted.sort();
        const percentile = (q) => sorted.length
            ? +sorted[Math.floor((sorted.length - 1) * q)].toFixed(4) : 0;
        report[name] = { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: percentile(1) };
    }
    return report;
}
if (typeof self !== "undefined" && typeof document === "undefined") {
    self.onmessage = ({ data }) => self.postMessage(completeFeelReport(data));
}
