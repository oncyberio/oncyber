// @ts-check

// A small flight recorder for the "thrown out of the space" bug. It keeps the
// last couple of seconds of physics frames and, when a guard in physics
// fires, logs them and saves them to localStorage ("oncyber:escape") so the
// cause can be read after the fact. Costs a few numbers per frame.

const FRAMES = 120;

const FIELDS = 14;

const STORAGE_KEY = "oncyber:escape";

export class EscapeRecorder {
    buffer = new Float64Array(FRAMES * FIELDS);

    count = 0;

    /**
     * @param {number} dt
     * @param {{x:number,y:number,z:number}} before
     * @param {{x:number,y:number,z:number}} after
     * @param {{x:number,y:number,z:number}} velocity before this frame's move
     * @param {boolean} onFloor
     * @param {any} result the collision result (normal, depth) or null
     * @param {number} colliderHeight
     */
    record(dt, before, after, velocity, onFloor, result, colliderHeight) {
        const o = (this.count % FRAMES) * FIELDS;
        const b = this.buffer;
        b[o] = performance.now();
        b[o + 1] = dt;
        b[o + 2] = before.x;
        b[o + 3] = before.y;
        b[o + 4] = before.z;
        b[o + 5] = after.x;
        b[o + 6] = after.y;
        b[o + 7] = after.z;
        b[o + 8] = velocity.x;
        b[o + 9] = velocity.y;
        b[o + 10] = velocity.z;
        b[o + 11] = onFloor ? 1 : 0;
        b[o + 12] = result ? result.depth : 0;
        b[o + 13] = colliderHeight;
        this.count++;
    }

    /** Frames oldest first, rounded for reading. */
    frames() {
        const out = [];
        const n = Math.min(this.count, FRAMES);
        const r = (v) => Math.round(v * 1000) / 1000;
        for (let i = this.count - n; i < this.count; i++) {
            const o = (i % FRAMES) * FIELDS;
            const b = this.buffer;
            out.push({
                t: Math.round(b[o]),
                dt: r(b[o + 1]),
                from: [r(b[o + 2]), r(b[o + 3]), r(b[o + 4])],
                to: [r(b[o + 5]), r(b[o + 6]), r(b[o + 7])],
                v: [r(b[o + 8]), r(b[o + 9]), r(b[o + 10])],
                floor: b[o + 11],
                depth: r(b[o + 12]),
                height: r(b[o + 13]),
            });
        }
        return out;
    }

    /**
     * @param {string} reason
     * @param {Record<string, unknown>} [extra]
     */
    report(reason, extra = {}) {
        const report = {
            reason,
            at: new Date().toISOString(),
            href: typeof location === "undefined" ? "" : location.pathname,
            ...extra,
            frames: this.frames(),
        };
        console.warn("[space-bounds] " + reason, report);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
        } catch {
            // Private mode or full storage: the console copy is enough.
        }
        return report;
    }
}
