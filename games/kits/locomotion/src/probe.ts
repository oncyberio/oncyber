// What `pnpm games:check` reads to measure a walk. A game that declares
// `"locomotion": "lobby"` in game.json exposes its walker here; the check
// holds forward for two seconds and compares the ground covered with the
// lobby's. Only present when the page is opened with ?check.
import type { Walker } from "./motion.ts";

export interface LocomotionProbe {
    /** Put the game where the visitor can walk, with clear ground ahead. */
    begin?(): void;
    /** The walker being driven right now, or null. */
    read(): {
        x: number;
        z: number;
        time: number;
        scale: number;
        floor: boolean;
        rest: { x: number; z: number; time: number };
    } | null;
}

export function exposeLocomotionProbe(
    walker: () => Walker | null | undefined,
    begin?: () => void
) {
    const scope = globalThis as any;
    if (!/[?&]check\b/.test(String(scope.location?.search ?? ""))) return;
    const probe: LocomotionProbe = {
        begin,
        read() {
            const w = walker();
            return w
                ? {
                      x: w.state.x,
                      z: w.state.z,
                      time: w.state.time,
                      scale: w.scale,
                      floor: w.state.floor,
                      rest: { ...w.rest },
                  }
                : null;
        },
    };
    scope.__oncyberLocomotion = probe;
}
