// All sound is synthesized with Web Audio: the sea and the falls, birds by
// day and crickets by night, a gentle marimba tune, bloomling coos and the
// little pops and chimes of looking after them.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function createAudio() {
    return {
        ctx: null,
        muted: false,
        master: null,
        sfx: null,
        music: null,
        amb: null,
        noise: null,
        beat: 0,
        next: 0,
        falls: null,
        birdsAt: 0,
        musicOn: true,
        mode: "garden",
    };
}

export function unlockAudio(a) {
    if (a.ctx) {
        if (a.ctx.state === "suspended") a.ctx.resume();
        return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    a.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    a.master = ctx.createGain();
    a.master.gain.value = a.muted ? 0 : 0.8;
    a.master.connect(comp);
    for (const k of ["sfx", "music", "amb"]) {
        a[k] = ctx.createGain();
        a[k].connect(a.master);
    }
    a.music.gain.value = 0.32;
    a.amb.gain.value = 0.5;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    a.noise = buf;
    startBeds(a);
    a.next = ctx.currentTime + 0.3;
}

export function setMuted(a, muted) {
    a.muted = muted;
    if (a.master)
        a.master.gain.setTargetAtTime(muted ? 0 : 0.8, a.ctx.currentTime, 0.05);
}

function noiseSource(a) {
    const s = a.ctx.createBufferSource();
    s.buffer = a.noise;
    s.loop = true;
    return s;
}

function startBeds(a) {
    const ctx = a.ctx;
    // Waves: lowpassed noise breathing slowly.
    const waves = noiseSource(a);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    const wg = ctx.createGain();
    wg.gain.value = 0.18;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain).connect(wg.gain);
    waves.connect(lp).connect(wg).connect(a.amb);
    waves.start();
    lfo.start();
    // The falls: a brighter hiss, louder as you get close.
    const falls = noiseSource(a);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    bp.Q.value = 0.5;
    const fg = ctx.createGain();
    fg.gain.value = 0;
    falls.connect(bp).connect(fg).connect(a.amb);
    falls.start(0, 0.7);
    a.falls = fg;
}

function env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(a, type, freq, t, dur, gain, dest = a.sfx, glideTo = null) {
    const o = a.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = a.ctx.createGain();
    env(g, t, 0.008, gain, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
}

function hiss(a, t, dur, gain, freq = 2000, type = "bandpass", dest = a.sfx) {
    const s = noiseSource(a);
    const f = a.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = a.ctx.createGain();
    env(g, t, 0.005, gain, dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
}

const ok = (a) => a.ctx && !a.muted;

export function play(a, name, opts = {}) {
    if (!ok(a)) return;
    const t = a.ctx.currentTime;
    const pitch = opts.pitch || 1;
    switch (name) {
        case "pickup":
            tone(a, "sine", 520 * pitch, t, 0.12, 0.25, a.sfx, 880 * pitch);
            break;
        case "drop":
            tone(a, "sine", 420 * pitch, t, 0.14, 0.2, a.sfx, 200 * pitch);
            break;
        case "throw":
            tone(a, "triangle", 300, t, 0.3, 0.2, a.sfx, 900);
            hiss(a, t, 0.25, 0.08, 3000);
            break;
        case "bounce":
            tone(a, "sine", 180 * pitch, t, 0.18, 0.3, a.sfx, 90);
            break;
        case "splash":
            hiss(a, t, 0.45, 0.25, 1200, "lowpass");
            tone(a, "sine", 900, t, 0.2, 0.08, a.sfx, 300);
            break;
        case "munch":
            for (let i = 0; i < 3; i++)
                hiss(a, t + i * 0.13, 0.06, 0.22, 900 + Math.random() * 400);
            break;
        case "coo": {
            // A little "pyu?" with a vowel-ish formant.
            const base =
                (opts.adult ? 520 : 760) *
                pitch *
                (0.92 + Math.random() * 0.16);
            const o = a.ctx.createOscillator();
            o.type = "triangle";
            o.frequency.setValueAtTime(base, t);
            o.frequency.exponentialRampToValueAtTime(
                base * (opts.sad ? 0.7 : 1.45),
                t + 0.12
            );
            o.frequency.exponentialRampToValueAtTime(
                base * (opts.sad ? 0.6 : 1.2),
                t + 0.22
            );
            const f = a.ctx.createBiquadFilter();
            f.type = "bandpass";
            f.frequency.value = 1600;
            f.Q.value = 1.2;
            const g = a.ctx.createGain();
            env(g, t, 0.02, 0.22 * (opts.gain || 1), 0.24);
            o.connect(f).connect(g).connect(a.sfx);
            o.start(t);
            o.stop(t + 0.32);
            break;
        }
        case "heart":
            [0, 4, 7, 12].forEach((n, i) =>
                tone(a, "sine", midi(79 + n), t + i * 0.06, 0.35, 0.12)
            );
            break;
        case "levelup":
            [0, 4, 7, 12, 16].forEach((n, i) =>
                tone(a, "square", midi(72 + n), t + i * 0.07, 0.18, 0.06)
            );
            [0, 4, 7, 12, 16].forEach((n, i) =>
                tone(a, "sine", midi(84 + n), t + i * 0.07, 0.3, 0.1)
            );
            break;
        case "crack":
            for (let i = 0; i < 4; i++) hiss(a, t + i * 0.08, 0.04, 0.3, 3500);
            tone(a, "sine", 600, t + 0.35, 0.5, 0.2, a.sfx, 1200);
            break;
        case "evolve":
            for (let i = 0; i < 10; i++)
                tone(a, "sine", midi(64 + i * 2), t + i * 0.09, 0.5, 0.08);
            hiss(a, t, 1.4, 0.06, 6000, "highpass");
            break;
        case "shake":
            for (let i = 0; i < 6; i++)
                hiss(a, t + i * 0.05, 0.08, 0.12, 1800 + i * 200);
            break;
        case "fruitfall":
            tone(a, "sine", 900, t, 0.25, 0.1, a.sfx, 300);
            break;
        case "whistle":
            tone(a, "sine", 1400, t, 0.15, 0.15, a.sfx, 1900);
            tone(a, "sine", 1900, t + 0.18, 0.2, 0.15, a.sfx, 1300);
            break;
        case "cheer":
            for (let i = 0; i < 5; i++)
                hiss(a, t + i * 0.04, 0.4, 0.06, 1200 + Math.random() * 1500);
            tone(a, "triangle", midi(76), t, 0.15, 0.1);
            tone(a, "triangle", midi(83), t + 0.08, 0.2, 0.1);
            break;
        case "beep":
            tone(
                a,
                "square",
                opts.go ? 1046 : 523,
                t,
                opts.go ? 0.5 : 0.18,
                0.1
            );
            break;
        case "bump":
            tone(a, "sine", 140, t, 0.25, 0.5, a.sfx, 60);
            hiss(a, t, 0.12, 0.2, 800, "lowpass");
            if (opts.super)
                [0, 7, 12].forEach((n, i) =>
                    tone(a, "square", midi(76 + n), t + i * 0.04, 0.15, 0.06)
                );
            break;
        case "fanfare":
            [
                [72, 0],
                [76, 0.12],
                [79, 0.24],
                [84, 0.36],
                [79, 0.52],
                [84, 0.64],
            ].forEach(([n, d]) => {
                tone(a, "square", midi(n), t + d, 0.22, 0.07);
                tone(a, "sine", midi(n + 12), t + d, 0.3, 0.08);
            });
            break;
        case "ui":
            tone(a, "sine", 880, t, 0.06, 0.08);
            break;
        case "chirp": {
            const base = 2400 + Math.random() * 1600;
            for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++)
                tone(
                    a,
                    "sine",
                    base,
                    t + i * 0.09,
                    0.07,
                    0.03 * (opts.gain || 1),
                    a.amb,
                    base * 1.4
                );
            break;
        }
        case "cricket":
            for (let i = 0; i < 4; i++)
                tone(
                    a,
                    "square",
                    4200,
                    t + i * 0.05,
                    0.025,
                    0.012 * (opts.gain || 1),
                    a.amb
                );
            break;
    }
}

// Pentatonic marimba: a looping 32-step pattern with a soft bass and pad.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const MELODY = [
    5, -1, 7, -1, 6, 4, -1, 2, 3, -1, 4, 6, -1, 5, -1, -1, 7, -1, 8, 7, 6, -1,
    4, -1, 3, 4, -1, 2, 1, -1, 0, -1,
];
const BASS = [0, 0, 5, 5, 3, 3, 4, 4];
const RACE_MELODY = [5, 7, 8, 7, 5, 7, 9, 7, 6, 5, 4, 5, 6, 8, 7, -1];

function marimba(a, freq, t, gain) {
    tone(a, "sine", freq, t, 0.45, gain, a.music);
    tone(a, "sine", freq * 4, t, 0.08, gain * 0.25, a.music);
}

/** Schedule music a little ahead; call every frame. */
export function updateAudio(
    a,
    { fallsDist = 99, night = false, mode = "garden" } = {}
) {
    if (!a.ctx) return;
    const t = a.ctx.currentTime;
    if (a.falls)
        a.falls.gain.setTargetAtTime(
            Math.max(0, 0.35 - fallsDist * 0.012),
            t,
            0.3
        );
    if (!a.muted) {
        if (!night && Math.random() < 0.006) play(a, "chirp", { gain: 0.8 });
        if (night && Math.random() < 0.05) play(a, "cricket", { gain: 0.7 });
    }
    if (!a.musicOn) return;
    const fast = mode !== "garden";
    const step = fast ? 0.14 : 0.22;
    const root = night ? 57 : 60;
    while (a.next < t + 0.25) {
        const i = a.beat;
        const bar = Math.floor(i / 8) % BASS.length;
        if (fast) {
            const n = RACE_MELODY[i % RACE_MELODY.length];
            if (n >= 0) marimba(a, midi(root + 12 + SCALE[n]), a.next, 0.07);
            if (i % 4 === 0)
                tone(
                    a,
                    "triangle",
                    midi(root - 12 + SCALE[BASS[bar]]),
                    a.next,
                    0.25,
                    0.12,
                    a.music
                );
            if (i % 2 === 1)
                hiss(a, a.next, 0.03, 0.03, 8000, "highpass", a.music);
        } else {
            const n = MELODY[i % MELODY.length];
            if (n >= 0)
                marimba(
                    a,
                    midi(root + 12 + SCALE[n]),
                    a.next,
                    night ? 0.04 : 0.06
                );
            if (i % 8 === 0) {
                tone(
                    a,
                    "triangle",
                    midi(root - 12 + SCALE[BASS[bar]]),
                    a.next,
                    step * 6,
                    0.09,
                    a.music
                );
                tone(
                    a,
                    "sine",
                    midi(root + SCALE[BASS[bar]] + 4),
                    a.next,
                    step * 7,
                    0.025,
                    a.music
                );
            }
        }
        a.next += step;
        a.beat++;
    }
}
