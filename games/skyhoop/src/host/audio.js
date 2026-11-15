// Skyhoop's sound, synthesised with Web Audio: wind that rises with your
// speed, a crowd bed that swells into a roar, and short cues (whistle,
// bat crack, Bolt clang, catches, goals, the Wisp's chime). No samples.

export function createAudio() {
    return { ctx: null, muted: false, nodes: null, env: { wind: 0, crowd: 0.3, boost: false, charge: 0 } };
}

function noiseBuffer(ctx, seconds, brown = false) {
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let last = 0;
        for (let i = 0; i < n; i++) {
            const w = Math.random() * 2 - 1;
            if (brown) {
                last = (last + 0.02 * w) / 1.02;
                d[i] = last * 3.5;
            } else d[i] = w;
        }
    }
    return buf;
}

export function unlockAudio(a) {
    if (a.ctx) {
        if (a.ctx.state === "suspended") a.ctx.resume();
        return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    a.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = a.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    const white = noiseBuffer(ctx, 3);
    const brown = noiseBuffer(ctx, 4, true);
    const loop = (buf) => {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.start();
        return s;
    };
    // Wind: band-passed noise that opens up with speed.
    const wind = loop(white);
    const windBand = ctx.createBiquadFilter();
    windBand.type = "bandpass";
    windBand.Q.value = 0.7;
    windBand.frequency.value = 300;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windBand).connect(windGain).connect(master);
    // A high whistle on boost.
    const hiss = loop(white);
    const hissBand = ctx.createBiquadFilter();
    hissBand.type = "bandpass";
    hissBand.Q.value = 6;
    hissBand.frequency.value = 2600;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    hiss.connect(hissBand).connect(hissGain).connect(master);
    // Crowd: brown noise through a voice-like formant pair, slowly wobbling.
    const crowd = loop(brown);
    const f1 = ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.value = 520;
    f1.Q.value = 0.8;
    const f2 = ctx.createBiquadFilter();
    f2.type = "peaking";
    f2.frequency.value = 1400;
    f2.gain.value = 6;
    const crowdGain = ctx.createGain();
    crowdGain.gain.value = 0.0;
    crowd.connect(f1).connect(f2).connect(crowdGain).connect(master);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(f1.frequency);
    lfo.start();
    a.nodes = { master, windBand, windGain, hissGain, hissBand, crowdGain, f1, white };
}

export function setMuted(a, muted) {
    a.muted = muted;
    if (a.nodes) a.nodes.master.gain.setTargetAtTime(muted ? 0 : 0.8, a.ctx.currentTime, 0.05);
}

export function updateAudio(a, env) {
    a.env = env;
    if (!a.nodes) return;
    const t = a.ctx.currentTime;
    const n = a.nodes;
    const w = Math.max(0, env.wind || 0);
    n.windGain.gain.setTargetAtTime(0.03 + w * w * 0.32, t, 0.15);
    n.windBand.frequency.setTargetAtTime(240 + w * 1100, t, 0.2);
    n.hissGain.gain.setTargetAtTime(env.boost ? 0.05 : 0, t, 0.1);
    n.hissBand.frequency.setTargetAtTime(2200 + w * 900, t, 0.2);
    const crowd = env.screen === "loading" ? 0 : env.crowd || 0.3;
    n.crowdGain.gain.setTargetAtTime(crowd * crowd * 0.55, t, crowd > 0.6 ? 0.08 : 0.6);
    n.f1.frequency.setTargetAtTime(460 + crowd * 260, t, 0.3);
}

// ------------------------------------------------------------- cues

function env(ctx, node, t, a, peak, hold, release) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.setValueAtTime(peak, t + a + hold);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + release);
}

function tone(a, type, freq, t, dur, peak, { to, attack = 0.005, filter } = {}) {
    const ctx = a.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    let out = o;
    if (filter) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = filter;
        o.connect(f);
        out = f;
    }
    out.connect(g).connect(a.nodes.master);
    env(ctx, g, t, attack, peak, 0, dur);
    o.start(t);
    o.stop(t + dur + attack + 0.05);
}

function burst(a, t, dur, peak, { freq = 1000, q = 1, type = "bandpass", sweep } = {}) {
    const ctx = a.ctx;
    const s = ctx.createBufferSource();
    s.buffer = a.nodes.white;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    s.connect(f).connect(g).connect(a.nodes.master);
    env(ctx, g, t, 0.01, peak, 0, dur);
    s.start(t, Math.random() * 2);
    s.stop(t + dur + 0.1);
}

export function play(a, name, cue = {}) {
    if (!a.nodes || a.muted) return;
    const t = a.ctx.currentTime + 0.005;
    const v = Math.max(0.05, Math.min(1, cue.v ?? 1));
    switch (name) {
        case "whistle":
            for (let i = 0; i < 2; i++) {
                const o = a.ctx.createOscillator();
                o.frequency.value = 2900 + i * 40;
                const vib = a.ctx.createOscillator();
                vib.frequency.value = 34;
                const vg = a.ctx.createGain();
                vg.gain.value = 120;
                vib.connect(vg).connect(o.frequency);
                const g = a.ctx.createGain();
                o.connect(g).connect(a.nodes.master);
                env(a.ctx, g, t, 0.01, 0.06 * v, 0.45, 0.12);
                o.start(t);
                vib.start(t);
                o.stop(t + 0.7);
                vib.stop(t + 0.7);
            }
            break;
        case "goal": {
            // The crowd erupts and a brass chord rings out.
            const swell = a.ctx.createBufferSource();
            swell.buffer = a.nodes.white;
            const f = a.ctx.createBiquadFilter();
            f.type = "bandpass";
            f.frequency.value = 700;
            f.Q.value = 0.6;
            const g = a.ctx.createGain();
            swell.connect(f).connect(g).connect(a.nodes.master);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(cue.ours ? 0.5 : 0.3, t + 0.25);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
            swell.start(t);
            swell.stop(t + 3.6);
            const root = cue.ours ? 261.6 : 196;
            const chord = cue.ours ? [1, 1.26, 1.5, 2] : [1, 1.19, 1.5];
            chord.forEach((k, i) => tone(a, "sawtooth", root * k, t + i * 0.06, 1.2, 0.05, { filter: 1800, attack: 0.03 }));
            tone(a, "sine", 82, t, 0.5, 0.35, { to: 40 });
            break;
        }
        case "save":
            tone(a, "sine", 140, t, 0.25, 0.35 * v, { to: 70 });
            burst(a, t + 0.05, 1.2, 0.18, { freq: 500, q: 0.7 });
            break;
        case "whoosh":
            burst(a, t, 0.35, 0.22 * v, { freq: 500, q: 1.5, sweep: 2400 });
            break;
        case "dash":
        case "roll":
            burst(a, t, 0.4, 0.18 * v, { freq: 1600, q: 1.2, sweep: 400 });
            break;
        case "catch":
            tone(a, "sine", 180, t, 0.16, 0.45 * v, { to: 90 });
            burst(a, t, 0.05, 0.2 * v, { freq: 3000, q: 1 });
            break;
        case "steal":
            burst(a, t, 0.2, 0.2 * v, { freq: 900, q: 2, sweep: 2600 });
            tone(a, "triangle", 660, t + 0.04, 0.18, 0.12 * v, { to: 990 });
            break;
        case "thud":
            tone(a, "sine", 110, t, 0.2, 0.3 * v, { to: 60 });
            break;
        case "clang":
            [1, 2.76, 5.4, 8.93].forEach((k, i) => tone(a, "sine", 310 * k, t, 0.9 / (i + 1), (0.22 / (i + 1)) * v));
            burst(a, t, 0.08, 0.3 * v, { freq: 2500, q: 0.8 });
            break;
        case "bat":
            burst(a, t, 0.07, 0.4 * v, { freq: 1800, q: 1.5 });
            tone(a, "triangle", 240, t, 0.12, 0.25 * v, { to: 160 });
            break;
        case "rim":
            [1, 2.4, 4.1].forEach((k, i) => tone(a, "sine", 880 * k, t, 0.6 / (i + 1), 0.12 / (i + 1)));
            break;
        case "chime":
            [1, 1.25, 1.5, 2, 2.5].forEach((k, i) => tone(a, "sine", 880 * k, t + i * 0.07, 1.4, 0.07));
            break;
        case "fanfare":
            [1, 1.25, 1.5, 2].forEach((k, i) => tone(a, "sawtooth", 349 * k, t + i * 0.14, 0.9, 0.06, { filter: 2200, attack: 0.02 }));
            break;
        case "horn":
            tone(a, "sawtooth", 147, t, 1.1, 0.08, { filter: 900, attack: 0.05 });
            tone(a, "sawtooth", 110, t + 0.5, 1.4, 0.08, { filter: 800, attack: 0.05 });
            break;
        default:
            break;
    }
}
