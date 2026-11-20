// Map source ink back onto the undeformed sewing pattern before the first render.
require("./load-typescript.cjs");
const { readFileSync } = require("node:fs");
const { Drawing } = require("../../features/procedural-avatars/drawing.ts");
const {
    drawCharacter,
} = require("../../features/procedural-avatars/buildCharacter.ts");
const {
    readAvatarFile,
} = require("../../features/procedural-avatars/avatarFile.ts");
const { sunshine } = require("../../features/procedural-avatars/families.json");

const { candidate, frame } = JSON.parse(readFileSync(0, "utf8"));
const { recipe } = readAvatarFile(candidate);
const drawing = new Drawing("sunshine", recipe);
drawing.s.record = { points: [], runs: [] };
drawCharacter(drawing, { ...recipe, shirtMark: undefined });
const { points, runs } = drawing.s.record;
const transform = drawing.rig.transform;
let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
for (const run of runs) {
    for (let i = run.start; i < run.start + run.count; i++) {
        const [x, y] = transform(
            points.slice(i * 3, i * 3 + 3),
            run.bone === "head",
            run.eyes,
            run.crown,
            !!run.pupil,
            run.familyPart ?? run.bone
        );
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
    }
}

const [x0, y0, x1, y1] = sunshine.shirtBox;
const height = bottom - top;
function project(u, v) {
    const [x, y] = transform(
        [x0 + u * (x1 - x0), y0 + v * (y1 - y0), 0],
        false,
        false,
        false,
        false,
        "jersey"
    );
    return [
        ((x - (left + right) / 2) / height - frame[0]) / (frame[2] - frame[0]),
        ((y - top) / height - frame[1]) / (frame[3] - frame[1]),
    ];
}

function inverse([u, v]) {
    let a = u,
        b = v;
    for (let i = 0; i < 16; i++) {
        const [x, y] = project(a, b);
        if (Math.max(Math.abs(x - u), Math.abs(y - v)) < 0.0001)
            return [Number(a.toFixed(4)), Number(b.toFixed(4))];
        a += u - x;
        b += v - y;
    }
    return null;
}

const { outline, islands = [], color } = candidate.shirtMark;
const paths = [outline, ...islands].map((path) => path.map(inverse));
const valid = paths.every((path) =>
    path.every((point) => point && point.every((v) => v >= -0.5 && v <= 1.5))
);
process.stdout.write(
    JSON.stringify(
        valid
            ? {
                  color,
                  outline: paths[0],
                  ...(islands.length && { islands: paths.slice(1) }),
              }
            : null
    )
);
