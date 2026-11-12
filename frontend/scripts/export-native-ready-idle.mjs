/** Export the exact ready idle used by the lobby, without a native runtime fetch.
 * Regenerate with Node 22+: node --experimental-strip-types frontend/scripts/export-native-ready-idle.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decodeCC0LocomotionPack } from "../features/lobby/cc0LocomotionPack.ts";

const directory = new URL("../public/lobby/locomotion/", import.meta.url);
const manifest = JSON.parse(
    await readFile(new URL("manifest.json", directory))
);
const pack = manifest.packs.find((pack) => pack.clips.IDLE_CC0);
if (!pack) throw new Error("The pinned locomotion pack has no ready idle");
const bytes = await readFile(new URL(pack.file, directory));
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== pack.sha256) throw new Error("Pinned locomotion pack hash changed");
const { uuid, ...clip } = decodeCC0LocomotionPack(bytes).clips.IDLE_CC0;
const output = {
    provenance: {
        source: `/lobby/locomotion/${pack.file}`,
        sha256,
        clip: "IDLE_CC0",
        sourceName: pack.clips.IDLE_CC0.sourceName,
        generatedBy: "frontend/scripts/export-native-ready-idle.mjs",
    },
    clip: { ...clip, name: "idle_cc0" },
};
await writeFile(
    new URL(
        "../components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/animations/ready-idle.json",
        import.meta.url
    ),
    JSON.stringify(output) + "\n"
);
