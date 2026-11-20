// Orthographic drawing-space geometry shared by the one-image authoring tools.
require("./load-typescript.cjs");
const { Drawing } = require("../../features/procedural-avatars/drawing.ts");
const {
    drawCharacter,
} = require("../../features/procedural-avatars/buildCharacter.ts");
function drawingPattern(recipe) {
    const drawing = new Drawing(recipe.template, recipe);
    drawing.s.record = { points: [], runs: [] };
    drawCharacter(drawing, { ...recipe, shirtMark: undefined });
    const { points, runs } = drawing.s.record;
    const transform = drawing.rig.transform;
    const vertices = [];
    let left = Infinity,
        right = -Infinity,
        top = Infinity,
        bottom = -Infinity;
    for (const run of runs) {
        for (let i = run.start; i < run.start + run.count; i++) {
            const vertex = transform(
                points.slice(i * 3, i * 3 + 3),
                run.bone === "head",
                run.eyes,
                run.crown,
                !!run.pupil,
                run.familyPart ?? run.bone
            );
            vertices.push(vertex);
            left = Math.min(left, vertex[0]);
            right = Math.max(right, vertex[0]);
            top = Math.min(top, vertex[1]);
            bottom = Math.max(bottom, vertex[1]);
        }
    }
    return { drawing, transform, vertices, left, right, top, bottom };
}
module.exports = { drawingPattern };
