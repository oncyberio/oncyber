/** @jest-environment jsdom */
import fs from "fs";
import { TextDecoder } from "util";
import path from "path";
import * as THREE from "three";
import { prepareNativeLobbyClips, LOBBY_CLIP_PREFIX } from "./lobbyMotionClips";
import { loadDefaultMotion } from "@features/lobby/optionalMotionPack";
import { sanitizeLobbyAnimation } from "@features/lobby/locomotion";
import retarget from "./baker/loadmixamoanimation";
import rigMap from "./baker/rigmap";
import baseRig from "./baker/baserig.json";
const bytes = (url: string) =>
    Uint8Array.from(
        fs.readFileSync(
            path.join(
                process.cwd(),
                "public",
                new URL(url, "http://localhost").pathname
            )
        )
    ).buffer;
const fetchAsset = async (url: string) => bytes(url);
function avatar() {
    const scene = new THREE.ObjectLoader().parse(baseRig);
    scene.scale.setScalar(0.01);
    const lookup = Object.fromEntries(
        Object.entries(rigMap).map(([source, bone]) => [
            bone,
            scene.getObjectByName(source),
        ])
    );
    return {
        scene,
        humanoid: { getNormalizedBoneNode: (name: string) => lookup[name] },
        meta: { metaVersion: "1" },
    };
}
beforeAll(() => {
    global.TextDecoder = TextDecoder as any;
    global.fetch = jest.fn(async (url: string) => ({
        ok: true,
        arrayBuffer: async () => bytes(url),
    })) as any;
});

test("native defaults use the same retargeted lobby clips and keep derived stops/turns separate", async () => {
    const vrm = avatar();
    const before = vrm.scene.scale.clone();
    const native = await prepareNativeLobbyClips(vrm);
    expect(native).toBeDefined();
    expect(vrm.scene.scale.equals(before)).toBe(true);
    expect(vrm.scene.parent).toBeNull();
    const raw = await loadDefaultMotion(fetchAsset);
    for (const name of [
        "IDLE",
        "WALK",
        "RUN",
        "SPRINT",
        "JUMP_RUNNING",
        "FALLING",
        "DROP_RUNNING",
    ]) {
        const source = retarget(
            vrm.scene,
            vrm,
            sanitizeLobbyAnimation(raw[name], name)
        );
        const converted = native.clips.find(
            (c) => c.name === LOBBY_CLIP_PREFIX + name
        );
        expect(converted.duration).toBe(source.duration);
        expect(
            converted.tracks.map((t) => THREE.KeyframeTrack.toJSON(t))
        ).toEqual(source.tracks.map((t) => THREE.KeyframeTrack.toJSON(t)));
    }
    expect(
        native.clips.every((c) => c.name.startsWith(LOBBY_CLIP_PREFIX))
    ).toBe(true);
    for (const name of ["STOP_L", "STOP_R", "TURN_WALK_L", "CUT_R180_R"])
        expect(native.metadata[name]).toBeDefined();
    expect(native.metadata.JUMP_RUNNING.loop).toBe(false);
    expect(native.metadata.WALK.contacts).toBeDefined();
    expect(await prepareNativeLobbyClips(vrm)).toBe(native);
    expect(global.fetch).toHaveBeenCalledTimes(2);
}, 15000);
