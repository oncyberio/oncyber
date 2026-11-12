import model from "./cyberloopMorphData.json";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
function ease(value: number) {
    const x = clamp(value);
    return x * x * x * (10 + x * (-15 + x * 6));
}
const coordinate = (p: number[]) =>
    p.map((value) => Number(value.toFixed(2))).join(" ");

/** The reviewed ribbon morph, evaluated only when the cards change position. */
function geometry(time: number) {
    const q = ease((time - 0.8) / 0.85);
    const thickness = ease((time - 1.05) / 0.6);
    const angle = 180 * ease((time - 0.2) / 1.4);
    const paths = model.map(({ source, target }) => {
        const count = source.length;
        const centers = source.map((s, i) => [
            s.c[0] + (target[i].c[0] - s.c[0]) * q,
            s.c[1] + (target[i].c[1] - s.c[1]) * q,
        ]);
        const rails: number[][][] = [[], []];
        for (let i = 0; i < count; i++) {
            const s = source[i],
                t = target[i],
                c = centers[i];
            const from = Math.atan2(s.h[1], s.h[0]);
            const to = Math.atan2(t.h[1], t.h[0]);
            const delta = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            const reference = from + delta * q;
            const before = centers[Math.max(0, i - 1)];
            const after = centers[Math.min(count - 1, i + 1)];
            let direction =
                Math.atan2(after[1] - before[1], after[0] - before[0]) +
                Math.PI / 2;
            if (Math.cos(direction - reference) < 0) direction += Math.PI;
            const toFinal =
                ((reference - direction + Math.PI * 3) % (Math.PI * 2)) -
                Math.PI;
            direction += toFinal * ease((q - 0.85) / 0.15);
            const weight =
                Math.hypot(...s.h) +
                (Math.hypot(...t.h) - Math.hypot(...s.h)) * thickness;
            const h = [
                Math.cos(direction) * weight,
                Math.sin(direction) * weight,
            ];
            rails[0].push([c[0] + h[0], c[1] + h[1]]);
            rails[1].push([c[0] - h[0], c[1] - h[1]]);
        }
        const end = centers[count - 1],
            before = centers[count - 2],
            start = centers[0],
            after = centers[1];
        const endLength =
            Math.hypot(end[0] - before[0], end[1] - before[1]) || 1;
        const startLength =
            Math.hypot(after[0] - start[0], after[1] - start[1]) || 1;
        const cap = Math.sin(Math.PI * q) * Math.hypot(...source[0].h) * 1.3;
        const endExtension = [
            ((end[0] - before[0]) / endLength) * cap,
            ((end[1] - before[1]) / endLength) * cap,
        ];
        const startExtension = [
            ((start[0] - after[0]) / startLength) * cap,
            ((start[1] - after[1]) / startLength) * cap,
        ];
        const add = (a: number[], b: number[]) => [a[0] + b[0], a[1] + b[1]];
        return (
            rails[0]
                .map((p, i) => `${i ? "L" : "M"}${coordinate(p)}`)
                .join("") +
            `C${coordinate(
                add(rails[0][count - 1], endExtension)
            )} ${coordinate(
                add(rails[1][count - 1], endExtension)
            )} ${coordinate(rails[1][count - 1])}` +
            rails[1]
                .slice()
                .reverse()
                .slice(1)
                .map((p) => `L${coordinate(p)}`)
                .join("") +
            `C${coordinate(add(rails[1][0], startExtension))} ${coordinate(
                add(rails[0][0], startExtension)
            )} ${coordinate(rails[0][0])}Z`
        );
    });
    return { paths, angle };
}

const ORIGINAL = geometry(1.65);
const LOOP = geometry(0.2);

export function scrollLogoPose(columns: number, reducedMotion = false) {
    const position = Number.isFinite(columns) ? Math.max(0, columns) : 0;
    const progress = clamp(position);
    const morph = reducedMotion ? (progress < 0.5 ? 0 : 1) : progress;
    const pose =
        morph === 0
            ? ORIGINAL
            : morph === 1
            ? LOOP
            : geometry(1.65 - morph * 1.45);
    // Start the continuing turn gently after the first complete column.
    const beyond = Math.max(0, position - 1);
    const turn = reducedMotion
        ? 0
        : 48 * (beyond - 0.12 * (1 - Math.exp(-beyond / 0.12)));
    return {
        paths: pose.paths,
        angle: pose.angle - turn,
        progress,
        form: morph === 0 ? "original" : morph === 1 ? "loop" : "transition",
    };
}
