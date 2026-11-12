import type { LobbyMotionInput } from "../locomotion";
export type AvatarMotionSample = {
    id: string;
    x: number;
    y: number;
    z: number;
    rotation: number;
    avatarUrl?: string;
    motion: LobbyMotionInput;
};
export type AvatarMotionFrame = {
    timeMs: number;
    dt: number;
    actors: AvatarMotionSample[];
};
export type CapturedAvatarFrame = Omit<
    AvatarMotionSample,
    "id" | "avatarUrl"
> & { timeMs: number; simulationMs: number; dt: number };
/** At most four seconds/300 display frames, with no React updates or disk writes per frame. */
export class AvatarTraceRecorder {
    private frames: Array<AvatarMotionFrame & { simulationMs: number }> = [];
    record(frame: AvatarMotionFrame, simulationMs: number) {
        this.frames.push({ ...frame, simulationMs });
        while (
            this.frames.length > 300 ||
            (this.frames.length > 1 &&
                frame.timeMs - this.frames[0].timeMs > 4000)
        )
            this.frames.shift();
    }
    capture(id: string): CapturedAvatarFrame[] {
        return this.frames.flatMap((frame) => {
            const actor = frame.actors.find((actor) => actor.id === id);
            return actor
                ? [
                      {
                          timeMs: frame.timeMs,
                          simulationMs: frame.simulationMs,
                          dt: frame.dt,
                          x: actor.x,
                          y: actor.y,
                          z: actor.z,
                          rotation: actor.rotation,
                          motion: { ...actor.motion },
                      },
                  ]
                : [];
        });
    }
}
