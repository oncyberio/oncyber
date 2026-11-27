// Every sound in Lantern Tag is synthesised here: a quiet night bed that
// plays from the start, and short notes for lanterns lighting, being caught
// and fading, and for a round starting and ending. All of it goes into the
// runtime's one output (docs/games/sound.md): the page owns volume and mute.

/** `audio` is the session's sound output (`context.audio`); it may have no Web Audio. */
export function createSound(audio) {
    const ctx = audio?.context ?? null;
    const out = audio?.output ?? null;
    if (!ctx || !out) {
        const none = () => {};
        return {
            lit: none,
            caught: none,
            faded: none,
            start: none,
            end: none,
            tick: none,
            dispose: none,
        };
    }
    const effects = ctx.createGain();
    effects.gain.value = 0.5;
    effects.connect(out);
    const bed = ctx.createGain();
    bed.gain.value = 0.16;
    bed.connect(out);

    // The bed: slow wind (filtered noise) under a low drone, and crickets
    // (a high tone chopped by a slow square).
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < data.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = (seed / 4294967296) * 2 - 1;
    }
    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    const sway = ctx.createOscillator();
    sway.frequency.value = 0.13;
    const swayDepth = ctx.createGain();
    swayDepth.gain.value = 160;
    sway.connect(swayDepth).connect(windFilter.frequency);
    wind.connect(windFilter).connect(bed);
    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 73.4;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.5;
    drone.connect(droneGain).connect(bed);
    const cricket = ctx.createOscillator();
    cricket.type = "sine";
    cricket.frequency.value = 4100;
    const chop = ctx.createOscillator();
    chop.type = "square";
    chop.frequency.value = 17;
    const cricketGain = ctx.createGain();
    cricketGain.gain.value = 0;
    const chopDepth = ctx.createGain();
    chopDepth.gain.value = 0.035;
    chop.connect(chopDepth).connect(cricketGain.gain);
    cricket.connect(cricketGain).connect(bed);
    const sources = [wind, sway, drone, cricket, chop];
    sources.forEach((s) => s.start());

    /** One struck note: a sine with a soft overtone and a quick decay. */
    function note(
        frequency,
        { at = 0, length = 0.5, level = 0.5, type = "sine" } = {}
    ) {
        if (!audio.audible) return;
        const start = ctx.currentTime + at;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(level, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
        gain.connect(effects);
        for (const [ratio, share] of [
            [1, 1],
            [2.76, 0.28],
        ]) {
            const osc = ctx.createOscillator();
            osc.type = type;
            osc.frequency.value = frequency * ratio;
            const part = ctx.createGain();
            part.gain.value = share;
            osc.connect(part).connect(gain);
            osc.start(start);
            osc.stop(start + length + 0.05);
        }
    }

    return {
        /** A lantern lights somewhere in the yard. */
        lit: () => note(1318.5, { length: 0.35, level: 0.16 }),
        /** The visitor caught one: a rising pair. */
        caught() {
            note(880, { length: 0.45, level: 0.5 });
            note(1318.5, { at: 0.09, length: 0.6, level: 0.42 });
        },
        /** A lantern burned out uncaught. */
        faded: () => note(196, { length: 0.5, level: 0.22, type: "triangle" }),
        start() {
            note(392, { length: 0.9, level: 0.45 });
            note(587.3, { at: 0.18, length: 0.9, level: 0.4 });
        },
        end() {
            [523.3, 659.3, 784, 1046.5].forEach((f, i) =>
                note(f, { at: i * 0.14, length: 0.9, level: 0.4 })
            );
        },
        /** The last seconds of a round. */
        tick: () => note(660, { length: 0.12, level: 0.2, type: "triangle" }),
        dispose() {
            sources.forEach((s) => {
                try {
                    s.stop();
                } catch {
                    /* already stopped */
                }
            });
            effects.disconnect();
            bed.disconnect();
        },
    };
}
