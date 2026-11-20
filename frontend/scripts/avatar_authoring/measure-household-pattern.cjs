// Locate shirt stations and forearm centerlines on the fitted pattern, before rendering.
const { readFileSync } = require("node:fs");
const { drawingPattern } = require("./drawing-pattern.cjs");
const {
    readAvatarFile,
} = require("../../features/procedural-avatars/avatarFile.ts");
const {
    prepareHousehold,
} = require("../../features/procedural-avatars/householdBody.ts");
const candidate = JSON.parse(readFileSync(0, "utf8"));
const { recipe } = readAvatarFile(candidate);
const body = prepareHousehold(recipe.cartoon).fit;
const result = { neck: body.neckline, hem: body.hem };
if (candidate.design.household.body?.sections.palmContours) {
    const { drawing, vertices, top, bottom } = drawingPattern(recipe);
    const geometry = drawing.s.geometry();
    const faces = geometry.index.array;
    // Intersections with the front plane of the rest mesh need only its indexed
    // triangle edges. They are independent of shading, a camera and image size.
    function extremes(axis, level, low = -Infinity, high = Infinity) {
        let min = Infinity,
            max = -Infinity;
        for (let i = 0; i < faces.length; i += 3) {
            for (let e = 0; e < 3; e++) {
                const a = vertices[faces[i + e]],
                    b = vertices[faces[i + ((e + 1) % 3)]];
                if (a[axis] > level === b[axis] > level) continue;
                const t = (level - a[axis]) / (b[axis] - a[axis]);
                const hit = a[1 - axis] + t * (b[1 - axis] - a[1 - axis]);
                if (hit >= low && hit <= high) {
                    min = Math.min(min, hit);
                    max = Math.max(max, hit);
                }
            }
        }
        return Number.isFinite(min) ? (min + max) / 2 : null;
    }
    const unit = (bottom - top) / (candidate.design.height - 12);
    const center = extremes(
        1,
        top + ((body.neckline + body.hem) / 2 - 12) * unit
    );
    const arm = body.sections.arm,
        first = arm[0][0],
        [last, wrist, radius] = arm.at(-1);
    if (center !== null) {
        result.forearms = [-1, 1].map((side) => {
            const levels = [];
            for (let station = 4; station < 10; station++) {
                const x =
                    center +
                    side * (first + ((last - first) * station) / 10) * unit;
                const y = extremes(
                    0,
                    x,
                    top + (wrist - 12 - radius * 2.6) * unit,
                    top + (wrist - 12 + radius * 2.6) * unit
                );
                if (y !== null) levels.push((y - top) / unit);
            }
            return levels;
        });
    }
    geometry.dispose();
}
process.stdout.write(JSON.stringify(result));
