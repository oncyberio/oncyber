// Everything is synthesized with Web Audio: no sample files to load or license.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function createAudio() {
    const a = {
        ctx: null,
        muted: false,
        musicOn: true,
        master: null,
        sfx: null,
        music: null,
        crowd: null,
        noise: null,
        chargeVoice: null,
        seq: null,
        musicMode: "off",
    };
    return a;
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
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    a.master = ctx.createGain();
    a.master.gain.value = a.muted ? 0 : 0.85;
    a.master.connect(comp);
    a.sfx = ctx.createGain();
    a.sfx.gain.value = 1;
    a.sfx.connect(a.master);
    a.music = ctx.createGain();
    a.music.gain.value = 0.0;
    a.music.connect(a.master);
    a.crowd = ctx.createGain();
    a.crowd.gain.value = 0.0;
    a.crowd.connect(a.master);
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    a.noise = buf;
    startCrowdBed(a);
    if (a.musicMode !== "off") startMusic(a, a.musicMode);
}

export function setMuted(a, muted) {
    a.muted = muted;
    if (a.master)
        a.master.gain.setTargetAtTime(
            muted ? 0 : 0.85,
            a.ctx.currentTime,
            0.05
        );
}

function env(g, t, attack, peak, decay, sustain = 0.0001) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, sustain),
        t + attack + decay
    );
}

function osc(a, type, freq, t, dur, gain, dest = a.sfx, glideTo = null) {
    const o = a.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = a.ctx.createGain();
    env(g, t, 0.004, gain, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
}

function noise(
    a,
    t,
    dur,
    gain,
    filterType,
    freq,
    q = 1,
    dest = a.sfx,
    sweepTo = null
) {
    const src = a.ctx.createBufferSource();
    src.buffer = a.noise;
    src.loop = true;
    const f = a.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = a.ctx.createGain();
    env(g, t, 0.003, gain, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    return src;
}

const ready = (a) => a.ctx && a.ctx.state === "running";

export function sfxHit(a, power = 0.5, gradeName = "nice", shot = "topspin") {
    if (!ready(a)) return;
    const t = a.ctx.currentTime;
    const p = 0.6 + power * 0.6;
    osc(a, "sine", 190 + power * 60, t, 0.09, 0.7 * p, a.sfx, 55);
    noise(a, t, 0.035, 0.55 * p, "bandpass", 2600 + power * 1400, 1.4);
    osc(a, "triangle", shot === "slice" || shot === "drop" ? 520 : 760, t, 0.05, 0.18, a.sfx, 380);
    if (gradeName === "perfect") {
        // Sparkly chime on top of the thwack.
        [84, 88, 91, 96].forEach((n, i) =>
            osc(a, "square", midi(n), t + 0.03 + i * 0.045, 0.16, 0.07)
        );
        noise(a, t, 0.32, 0.22, "highpass", 3000, 0.7, a.sfx, 9000);
    } else if (gradeName === "great") {
        [86, 91].forEach((n, i) =>
            osc(a, "square", midi(n), t + 0.03 + i * 0.05, 0.1, 0.05)
        );
    }
}

export function sfxSwoosh(a, strength = 0.6) {
    if (!ready(a)) return;
    noise(
        a,
        a.ctx.currentTime,
        0.22,
        0.25 * strength,
        "bandpass",
        500,
        0.9,
        a.sfx,
        2400
    );
}

export function sfxBounce(a, speed = 10) {
    if (!ready(a)) return;
    const t = a.ctx.currentTime;
    const k = Math.min(1, speed / 25);
    osc(a, "sine", 260, t, 0.07, 0.25 + k * 0.4, a.sfx, 110);
    noise(a, t, 0.02, 0.18 + k * 0.2, "bandpass", 1800, 1.2);
}

export function sfxNet(a) {
    if (!ready(a)) return;
    const t = a.ctx.currentTime;
    noise(a, t, 0.25, 0.5, "lowpass", 600, 0.8);
    osc(a, "sine", 120, t, 0.15, 0.4, a.sfx, 60);
}

export function sfxToss(a) {
    if (!ready(a)) return;
    osc(a, "sine", 520, a.ctx.currentTime, 0.12, 0.12, a.sfx, 820);
}

export function sfxUI(a, kind = "move") {
    if (!ready(a)) return;
    const t = a.ctx.currentTime;
    if (kind === "move") osc(a, "square", midi(84), t, 0.05, 0.06);
    else if (kind === "ok") {
        osc(a, "square", midi(84), t, 0.07, 0.08);
        osc(a, "square", midi(91), t + 0.07, 0.12, 0.08);
    } else if (kind === "back") {
        osc(a, "square", midi(79), t, 0.07, 0.07);
        osc(a, "square", midi(72), t + 0.06, 0.1, 0.07);
    } else if (kind === "pop") osc(a, "sine", 660, t, 0.1, 0.25, a.sfx, 1320);
    else if (kind === "stamp") {
        osc(a, "sine", 140, t, 0.18, 0.6, a.sfx, 50);
        noise(a, t, 0.08, 0.35, "lowpass", 1400, 0.8);
    }
}

export function sfxCall(a, kind) {
    if (!ready(a)) return;
    const t = a.ctx.currentTime;
    if (kind === "out" || kind === "fault") {
        osc(a, "square", midi(76), t, 0.14, 0.09);
        osc(a, "square", midi(70), t + 0.13, 0.22, 0.09);
    } else if (kind === "point") {
        [72, 76, 79, 84].forEach((n, i) =>
            osc(a, "square", midi(n), t + i * 0.07, 0.14, 0.07)
        );
        [60, 64].forEach((n, i) =>
            osc(a, "triangle", midi(n), t + i * 0.14, 0.2, 0.2)
        );
    } else if (kind === "lost") {
        [71, 67, 64].forEach((n, i) =>
            osc(a, "triangle", midi(n), t + i * 0.12, 0.2, 0.18)
        );
    } else if (kind === "game") {
        const seq = [72, 76, 79, 84, 79, 84, 88];
        seq.forEach((n, i) =>
            osc(
                a,
                "square",
                midi(n),
                t + i * 0.09,
                i === seq.length - 1 ? 0.5 : 0.12,
                0.08
            )
        );
        [48, 55, 60].forEach((n, i) =>
            osc(a, "triangle", midi(n), t + i * 0.18, 0.3, 0.25)
        );
    } else if (kind === "win") {
        const seq = [72, 72, 72, 76, 79, 76, 79, 84];
        const len = [0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.8];
        let at = t;
        seq.forEach((n, i) => {
            osc(a, "square", midi(n), at, len[i], 0.09);
            osc(a, "square", midi(n - 12), at, len[i], 0.04);
            at += len[i] + 0.02;
        });
        [48, 53, 55, 60].forEach((n, i) =>
            osc(a, "triangle", midi(n), t + i * 0.3, 0.5, 0.25)
        );
    } else if (kind === "lose") {
        [67, 66, 65, 64].forEach((n, i) =>
            osc(a, "triangle", midi(n), t + i * 0.25, 0.35, 0.18)
        );
    } else if (kind === "ready") {
        osc(a, "square", midi(79), t, 0.1, 0.08);
    } else if (kind === "go") {
        osc(a, "square", midi(91), t, 0.3, 0.09);
        osc(a, "square", midi(84), t, 0.3, 0.06);
    }
}

// --------------------------------------------------------------- crowd

function startCrowdBed(a) {
    const ctx = a.ctx;
    const src = ctx.createBufferSource();
    src.buffer = a.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 700;
    f.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(f).connect(g).connect(a.crowd);
    src.start();
    a.crowdBed = g;
}

export function setCrowd(a, level) {
    if (!a.ctx) return;
    a.crowd.gain.setTargetAtTime(level, a.ctx.currentTime, 0.4);
}

export function sfxCheer(a, size = 1) {
    if (!ready(a)) return;
    const t = a.ctx.currentTime;
    const dur = 1.2 + size * 1.2;
    // Roar: a broadband swell.
    const src = a.ctx.createBufferSource();
    src.buffer = a.noise;
    src.loop = true;
    const f = a.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1100;
    f.Q.value = 0.5;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * size, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.1);
    // Applause: lots of tiny claps.
    const claps = Math.round(40 * size + 20);
    for (let i = 0; i < claps; i++) {
        const at = t + Math.random() * dur * 0.9;
        noise(
            a,
            at,
            0.025,
            0.08 + Math.random() * 0.08,
            "bandpass",
            1400 + Math.random() * 1800,
            2
        );
    }
    // A couple of whistles.
    if (size > 0.8) {
        for (let i = 0; i < 2; i++) {
            const at = t + 0.2 + Math.random() * 0.6;
            osc(
                a,
                "sine",
                1900 + Math.random() * 400,
                at,
                0.35,
                0.05,
                a.sfx,
                2600
            );
        }
    }
}

export function sfxOoh(a) {
    if (!ready(a)) return;
    const t = a.ctx.currentTime;
    const src = a.ctx.createBufferSource();
    src.buffer = a.noise;
    src.loop = true;
    const f = a.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 3;
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(380, t + 1.0);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    src.connect(f).connect(g).connect(a.sfx);
    src.start(t, Math.random());
    src.stop(t + 1.2);
}

// --------------------------------------------------------------- charge

export function chargeStart(a, shot) {
    if (!ready(a) || a.chargeVoice) return;
    const ctx = a.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const base =
        shot === "lob"
            ? 330
            : shot === "slice"
            ? 260
            : shot === "drop"
            ? 230
            : shot === "topspin"
            ? 320
            : 300;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 2.6, t + 0.9);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.9);
    const trem = ctx.createOscillator();
    trem.frequency.value = 18;
    const tremGain = ctx.createGain();
    tremGain.gain.value = 0.025;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
    trem.connect(tremGain).connect(g.gain);
    o.connect(f).connect(g).connect(a.sfx);
    o.start(t);
    trem.start(t);
    a.chargeVoice = { o, g, trem, fullAt: t + 0.9, dinged: false };
}

export function chargeTick(a, charge) {
    const v = a.chargeVoice;
    if (!v || !ready(a)) return;
    if (charge >= 1 && !v.dinged) {
        v.dinged = true;
        osc(a, "square", midi(96), a.ctx.currentTime, 0.14, 0.06);
    }
}

export function chargeStop(a) {
    const v = a.chargeVoice;
    if (!v || !a.ctx) return;
    const t = a.ctx.currentTime;
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setTargetAtTime(0.0001, t, 0.02);
    v.o.stop(t + 0.15);
    v.trem.stop(t + 0.15);
    a.chargeVoice = null;
}

// --------------------------------------------------------------- music

const BPM = 138;
const CHORDS = [
    [48, 52, 55, 60], // C
    [45, 52, 57, 60], // Am
    [41, 48, 53, 57], // F
    [43, 50, 55, 59], // G
    [48, 52, 55, 64], // C
    [45, 52, 57, 64], // Am
    [38, 50, 53, 57], // Dm
    [43, 50, 55, 62], // G
];
// 8 eighth-notes per bar; 0 = rest, -1 = hold.
const MELODY = [
    [76, 79, 84, -1, 79, -1, 76, 79],
    [81, -1, 76, -1, 72, 76, 81, -1],
    [77, 81, 84, -1, 81, 77, 81, 84],
    [86, -1, 83, -1, 79, -1, -1, 0],
    [76, 79, 84, 88, 86, 84, 79, 76],
    [81, 84, 88, -1, 86, 84, 81, -1],
    [77, -1, 81, 86, -1, 84, 81, 77],
    [79, 81, 83, 86, -1, 83, 79, 0],
];

export function startMusic(a, mode = "title") {
    a.musicMode = mode;
    if (!a.ctx) return;
    const target =
        mode === "off"
            ? 0
            : mode === "match"
            ? 0.0
            : mode === "soft"
            ? 0.18
            : 0.32;
    a.music.gain.setTargetAtTime(
        a.musicOn ? target : 0,
        a.ctx.currentTime,
        0.3
    );
    if (mode === "off" || a.seq) return;
    const ctx = a.ctx;
    const eighth = 60 / BPM / 2;
    const seq = { step: 0, next: ctx.currentTime + 0.1, timer: 0 };
    const schedule = () => {
        while (seq.next < ctx.currentTime + 0.2) {
            const bar = Math.floor(seq.step / 8) % 8;
            const beat = seq.step % 8;
            const t = seq.next;
            const chord = CHORDS[bar];
            if (a.musicMode === "match" || a.musicMode === "off" || a.muted) {
                seq.step += 1;
                seq.next += eighth;
                continue;
            }
            // Bass: root on beats, octave on offbeats.
            if (beat % 2 === 0)
                osc(
                    a,
                    "triangle",
                    midi(chord[0] - 12 + (beat === 4 ? 7 : 0)),
                    t,
                    eighth * 1.6,
                    0.34,
                    a.music
                );
            else
                osc(
                    a,
                    "triangle",
                    midi(chord[0]),
                    t,
                    eighth * 0.7,
                    0.18,
                    a.music
                );
            // Offbeat chord stabs.
            if (beat % 2 === 1)
                for (const n of chord.slice(1))
                    osc(
                        a,
                        "square",
                        midi(n + 12),
                        t,
                        eighth * 0.55,
                        0.022,
                        a.music
                    );
            // Lead.
            const note = MELODY[bar][beat];
            if (note > 0) {
                let len = 1;
                while (beat + len < 8 && MELODY[bar][beat + len] === -1) len++;
                osc(
                    a,
                    "square",
                    midi(note),
                    t,
                    eighth * len * 0.92,
                    0.055,
                    a.music
                );
                osc(
                    a,
                    "triangle",
                    midi(note + 12),
                    t,
                    eighth * len * 0.6,
                    0.03,
                    a.music
                );
            }
            // Drums.
            if (beat === 0 || beat === 4)
                osc(a, "sine", 150, t, 0.12, 0.5, a.music, 45);
            if (beat === 2 || beat === 6)
                noise(a, t, 0.12, 0.2, "bandpass", 1800, 0.7, a.music);
            noise(
                a,
                t,
                0.03,
                beat % 2 ? 0.06 : 0.035,
                "highpass",
                7000,
                0.7,
                a.music
            );
            seq.step += 1;
            seq.next += eighth;
        }
    };
    seq.timer = setInterval(schedule, 40);
    schedule();
    a.seq = seq;
}

export function stopAudio(a) {
    if (a.seq) clearInterval(a.seq.timer);
    a.seq = null;
    chargeStop(a);
    if (a.ctx) a.ctx.close();
    a.ctx = null;
}
