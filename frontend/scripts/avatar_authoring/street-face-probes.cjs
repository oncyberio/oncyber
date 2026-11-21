// Locate drawing landmarks on the triangles that survive each level of detail.
require("./load-typescript.cjs");
const { readFileSync } = require("node:fs");
const { Triangle, Vector3 } = require("three/webgpu");
const {
    readAvatarFile,
} = require("../../features/procedural-avatars/avatarFile.ts");
const {
    buildCharacter,
} = require("../../features/procedural-avatars/buildCharacter.ts");
const {
    streetPaintUV,
    streetIrisX,
} = require("../../features/procedural-avatars/streetBrush.ts");
const {
    disposeAvatarGraph,
} = require("../../features/lobby/webgpu/avatarResources.ts");

function locate(geometry, chart, x, y, side = 0) {
    const { position, uv } = geometry.attributes;
    const sample = new Vector3(...streetPaintUV(chart, x, y), 0);
    const weights = new Vector3();
    let front;
    for (let i = 0; i < geometry.index.count; i += 3) {
        const tri = [0, 1, 2].map((j) => geometry.index.getX(i + j));
        if (Math.floor(uv.getX(tri[0])) !== Math.floor(sample.x)) continue;
        if (side && Math.sign(position.getX(tri[0])) !== side) continue;
        const corners = tri.map((j) => new Vector3(uv.getX(j), uv.getY(j), 0));
        if (!Triangle.getBarycoord(sample, ...corners, weights)) continue;
        if (Math.min(weights.x, weights.y, weights.z) < -0.0001) continue;
        const point = new Vector3();
        for (const [k, j] of tri.entries())
            point.addScaledVector(
                new Vector3().fromBufferAttribute(position, j),
                weights.getComponent(k)
            );
        if (!front || point.z > front.z) front = point;
    }
    if (!front) throw Error(`Missing ${chart} landmark at ${x}, ${y}`);
    return [front.x, -front.y, front.z];
}

const { recipe } = readAvatarFile(
    JSON.parse(readFileSync(process.argv[2], "utf8"))
);
const levels = {};
for (const level of ["full", "crowd"]) {
    const avatar = buildCharacter(recipe, level);
    try {
        const mesh = avatar.scene.getObjectByProperty("isSkinnedMesh", true);
        levels[level] = {
            leftEye: locate(mesh.geometry, "eye", streetIrisX, 131.5, -1),
            rightEye: locate(mesh.geometry, "eye", streetIrisX, 131.5, 1),
            nose: locate(mesh.geometry, "skin", 0, 149),
            mouth: locate(mesh.geometry, "skin", 0, 167.6),
            chin: locate(mesh.geometry, "skin", 0, 184),
        };
    } finally {
        disposeAvatarGraph(avatar.scene);
    }
}
console.log(JSON.stringify(levels));
