/** Browser CPU submission and rAF intervals, not GPU execution timings. */
export class FrameTimings {
    private started = 0;
    private last = 0;
    private cpu: number[] = [];
    private intervals: number[] = [];
    reset() {
        this.started = this.last = 0;
        this.cpu.length = this.intervals.length = 0;
    }
    record(time: number, cpuMs: number, settled: boolean) {
        if (!settled) {
            this.reset();
            return;
        }
        if (!this.started) this.started = time;
        const interval = this.last ? time - this.last : 0;
        this.last = time;
        if (time - this.started < 3000 || interval <= 0) return;
        this.cpu.push(cpuMs);
        this.intervals.push(interval);
        if (this.cpu.length > 300) {
            this.cpu.shift();
            this.intervals.shift();
        }
    }
    stats() {
        const percentiles = (values: number[]) => {
            const sorted = values.slice().sort((a, b) => a - b);
            return {
                p50: sorted[Math.floor((sorted.length - 1) * 0.5)],
                p95: sorted[Math.floor((sorted.length - 1) * 0.95)],
                p99: sorted[Math.floor((sorted.length - 1) * 0.99)],
                max: sorted[sorted.length - 1],
            };
        };
        return {
            sampleFrames: this.cpu.length,
            ...(this.cpu.length
                ? {
                      frameCpuMs: percentiles(this.cpu),
                      frameIntervalMs: percentiles(this.intervals),
                  }
                : {}),
        };
    }
}
