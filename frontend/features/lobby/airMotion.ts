import type {
    LobbyClipMetadata,
    LobbyLocomotionPose,
    LobbyMotionInput,
} from "./locomotion";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
    const t = clamp(n);
    return t * t * (3 - 2 * t);
};

/** Authored jump/fall/landing states share the crowd's two-sample budget.
 * Physics owns the arc. A second launch restarts the double-jump once, and a
 * landing interrupts air immediately instead of letting a clip loop on the floor.
 */
export function createAirMotion(clips: Record<string, LobbyClipMetadata>) {
    let airborne = false,
        previousVy = 0,
        count = 0,
        sinceLaunch = 0;
    let name = "",
        time = 0,
        age = 0;
    let fromName = "IDLE",
        fromTime = 0;
    const begin = (next: string, pose: LobbyLocomotionPose) => {
        const old = pose.blend < 0.5 ? pose.primary : pose.secondary;
        fromName = name || old.name;
        fromTime = name
            ? clips[name].loop === false
                ? Math.min(time, clips[name].duration)
                : time % clips[name].duration
            : old.time;
        name = next;
        time = age = 0;
    };
    return (dt: number, input: LobbyMotionInput, pose: LobbyLocomotionPose) => {
        if (!clips.JUMP_IDLE) return false;
        const inAir = input.grounded === false;
        const vy = Number.isFinite(input.verticalVelocity)
            ? input.verticalVelocity
            : 0;
        const speed = Math.max(0, input.speed || 0);
        const band =
            speed < 0.1
                ? "IDLE"
                : speed < 2.4
                ? "WALKING"
                : speed < 4.3
                ? "RUNNING"
                : "SPRINTING";
        if (inAir) sinceLaunch += dt;
        const knownJumpCount = Number.isFinite(input.jumpCount);
        const secondLaunch =
            inAir &&
            airborne &&
            count < 2 &&
            (knownJumpCount
                ? input.jumpCount > count
                : sinceLaunch > 0.1 && vy > 1 && vy - previousVy > 2);
        if (inAir && (!airborne || secondLaunch)) {
            count = knownJumpCount
                ? Math.max(0, Math.min(2, input.jumpCount))
                : secondLaunch
                ? 2
                : 1;
            const next =
                !airborne && vy < -0.1 && clips.FALLING
                    ? "FALLING"
                    : count === 2 && clips.JUMP_DOUBLE
                    ? "JUMP_DOUBLE"
                    : `JUMP_${band}`;
            begin(clips[next] ? next : "JUMP_IDLE", pose);
            sinceLaunch = 0;
        } else if (!inAir && airborne) {
            // Native worlds may author a faster single jump than the lobby.
            // Its impact speed alone must not turn a first jump into a roll.
            const roll = band !== "IDLE" && previousVy < -7 && count >= 2;
            const next = `DROP_${band}${roll ? "_ROLL" : ""}`;
            begin(clips[next] ? next : "DROP_IDLE", pose);
            count = 0;
        }
        airborne = inAir;
        previousVy = vy;
        if (!name || !clips[name]) {
            name = "";
            return false;
        }
        time += dt;
        age += dt;
        const clip = clips[name];
        if (
            name.startsWith("JUMP_") &&
            time >= clip.duration &&
            inAir &&
            clips.FALLING
        ) {
            begin("FALLING", pose);
        } else if (name.startsWith("DROP_") && time >= clip.duration) {
            name = "";
            return false;
        }
        const active = clips[name];
        const sampleTime =
            active.loop === false
                ? Math.min(time, active.duration)
                : time % active.duration;
        const exit = name.startsWith("DROP_")
            ? smooth((time - (active.duration - 0.12)) / 0.12)
            : 0;
        if (exit > 0) {
            const ground = pose.blend < 0.5 ? pose.primary : pose.secondary;
            pose.secondary.name = ground.name;
            pose.secondary.time = ground.time;
            pose.primary.name = name;
            pose.primary.time = sampleTime;
            pose.blend = exit;
        } else {
            pose.primary.name = fromName;
            pose.primary.time = fromTime;
            pose.secondary.name = name;
            pose.secondary.time = sampleTime;
            pose.blend = smooth(age / 0.08);
        }
        pose.strideScale = 1;
        return true;
    };
}
