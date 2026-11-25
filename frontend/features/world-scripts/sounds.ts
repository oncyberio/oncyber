/**
 * The few sounds a world script can play, made on the spot with Web Audio,
 * so a script never makes the page fetch anything.
 */
import type { SoundName } from "./protocol";

type Note = { f: number; t: number; d: number; type?: OscillatorType };

const SOUNDS: Record<SoundName, Note[]> = {
    coin: [
        { f: 988, t: 0, d: 0.08, type: "square" },
        { f: 1319, t: 0.08, d: 0.22, type: "square" },
    ],
    click: [{ f: 1200, t: 0, d: 0.04, type: "triangle" }],
    jump: [{ f: 330, t: 0, d: 0.18, type: "square" }],
    hit: [{ f: 110, t: 0, d: 0.16, type: "sawtooth" }],
    beep: [{ f: 880, t: 0, d: 0.12, type: "sine" }],
    win: [
        { f: 523, t: 0, d: 0.12 },
        { f: 659, t: 0.12, d: 0.12 },
        { f: 784, t: 0.24, d: 0.12 },
        { f: 1047, t: 0.36, d: 0.35 },
    ],
    lose: [
        { f: 392, t: 0, d: 0.18 },
        { f: 330, t: 0.18, d: 0.18 },
        { f: 262, t: 0.36, d: 0.4 },
    ],
};

let context: AudioContext | null = null;
let lastAt = 0;

export function playSound(name: SoundName, volume = 0.6) {
    const notes = SOUNDS[name];
    if (!notes || typeof window === "undefined") return;
    // At most one sound every 40 ms, so a script can't make a wall of noise.
    const now = performance.now();
    if (now - lastAt < 40) return;
    lastAt = now;
    try {
        const Audio = window.AudioContext || (window as any).webkitAudioContext;
        if (!Audio) return;
        context = context || new Audio();
        if (context.state === "suspended") void context.resume();
        const start = context.currentTime;
        for (const note of notes) {
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.type = note.type || "triangle";
            osc.frequency.value = note.f;
            const peak = 0.18 * Math.max(0, Math.min(1, volume));
            gain.gain.setValueAtTime(0, start + note.t);
            gain.gain.linearRampToValueAtTime(peak, start + note.t + 0.01);
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                start + note.t + note.d
            );
            osc.connect(gain).connect(context.destination);
            osc.start(start + note.t);
            osc.stop(start + note.t + note.d + 0.02);
        }
    } catch {
        /* no audio here */
    }
}
