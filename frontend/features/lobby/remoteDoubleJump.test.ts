import { LobbyMotionStore } from "./LobbyMotionStore";
import type { LobbyPlayer } from "./LobbyConnection";
import {
    STEP,
    state as initialState,
    step,
} from "../../../multiplayer/protocol/movement";

const peer: LobbyPlayer = {
    id: "peer",
    name: "peer",
    avatar: "",
    isLocal: false,
    vrmUrl: "",
    scale: 1,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    animation: -1,
    floor: true,
};

/** Runs the server's own physics, ships snapshots at `cadenceMs`, and
 * returns the highest jump count the remote view ever presents. */
function presentedJumps(presses: number[], cadenceMs: number) {
    const store = new LobbyMotionStore();
    store.upsert({ ...peer });
    store.observeClock(0, 0, 0);
    const s: any = initialState({ x: 0, y: 0, z: 0, rotation: 0 });
    const stepMs = STEP * 1000;
    let seq = 0,
        highest = 0,
        nextSnapshot = 0;
    const seen: number[] = [];
    for (let t = 0; t <= 2000; t += stepMs) {
        const jump = presses.some((p) => t >= p && t < p + 50);
        step(s, {
            strafe: 0,
            forward: 0,
            yaw: 0,
            running: false,
            jump,
            animation: -1,
        });
        if (t >= nextSnapshot) {
            nextSnapshot += cadenceMs;
            store.pushChunk(
                ++seq,
                t,
                [
                    [
                        "peer",
                        seq,
                        {
                            x: s.x,
                            y: s.y,
                            z: s.z,
                            rotation: 0,
                            animation: -1,
                            floor: s.y <= 0,
                            vx: s.vx,
                            vy: s.vy,
                            vz: s.vz,
                        },
                    ],
                ],
                t
            );
        }
        const sampled = store.sample(t)[0];
        if (sampled) {
            highest = Math.max(highest, sampled.jumpCount ?? 0);
            seen.push(sampled.jumpCount ?? -1);
        }
    }
    return { highest, last: seen.at(-1) };
}

describe("remote double jump", () => {
    test.each([50, 100, 200])(
        "a second press in the air reaches the double-jump clip at %ims",
        (cadence) => {
            expect(presentedJumps([0, 300], cadence)).toEqual({
                highest: 2,
                last: 0,
            });
        }
    );
    test.each([50, 100, 200])(
        "a single jump never shows as a double at %ims",
        (cadence) => {
            expect(presentedJumps([0], cadence)).toEqual({
                highest: 1,
                last: 0,
            });
        }
    );
    test("two separate single jumps stay single", () => {
        expect(presentedJumps([0, 1000], 50).highest).toBe(1);
    });
});
