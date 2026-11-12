/**
 * Render on demand: whether the world draws this frame.
 *
 * The update loop keeps running every frame (controls, players, physics,
 * audio, timers); only the draw is skipped, and only when nothing that can
 * change the picture has happened for `graceMs`. Anything that can change
 * it either marks itself continuous (drawn every frame while it lasts) or
 * invalidates (draws from now until `graceMs` has passed quietly). Every
 * `probeMs` while idle one frame is drawn anyway, and if the GPU received
 * anything new for it (renderDemandGate.js measures that), the world is
 * awake again: that catches sources no detector saw.
 *
 * The rule when in doubt is to draw. A frame is skipped only when the
 * caller says the world is eligible (a settled visitor state, not the
 * editor, XR or a recording), no continuous source is active, nothing was
 * invalidated for `graceMs` and the last draw was less than `probeMs` ago.
 *
 * Kept pure (time is passed in) so the table in renderDemand.test.js can
 * pin it. INVENTORY of the sources: docs/benchmarks/render-on-demand.md.
 */

/** Turns the whole feature off in one place: every frame is drawn. */
export const RENDER_ON_DEMAND = true;

/** Quiet time after the last change before frames are skipped. */
export const RENDER_DEMAND_GRACE_MS = 500;

/** While idle, one frame is drawn this often to catch unseen changes. */
export const RENDER_DEMAND_PROBE_MS = 1000;

/**
 * @param {{ enabled?: boolean, graceMs?: number, probeMs?: number }} [options]
 */
export function createRenderDemand({
    enabled = RENDER_ON_DEMAND,
    graceMs = RENDER_DEMAND_GRACE_MS,
    probeMs = RENDER_DEMAND_PROBE_MS,
} = {}) {
    /** @type {Set<string>} */
    const continuous = new Set();
    let lastActivity = -Infinity;
    let lastDraw = -Infinity;
    // starting counts as a change
    let pending = true;
    const stats = { drawn: 0, skipped: 0, probes: 0 };
    /** @type {{ drawn: boolean, previousDrawn: boolean, reason: string }} */
    const frame = { drawn: true, previousDrawn: true, reason: "start" };

    function settle(now, drawn, reason) {
        frame.previousDrawn = frame.drawn;
        frame.drawn = drawn;
        frame.reason = reason;
        if (drawn) {
            lastDraw = now;
            stats.drawn++;
            if (reason === "probe") stats.probes++;
        } else {
            stats.skipped++;
        }
        return { draw: drawn, reason };
    }

    return {
        get enabled() {
            return enabled;
        },
        set enabled(value) {
            enabled = !!value;
            pending = true;
        },
        /** What the last decided frame did (for frame timing). */
        frame,
        stats,
        /**
         * A source that changes the picture every frame while it lasts
         * (a playing video, a measurement that needs real frames).
         * @param {string} source
         * @param {boolean} active
         */
        setContinuous(source, active) {
            if (active) continuous.add(source);
            else if (continuous.delete(source)) pending = true;
        },
        isContinuous(source) {
            return source ? continuous.has(source) : continuous.size > 0;
        },
        /** Something changed: draw, and keep drawing for `graceMs`. */
        invalidate() {
            pending = true;
        },
        /**
         * Decides the frame at `now` (ms). `eligible` false (editor, XR,
         * recording, a transition...) always draws.
         * @param {number} now
         * @param {{ eligible?: boolean }} [options]
         * @returns {{ draw: boolean, reason: string }}
         */
        decide(now, { eligible = true } = {}) {
            if (pending) {
                pending = false;
                lastActivity = now;
            }
            if (!enabled) return settle(now, true, "disabled");
            if (!eligible) {
                lastActivity = now;
                return settle(now, true, "ineligible");
            }
            if (continuous.size > 0) {
                lastActivity = now;
                return settle(now, true, "continuous");
            }
            if (now - lastActivity < graceMs)
                return settle(now, true, "recent-change");
            if (now - lastDraw >= probeMs) return settle(now, true, "probe");
            return settle(now, false, "idle");
        },
        /**
         * Overrides the last decision when a detector that runs after it
         * (scene graph, camera) found a change: the frame is drawn. Whether
         * the world stays awake is up to drawn(): a change the GPU never
         * sees (an object moving out of view) does not keep it drawing.
         * @param {number} now
         */
        wake(now) {
            if (!frame.drawn) {
                frame.drawn = true;
                frame.reason = "change";
                lastDraw = now;
                stats.skipped--;
                stats.drawn++;
            }
            return { draw: true, reason: frame.reason };
        },
        /**
         * After a drawn frame: `changed` when the GPU received anything new
         * for it (uniforms, buffers, textures, a different set of draws).
         * @param {number} now
         * @param {{ changed?: boolean }} [options]
         */
        drawn(now, { changed = false } = {}) {
            if (changed) lastActivity = now;
        },
        /** Whether the next decide() could skip (no pending change). */
        get pending() {
            return pending;
        },
    };
}

/** The engine's one instance: world3D.js decides, api.js reads `frame`. */
export const RenderDemand = createRenderDemand();
