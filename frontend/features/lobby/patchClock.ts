/**
 * Timestamps for Colyseus schema patches, which carry no server time.
 *
 * A room sends a patch on a fixed interval whenever anything changed, so the
 * real send times sit on a regular grid. Arrival times add network jitter on
 * top of that grid. Stamping each patch with its arrival time turns that
 * jitter into uneven interpolation spans, so remote avatars speed up and slow
 * down (and briefly stop) between packets. This clock puts arrivals back on
 * the grid instead: it learns the room's interval from the gaps between
 * patches, and aligns the grid with the least-delayed recent arrivals.
 */
export class PatchClock {
    private last: number | undefined;
    private anchor = 0;
    private tick = 0;
    private offsets: number[] = [];
    private gaps: number[] = [];
    private estimate: number;

    constructor(private fallbackMs = 200) {
        this.estimate = fallbackMs;
    }

    /** The patch interval in milliseconds, learned from recent arrivals. */
    get intervalMs() {
        return this.estimate;
    }

    /** The grid time of the most recent patch, or undefined before the first. */
    get lastStamp() {
        return this.last;
    }

    reset() {
        this.last = undefined;
        this.gaps.length = 0;
        this.offsets.length = 0;
        this.estimate = this.fallbackMs;
    }

    /** Returns a monotonic, jitter-free timestamp for a patch received at `arrival`. */
    stamp(arrival: number) {
        if (!Number.isFinite(arrival)) return this.last ?? 0;
        if (this.last === undefined || arrival - this.last > 5000) {
            this.restart(arrival);
            return arrival;
        }
        const previousEstimate = this.estimate;
        this.learn(arrival - this.last);
        // A new interval estimate starts a new grid at the last stamp.
        if (this.estimate !== previousEstimate) this.restart(this.last);
        const interval = this.estimate;
        const offset = Math.min(...this.offsets);
        // Patches only leave the room on its own ticks, so each one belongs
        // to a whole tick, and never two to the same tick.
        const tick = Math.max(
            this.tick + 1,
            Math.round((arrival - this.anchor - offset) / interval)
        );
        this.offsets.push(arrival - this.anchor - tick * interval);
        if (this.offsets.length > 20) this.offsets.shift();
        // The least-delayed recent arrival sets the grid's phase; a burst of
        // late packets does not drag it along.
        const stamp = Math.max(
            this.last + 1,
            Math.min(
                arrival,
                this.anchor + tick * interval + Math.min(...this.offsets)
            )
        );
        this.tick = tick;
        this.last = stamp;
        return stamp;
    }

    private restart(at: number) {
        this.anchor = at;
        this.tick = 0;
        this.offsets = [0];
        this.last = at;
    }

    private learn(gap: number) {
        // Gaps of several intervals (quiet rooms) say little about the interval.
        if (gap < 20 || gap > Math.max(250, this.estimate * 1.6)) return;
        this.gaps.push(gap);
        if (this.gaps.length > 24) this.gaps.shift();
        if (this.gaps.length < 8) return;
        const sorted = [...this.gaps].sort((a, b) => a - b);
        // A late patch lengthens one gap and shortens the next by the same
        // amount, so the median stays on the room's real interval. Round it so
        // the estimate (and the grid) only moves on a real change.
        const median = sorted[Math.floor(sorted.length / 2)];
        const next = Math.min(1000, Math.max(33, Math.round(median / 5) * 5));
        if (Math.abs(next - this.estimate) >= 5) this.estimate = next;
    }
}
