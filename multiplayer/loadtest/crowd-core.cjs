/* Pure CPU selection benchmark; no sockets, no rendering, no claim of network capacity.
 * Run: node loadtest/crowd-core.cjs --ticks=200 --voice=100
 * The full-sort reference preserves the pre-optimization algorithm for repeatable
 * before/after comparison and exact selection regression tests. */
const { performance } = require("node:perf_hooks");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS" } });
const { CrowdModel } = require("../src/rooms/crowd/core");
const { AOI_LIMIT, AOI_RADIUS, CANDIDATE_LIMIT, VOICE_LIMIT, VOICE_RADIUS } = require("../src/rooms/crowd/protocol");
const hash = (id) => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return h >>> 0;
};
const distanceSq = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const offsets = [];
for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) offsets.push([x, z]);
offsets.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1]);
class FullSortReference extends CrowdModel {
    selectVisible(p) {
        const candidates = new Map();
        // Retaining bounded previous members avoids churn at both range and density boundaries.
        for (const id of p.visible) {
            const peer = this.people.get(id);
            if (peer && distanceSq(p, peer) <= 52 ** 2) candidates.set(id, peer);
        }
        const cx = Math.floor(p.x / 8),
            cz = Math.floor(p.z / 8),
            seed = hash(p.id);
        let visits = 0;
        for (const [dx, dz] of offsets) {
            const bucket = this.cells.get(`${cx + dx},${cz + dz}`);
            if (!bucket) continue;
            const count = Math.min(bucket.length, CANDIDATE_LIMIT - visits);
            const start = seed % bucket.length;
            for (let i = 0; i < count; i++) {
                const peer = bucket[(start + i) % bucket.length];
                visits++;
                if (peer !== p && distanceSq(p, peer) <= AOI_RADIUS ** 2) candidates.set(peer.id, peer);
            }
            if (visits >= CANDIDATE_LIMIT) break;
        }
        this.lastCandidateVisits = visits;
        const ranked = Array.from(candidates.values(), (peer) => ({ peer, score: Math.sqrt(distanceSq(p, peer)) - (p.visible.has(peer.id) ? 2 : 0) }));
        ranked.sort((a, b) => a.score - b.score || a.peer.id.localeCompare(b.peer.id));
        p.visible = new Set(ranked.slice(0, AOI_LIMIT).map((entry) => entry.peer.id));
        return p.visible;
    }
    updateVisibility() {
        for (const p of this.people.values()) this.selectVisible(p);
    }
    updateVoice() {
        // Only mutually visible, nearby, ready peers can negotiate. Every edge has a degree cap.
        const edges = [];
        for (const p of this.people.values()) {
            if (!p.voiceReady) continue;
            const nearest = [];
            for (const id of p.visible) {
                const peer = this.people.get(id);
                if (!peer || !peer.voiceReady || !peer.visible.has(p.id)) continue;
                const distance = distanceSq(p, peer);
                if (distance <= VOICE_RADIUS ** 2) nearest.push({ peer, distance });
            }
            nearest.sort((a, b) => a.distance - b.distance || a.peer.id.localeCompare(b.peer.id));
            for (const { peer, distance } of nearest.slice(0, 16)) if (p.id < peer.id) edges.push({ a: p, b: peer, score: Math.sqrt(distance) - (p.voice.has(peer.id) ? 2 : 0) });
        }
        edges.sort((a, b) => a.score - b.score || a.a.id.localeCompare(b.a.id) || a.b.id.localeCompare(b.b.id));
        for (const p of this.people.values()) p.voice = new Set();
        for (const { a, b } of edges)
            if (a.voice.size < VOICE_LIMIT && b.voice.size < VOICE_LIMIT) {
                a.voice.add(b.id);
                b.voice.add(a.id);
            }
    }
}
function fixture(Model, count, scenario, voiceReadyPercent = 100) {
    const model = new Model(),
        people = [];
    for (let i = 0; i < count; i++) {
        const id = `guest-${i.toString().padStart(5, "0")}`;
        const p = model.add(id, { sessionId: id, userId: id, username: id, avatar: "", VRM: "", scale: 1 }, 0);
        const angle = i * 2.399963,
            radius = 2 + ((i * 13) % 600) / 100;
        if (scenario === "dense") {
            p.x = Math.cos(angle) * radius;
            p.z = Math.sin(angle) * radius;
        } else {
            const width = Math.ceil(Math.sqrt(count));
            p.x = (i % width) * 3 - 70;
            p.z = Math.floor(i / width) * 3 - 70;
        }
        model.index(p);
        p.voiceReady = i % 100 < voiceReadyPercent;
        people.push(p);
    }
    return { model, people };
}
function percentile(values, q) {
    const sorted = values.slice().sort((a, b) => a - b);
    return +(sorted[Math.floor(sorted.length * q)] || 0).toFixed(3);
}
function benchmark(Model, count, scenario, iterations, voiceReadyPercent) {
    const { model, people } = fixture(Model, count, scenario, voiceReadyPercent);
    model.updateVisibility();
    model.updateVoice();
    const aoi = [],
        voice = [],
        tickMs = [];
    for (let tick = 0; tick < iterations + 40; tick++) {
        // Every player keeps moving, so this does not measure a stationary-cache shortcut.
        for (let i = 0; i < people.length; i++) {
            const p = people[i];
            p.x += Math.cos(i + tick * 0.02) * 0.003;
            p.z += Math.sin(i + tick * 0.02) * 0.003;
            model.index(p);
        }
        const start = performance.now();
        for (let i = tick % 4; i < people.length; i += 4) model.selectVisible(people[i]);
        const interestMs = performance.now() - start;
        const voiceStart = performance.now();
        if (tick % 5 === 1) model.updateVoice();
        const voiceMs = performance.now() - voiceStart;
        if (tick >= 40) {
            aoi.push(interestMs);
            if (tick % 5 === 1) voice.push(voiceMs);
            tickMs.push(interestMs + voiceMs);
        }
    }
    return { aoiQuarterMs: { p50: percentile(aoi, 0.5), p95: percentile(aoi, 0.95) }, voiceAllMs: { p50: percentile(voice, 0.5), p95: percentile(voice, 0.95) }, selectionTickMs: { p50: percentile(tickMs, 0.5), p95: percentile(tickMs, 0.95) } };
}
if (require.main === module) {
    const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")));
    const ticks = Math.max(20, Math.min(2000, Number(args.ticks) || 200));
    const voiceReadyPercent = args.voice === undefined ? 100 : Number(args.voice);
    if (!Number.isFinite(voiceReadyPercent) || voiceReadyPercent < 0 || voiceReadyPercent > 100) throw new Error("voice must be 0..100 percent");
    const counts = args.count ? [Number(args.count)] : [512, 2048];
    if (counts.some((count) => !Number.isInteger(count) || count < 2 || count > 2048)) throw new Error("count must be 2..2048");
    for (const count of counts)
        for (const scenario of ["dense", "spread"]) {
            const baseline = benchmark(FullSortReference, count, scenario, ticks, voiceReadyPercent);
            const optimized = benchmark(CrowdModel, count, scenario, ticks, voiceReadyPercent);
            console.log(JSON.stringify({ pureCpuOnly: true, count, scenario, measuredTicks: ticks, warmupTicks: 40, voiceReadyPercent, baseline, optimized, aoiMedianSpeedup: +(baseline.aoiQuarterMs.p50 / optimized.aoiQuarterMs.p50).toFixed(2), voiceMedianSpeedup: +(baseline.voiceAllMs.p50 / optimized.voiceAllMs.p50).toFixed(2) }));
        }
}
module.exports = { FullSortReference, fixture };
