// Expose the same reduced drawing-space surface used for native avatars.
require("./load-typescript.cjs");
const { Drawing } = require("../../features/procedural-avatars/drawing.ts");
const {
    drawCharacter,
} = require("../../features/procedural-avatars/buildCharacter.ts");
const { Color } = require("three/webgpu");
const families = require("../../features/procedural-avatars/families.json");
const fit = process.argv.includes("--fit-parts")
    ? JSON.parse(require("node:fs").readFileSync(0, "utf8"))
    : null;
const bases = {};
for (const [name, { template: id }] of Object.entries(families)) {
    if (fit && name !== fit.family) continue;
    const d = new Drawing(id);
    d.s.record = { points: [], runs: [] };
    drawCharacter(d, {
        template: id,
        crownOutline: fit?.crownOutline,
        sunRays: fit?.sunRays,
        visor: fit?.visor,
    });
    const geometry = d.s.geometry();
    const { points, runs } = d.s.record;
    const { jaw, hip } = d.rig.landmarks;
    const attr = geometry.getAttribute("color");
    const color = new Color();
    const rgb = Array.from({ length: attr.count }, (_, i) => {
        color.fromBufferAttribute(attr, i).convertLinearToSRGB();
        return color
            .toArray()
            .map((v) => Math.round(255 * Math.min(1, Math.max(0, v))));
    });
    bases[name] = {
        crownCenter:
            id === "rick-classic"
                ? require("../../features/procedural-avatars/rick-classic.json")
                      .hair.center
                : null,
        points,
        runs,
        rgb,
        index: Array.from(geometry.index.array),
        jaw,
        hip,
    };
    geometry.dispose();
}
process.stdout.write(JSON.stringify(bases));
