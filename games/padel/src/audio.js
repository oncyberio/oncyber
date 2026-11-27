const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const MAX_VOICES = 24;
const BUS_GAIN = 0.42;
const AMBIENCE_GAIN = 0.012;

/**
 * Dry, layered padel Foley, routed through the SDK's one sound output
 * (docs/games/sound.md). `sdk` is the session's `context.audio`: its
 * `context` is the one AudioContext and everything here connects to its
 * `output`. The page owns volume, mute, the first gesture and silence while
 * the game is suspended, so this file keeps no mute, creates no context and
 * never suspends or closes one. Every voice disconnects when it ends. The
 * only continuous sound is a very quiet open-air bed.
 */
export function createAudio(sdk) {
  const ctx = sdk?.context ?? null;
  const out = sdk?.output ?? null;
  let bus, limiter, noiseBuffer, ambience;
  let disposed = false;
  let lastStep = -Infinity,
    lastWall = -Infinity,
    lastBounce = -Infinity;
  const voices = new Set();
  let seed = 5189;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (ctx && out) {
    bus = ctx.createGain();
    bus.gain.value = BUS_GAIN;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 8;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    bus.connect(limiter);
    limiter.connect(out);
    noiseBuffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * 0.6),
      ctx.sampleRate
    );
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = random() * 2 - 1;
    // The club's open air: looped noise under a low filter, well below the
    // Foley. It is scheduled once and is silent until the page starts sound.
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      amp = ctx.createGain();
    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.3;
    amp.gain.value = AMBIENCE_GAIN;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(out);
    source.start();
    ambience = { source, nodes: [source, filter, amp] };
  }
  // Scheduling is skipped while nothing would be heard (muted, suspended or
  // before the first gesture); `audible` is absent on a bare test double.
  const ready = () =>
    !disposed && !!bus && ctx.state === "running" && sdk.audible !== false;

  function removeVoice(voice) {
    if (!voices.delete(voice)) return;
    for (const node of voice.nodes) node.disconnect();
  }
  function stopVoice(voice) {
    try {
      voice.source.stop();
    } catch {
      /* A completed source is already silent. */
    }
    removeVoice(voice);
  }
  function clearVoices() {
    for (const voice of [...voices]) stopVoice(voice);
  }
  function register(source, nodes) {
    while (voices.size >= MAX_VOICES) stopVoice(voices.values().next().value);
    const voice = { source, nodes: [source, ...nodes] };
    voices.add(voice);
    source.onended = () => removeVoice(voice);
    return voice;
  }
  function envelope(amp, time, gain, length, attack = 0.002) {
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, gain),
      time + attack
    );
    amp.gain.exponentialRampToValueAtTime(0.0001, time + length);
  }
  function tone(start, end, length, gain, type = "sine", delay = 0) {
    if (!ready()) return;
    const source = ctx.createOscillator(),
      amp = ctx.createGain();
    const time = ctx.currentTime + delay;
    source.type = type;
    source.frequency.setValueAtTime(start, time);
    source.frequency.exponentialRampToValueAtTime(end, time + length);
    envelope(amp, time, gain, length);
    source.connect(amp);
    amp.connect(bus);
    register(source, [amp]);
    source.start(time);
    source.stop(time + length + 0.012);
  }
  function noise(
    length,
    gain,
    frequency,
    q = 0.7,
    delay = 0,
    type = "bandpass"
  ) {
    if (!ready()) return;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      amp = ctx.createGain();
    const time = ctx.currentTime + delay;
    source.buffer = noiseBuffer;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, time);
    filter.Q.value = q;
    envelope(amp, time, gain, length, 0.0015);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(bus);
    register(source, [filter, amp]);
    source.start(time, random() * Math.max(0, 0.58 - length));
    source.stop(time + length + 0.008);
  }
  function hit(power = 0.5) {
    if (!ready()) return;
    const force = clamp(power),
      variation = 0.95 + random() * 0.1;
    // A hollow foam/carbon paddle body, a crisp contact and a tiny room return.
    tone((290 + force * 110) * variation, 105, 0.105, 0.28 + force * 0.1);
    tone(720 * variation, 360, 0.045, 0.08 + force * 0.04, "triangle");
    noise(0.045, 0.3 + force * 0.22, 1800 + force * 1200, 0.75);
    noise(0.075, 0.045 + force * 0.035, 1350, 0.5, 0.038);
  }
  function bounce(power = 0.5) {
    const force = clamp(power);
    if (force === 0 || !ready() || ctx.currentTime - lastBounce < 0.035) return;
    lastBounce = ctx.currentTime;
    // Preserve the normal rally impact at .5, while the last tiny dead-ball
    // hops lose body and surface noise together instead of repeating a loud tap.
    const loudness = Math.min(1, force * 2) ** 1.35;
    tone(190 + force * 30, 74, 0.072, (0.17 + force * 0.07) * loudness);
    noise(0.035, (0.13 + force * 0.04) * loudness, 1050, 0.65);
  }
  function wall(surface = "glass", power = 0.5) {
    if (!ready() || ctx.currentTime - lastWall < 0.025) return;
    lastWall = ctx.currentTime;
    const force = clamp(power);
    if (surface === "fence" || surface === "mesh") {
      // Short metal rattle, filtered so it stays behind the impact sound.
      noise(0.15, 0.2 + force * 0.1, 2300, 1.7);
      tone(640, 470, 0.095, 0.09, "triangle");
      noise(0.045, 0.09, 3300, 2.4, 0.035);
      noise(0.035, 0.05, 2700, 2.2, 0.085);
    } else {
      tone(330 + force * 45, 145, 0.11, 0.22);
      noise(0.038, 0.25 + force * 0.09, 2300, 0.65);
      tone(1680, 1620, 0.12, 0.045);
      tone(2450, 2380, 0.07, 0.024);
    }
  }
  return {
    /** Active one-shot voices, for diagnostics and tests. */
    get voices() {
      return voices.size;
    },
    hit,
    smash(power = 1) {
      hit(power);
      // A short, low body and air snap distinguish a clean overhead without
      // adding a sustained sound or bypassing the shared voice limit.
      tone(160, 65, 0.13, 0.09 * clamp(power));
      noise(0.08, 0.1 * clamp(power), 3400, 0.5);
    },
    bounce,
    wall,
    serve() {
      hit(0.38);
    },
    step(speed = 0.5) {
      if (!ready()) return;
      const force = clamp(speed);
      if (ctx.currentTime - lastStep < 0.32 - force * 0.13) return;
      lastStep = ctx.currentTime;
      noise(0.06, 0.055 + force * 0.04, 580, 0.6, 0, "lowpass");
      if (force > 0.55 && random() > 0.44) {
        tone(1150 + random() * 350, 1750, 0.052, 0.021, "sine", 0.012);
        noise(0.045, 0.02, 1900, 4, 0.01);
      }
    },
    net() {
      noise(0.12, 0.15, 900, 0.6);
      tone(125, 80, 0.085, 0.06);
    },
    fault() {
      tone(230, 180, 0.15, 0.065, "triangle");
      noise(0.07, 0.025, 800, 0.5);
    },
    point(won = true) {
      const base = won === false ? 392 : 523.25;
      tone(base, base, 0.17, 0.09);
      tone(base * 1.25, base * 1.25, 0.19, 0.07, "sine", 0.085);
      tone(base * 1.5, base * 1.5, 0.25, 0.075, "sine", 0.17);
    },
    /** The game was suspended or left a match: drop what is still ringing. */
    quiet: clearVoices,
    dispose() {
      if (disposed) return;
      disposed = true;
      clearVoices();
      if (ambience) {
        try {
          ambience.source.stop();
        } catch {
          /* never started */
        }
        for (const node of ambience.nodes) node.disconnect();
      }
      bus?.disconnect();
      limiter?.disconnect();
      noiseBuffer = undefined;
    },
  };
}
