import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import * as THREE from "three";
import { decodeCC0LocomotionPack } from "@features/lobby/cc0LocomotionPack";
import { sanitizeLobbyAnimation } from "@features/lobby/locomotion";
import { EMOTES, IDLE_CC0, POSSIBLE_ACTIONS } from "../constants";
import readyIdle, { READY_IDLE_DURATION } from "./readyIdle";
import generated from "./animations/ready-idle.json";
import animations from "./animations/compute2.json";
import loadMixamoAnimation from "./loadmixamoanimation";
import AbstractBaker from "./abstract";
import rigMap from "./rigmap";

jest.mock(
    "@3utils/packer.js",
    () =>
        class {
            init() {}
        },
    { virtual: true }
);

function sourceClip() {
    const bytes = fs.readFileSync(
        path.join(process.cwd(), "public", generated.provenance.source)
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        generated.provenance.sha256
    );
    return decodeCC0LocomotionPack(bytes).clips.IDLE_CC0;
}

function avatar() {
    const scene = new THREE.Group();
    const nodes = new Map<string, THREE.Bone>();
    for (const name of Object.values(rigMap) as string[]) {
        if (nodes.has(name)) continue;
        const node = new THREE.Bone();
        node.name = `normalized_${name}`;
        nodes.set(name, node);
        scene.add(node);
    }
    nodes.get("hips").position.y = 1;
    scene.add(new THREE.SkinnedMesh());
    return {
        scene,
        meta: { metaVersion: "1" },
        humanoid: { getNormalizedBoneNode: (name: string) => nodes.get(name) },
    };
}

test("native ready idle exactly matches the decoded, pinned lobby clip", () => {
    const { uuid, ...source } = sourceClip();
    expect(readyIdle).toEqual({ ...source, name: "idle_cc0" });
    expect(READY_IDLE_DURATION).toBe(source.duration);
    expect(IDLE_CC0).toEqual({
        name: "IDLE_CC0",
        duration: source.duration,
        loop: true,
    });
    expect(Math.floor(READY_IDLE_DURATION * 30)).toBe(75);
});

test("both native baker paths append ready idle without changing existing action indices", () => {
    const baker = new AbstractBaker();
    baker.setAnimationJson(animations);
    const clips = baker.prepareAnimations(avatar());
    const previousNames = POSSIBLE_ACTIONS.filter(
        (action) => action !== IDLE_CC0
    )
        .filter((action) =>
            animations.some((clip) => clip.name === action.name.toLowerCase())
        )
        .map((action) => action.name);
    expect(POSSIBLE_ACTIONS.at(-1)).toBe(IDLE_CC0);
    expect(POSSIBLE_ACTIONS.slice(5, -1)).toEqual(EMOTES);
    expect(clips.map((clip) => clip.name)).toEqual([
        ...previousNames,
        "IDLE_CC0",
    ]);
    expect(clips.at(-1).loop).toBe(true);
    // Worker init and the synchronous/high-quality baker share this method.
    baker.setAnimationJson([...animations, readyIdle]);
    expect(
        baker
            .prepareAnimations(avatar())
            .filter((clip) => clip.name === "IDLE_CC0")
    ).toHaveLength(1);
});

test("native and lobby ready idle produce the same retargeted tracks", () => {
    const vrm = avatar();
    const baker = new AbstractBaker();
    baker.setAnimationJson(animations);
    const native = baker
        .prepareAnimations(vrm)
        .find((clip) => clip.name === "IDLE_CC0");
    const lobby = loadMixamoAnimation(
        vrm.scene,
        vrm,
        sanitizeLobbyAnimation(sourceClip(), "IDLE_CC0")
    );
    expect(native.duration).toBe(lobby.duration);
    expect(native.tracks).toHaveLength(53);
    expect(native.tracks.map((track) => THREE.KeyframeTrack.toJSON(track))).toEqual(
        lobby.tracks.map((track) => THREE.KeyframeTrack.toJSON(track))
    );
});
