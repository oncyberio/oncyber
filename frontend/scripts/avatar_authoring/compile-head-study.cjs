// Compile benchmark recipes through the same builder and mesh reduction as the avatar.
const fs = require("node:fs");
const T = require("three/webgpu");

require("./load-typescript.cjs");
const { Drawing } = require("../../features/procedural-avatars/drawing.ts");
const {
    drawShapeRecipe,
} = require("../../features/procedural-avatars/shapeRecipe.ts");

const studies = JSON.parse(fs.readFileSync(0, "utf8"));
const result = {};
for (const { id, template, recipe } of studies) {
    const drawing = new Drawing(template);
    drawShapeRecipe(drawing, recipe);
    const geometry = drawing.s.geometry();
    const position = geometry.getAttribute("position");
    const inverse = drawing.matrixFor("head").invert();
    const p = new T.Vector3();
    // Sculpt outputs meters. Drawing's bind transform works in centimeters.
    const vertices = Array.from({ length: position.count }, (_, i) =>
        p
            .fromBufferAttribute(position, i)
            .multiplyScalar(100)
            .applyMatrix4(inverse)
            .toArray()
    );
    result[id] = { vertices, index: Array.from(geometry.index.array) };
    geometry.dispose();
}
process.stdout.write(JSON.stringify(result));
