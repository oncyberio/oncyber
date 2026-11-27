/**
 * Draws a figure in a style and sets it beside a picture of the character
 * it is meant to be, so the two can be told apart feature by feature.
 *
 *   cd tasks/avatar-figure && npm ci
 *   npm run compare -- --style stagehand
 *   npm run compare -- --style stagehand --reference sheet.png \
 *       --eyes 614.5,130.6,591.3,124.4,639.5,130.6,662.7,124.4
 *
 * It needs the frontend's packages installed (`pnpm install` at the root)
 * and a Chromium for Playwright (`npx playwright install chromium`, once).
 *
 * Without a reference it writes the fixed views of the style to
 * `out/<style>/`: `face`, `three-quarter`, `side`, `back`, `eye-left`,
 * `eye-right`, `body`, `body-back`, and a row of expressions.
 *
 * With a reference (a front view of the character, eyes open) it also
 * writes:
 *
 * - `compare-face.png` and `compare-eyes.png`: the picture and the figure
 *   side by side, framed alike;
 * - `measure-eyes.png`: each eye of the picture under a grid in eye
 *   widths from its inner corner, which is the unit a style's eye
 *   outline, iris, lids and brows are written in. Read the numbers off
 *   it into the style, run again, compare;
 * - `measure-face.png`: the picture's face and the figure's, made the
 *   same size by the width of an eye, under a grid in eye widths across
 *   from the middle of the face and down from the inner corners of the
 *   eyes: what the levels and the outline of a style's head are read
 *   off.
 *
 * `--eyes` says where the picture's eyes are, in its pixels from its top
 * left corner: the inner then the outer corner of the eye on the viewer's
 * left, then the same for the eye on the right (eight numbers). To find
 * them, run with `--reference` alone first: `measure-picture.png` is the
 * picture under a grid of its own pixels, and `--region x,y,width,height`
 * is that part of it, closer.
 *
 * `--set eyes.radius=0.25` tries a change to the style without editing
 * it (repeatable; the value is JSON). `--expression happy` holds one.
 * `--views face,eye-right` draws only those.
 *
 * `--hair other.vrm` tries another model's hair on: whatever of that model
 * is hair is made the size of this head and set on it, shaded plainly in
 * `--hair-colour` (a dark brown unless given), to judge its shape by. It
 * is a fitting, not part of the figure.
 *
 * The figure is drawn by a headless browser's software WebGL, so the
 * pictures come out the same on any machine.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
    EYE_VIEW,
    FACE_SPAN,
    FACE_SPAN_WITH_HAIR,
    VIEWS,
} from "./compare/views.ts";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../..");
const FIGURE = path.join(ROOT, "frontend/public/models/figure_male.vrm");

const EXPRESSIONS = ["blink", "aa", "happy", "Surprised", "angry", "sad"];

const { values } = parseArgs({
    options: {
        style: { type: "string", default: "stagehand" },
        reference: { type: "string" },
        eyes: { type: "string" },
        set: { type: "string", multiple: true, default: [] },
        expression: { type: "string" },
        views: { type: "string" },
        region: { type: "string" },
        hair: { type: "string" },
        "hair-colour": { type: "string", default: "#2a2224" },
        out: { type: "string" },
    },
});
const outDir = path.resolve(values.out || path.join(HERE, "out", values.style));
mkdirSync(outDir, { recursive: true });

// Packages come from this folder; failing that, from wherever Node is
// told to look (NODE_PATH), as on machines that keep a browser ready.
const need = createRequire(import.meta.url);
const { build } = need("esbuild") as typeof import("esbuild");
const { chromium } = need("playwright") as typeof import("playwright");

const three = path.join(ROOT, "node_modules/three");
const bundle = path.join(HERE, "out", "page.js");
await build({
    entryPoints: [path.join(HERE, "compare/page.ts")],
    bundle: true,
    format: "iife",
    outfile: bundle,
    target: "es2022",
    logLevel: "error",
    nodePaths: [
        path.join(ROOT, "node_modules"),
        path.join(ROOT, "frontend/node_modules"),
    ],
    // One copy of three, the build the app uses.
    alias: {
        "three/webgpu": path.join(three, "build/three.webgpu.js"),
        "three/tsl": path.join(three, "build/three.tsl.js"),
        "three/examples/jsm/loaders/GLTFLoader.js": path.join(
            three,
            "examples/jsm/loaders/GLTFLoader.js"
        ),
        three: path.join(three, "build/three.webgpu.js"),
    },
});

const reference = values.reference && path.resolve(values.reference);
if (reference && !existsSync(reference))
    throw new Error(`No picture at ${reference}`);
const hair = values.hair && path.resolve(values.hair);
if (hair && !existsSync(hair)) throw new Error(`No model at ${hair}`);
// With hair on, the face views take in more above the head.
const faceSpan = hair ? FACE_SPAN_WITH_HAIR : FACE_SPAN;
const served: Record<string, () => string> = {
    "/page.js": () => bundle,
    "/figure.vrm": () => FIGURE,
    "/reference": () => reference,
    "/hair.vrm": () => hair,
};
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/") {
        response.setHeader("content-type", "text/html");
        response.end(
            "<!doctype html><style>html,body{margin:0;overflow:hidden;" +
                "background:#fff}canvas{display:block}</style><body>" +
                '<script src="/page.js"></script></body>'
        );
        return;
    }
    // Pictures already drawn, for laying out beside others.
    const drawn = url.pathname.startsWith("/drawn/")
        ? path.join(outDir, path.basename(url.pathname))
        : served[url.pathname]?.();
    if (!drawn || !existsSync(drawn) || !statSync(drawn).isFile()) {
        response.statusCode = 404;
        response.end();
        return;
    }
    response.end(readFileSync(drawn));
}).listen(0);
const address = server.address();
const origin = `http://localhost:${
    typeof address === "object" ? address.port : 0
}`;

const browser = await chromium.launch({
    args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
    ],
});

type Result = Record<string, any>;
/** Open the page with a query, wait for it, and keep a picture of it. */
async function shoot(
    name: string,
    query: URLSearchParams,
    [width, height]: [number, number]
): Promise<Result> {
    const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
    });
    page.on("pageerror", (error) => console.error(`  ${name}: ${error}`));
    await page.goto(`${origin}/?${query}`, { timeout: 600_000 });
    await page.waitForFunction(
        "window.__compare && window.__compare.status",
        null,
        { timeout: 600_000 }
    );
    const result = (await page.evaluate("window.__compare")) as Result;
    if (result.status !== "ready")
        throw new Error(`${name}: ${result.message}`);
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    await page.close();
    return result;
}

const styleQuery = () => {
    const query = new URLSearchParams({ style: values.style });
    for (const change of values.set) query.append("set", change);
    if (values.expression) query.set("expression", values.expression);
    if (hair) query.set("hair", values["hair-colour"]);
    query.set("span", String(faceSpan));
    return query;
};
type Tile = {
    src: string;
    crop?: number[];
    at: number[];
    label?: string;
    // As page.ts draws it.
    grid?: {
        origin: number[];
        from: number[];
        unit: number;
        across: number;
        up: number;
        step: number;
        numbered: number;
        places: number;
    };
};
const layOut = (name: string, width: number, height: number, tiles: Tile[]) =>
    shoot(
        name,
        new URLSearchParams({
            sheet: JSON.stringify({ width, height, tiles }),
        }),
        [width, height]
    );

try {
    // The style's fixed views.
    const wanted = values.views ? values.views.split(",") : Object.keys(VIEWS);
    // Setting it beside a picture takes these three.
    if (reference && values.eyes)
        for (const view of ["face", "eye-left", "eye-right"])
            if (!wanted.includes(view)) wanted.push(view);
    let measured: Result | null = null;
    for (const view of wanted) {
        if (!VIEWS[view]) throw new Error(`No view called ${view}`);
        const query = styleQuery();
        query.set("view", view);
        measured = await shoot(view, query, VIEWS[view]);
        console.log(`  ${view}.png`);
    }
    if (measured)
        console.log(
            `  ${measured.style}: ${measured.triangles} triangles, eyes ` +
                `${(measured.eyes.right.width * 1000).toFixed(1)} mm wide`
        );
    if (measured?.head) {
        const { levels, widths } = measured.head;
        const two = (n: number) => n.toFixed(2);
        console.log(
            `  its head, in eye widths: nose ${two(levels.nose)}, mouth ` +
                `${two(levels.mouth)}, chin ${two(levels.chin)} below the ` +
                `eyes, crown ${two(levels.crown)} above; half-width ` +
                widths
                    .map(([down, half]: number[]) => `${two(half)} at ${down}`)
                    .join(", ")
        );
    }
    if (measured?.hair)
        console.log(
            `  hair tried on: ${measured.hair.triangles} triangles, made ` +
                `${measured.hair.fit.toFixed(3)} times its size to fit`
        );
    if (!values.views && !values.expression) {
        // A row of expressions, to see that the face still moves.
        const size = 420;
        const tiles: Tile[] = [];
        for (const [i, expression] of EXPRESSIONS.entries()) {
            const query = styleQuery();
            query.set("view", "face");
            query.set("expression", expression);
            await shoot(`expression-${expression}`, query, [size, size]);
            tiles.push({
                src: `/drawn/expression-${expression}.png`,
                at: [i * size, 0, size, size],
                label: expression,
            });
        }
        await layOut("expressions", size * EXPRESSIONS.length, size, tiles);
        console.log("  expressions.png");
    }

    if (reference && !values.eyes) {
        // The picture, or a part of it, under a grid of its own pixels:
        // what to find the corners of its eyes on.
        const { sizes } = await layOut("measure-picture", 8, 8, [
            { src: "/reference", at: [0, 0, 8, 8] },
        ]);
        const whole = [0, 0, ...sizes["/reference"]];
        const region = values.region
            ? values.region.split(",").map(Number)
            : whole;
        if (region.length !== 4 || region.some(Number.isNaN))
            throw new Error("--region takes four numbers: x, y, width, height");
        const zoom = 1600 / region[2];
        // Lines no closer than 12 pixels of the page.
        const step = [1, 2, 5, 10, 20, 50, 100].find((s) => s * zoom >= 12);
        await layOut("measure-picture", 1600, Math.round(region[3] * zoom), [
            {
                src: "/reference",
                crop: region,
                at: [0, 0, 1600, Math.round(region[3] * zoom)],
                grid: {
                    origin: [0, 0],
                    from: [region[0], region[1]],
                    unit: zoom,
                    across: 1,
                    up: -1,
                    step: step ?? 100,
                    numbered: 5,
                    places: 0,
                },
            },
        ]);
        console.log(
            `  measure-picture.png: the picture (${whole[2]} by ${whole[3]}) ` +
                `under a grid of its own pixels, a line every ${
                    step ?? 100
                }, ` +
                "counted from its top left corner. Find the corners of the " +
                "eyes on it (--region x,y,width,height looks closer) and " +
                "pass them as --eyes."
        );
    }
    if (reference && values.eyes && measured) {
        const n = values.eyes.split(",").map(Number);
        if (n.length !== 8 || n.some(Number.isNaN))
            throw new Error("--eyes takes eight numbers");
        // On the viewer's left and right: inner corner, outer corner.
        const eyes = {
            left: { inner: [n[0], n[1]], outer: [n[2], n[3]] },
            right: { inner: [n[4], n[5]], outer: [n[6], n[7]] },
        };
        const [ew, eh] = VIEWS["eye-left"];
        const eyeTiles: Tile[] = [];
        const gridTiles: Tile[] = [];
        (["left", "right"] as const).forEach((side, row) => {
            const { inner, outer } = eyes[side];
            const width = Math.abs(outer[0] - inner[0]);
            const out = Math.sign(outer[0] - inner[0]);
            const x0 =
                out > 0
                    ? inner[0] - EYE_VIEW.inwards * width
                    : inner[0] - EYE_VIEW.outwards * width;
            const crop = [
                x0,
                inner[1] - EYE_VIEW.up * width,
                (EYE_VIEW.inwards + EYE_VIEW.outwards) * width,
                (EYE_VIEW.up + EYE_VIEW.down) * width,
            ];
            const y = row * (eh + 10);
            eyeTiles.push(
                {
                    src: "/reference",
                    crop,
                    at: [0, y, ew, eh],
                    label: "Picture",
                },
                {
                    src: `/drawn/eye-${side}.png`,
                    at: [ew + 10, y, ew, eh],
                    label: "Figure",
                }
            );
            const unit = ew / (EYE_VIEW.inwards + EYE_VIEW.outwards);
            gridTiles.push({
                src: "/reference",
                crop,
                at: [0, y, ew, eh],
                label: `Eye on the ${side}: eye widths from its inner corner`,
                grid: {
                    origin: [
                        (out > 0 ? EYE_VIEW.inwards : EYE_VIEW.outwards) * unit,
                        EYE_VIEW.up * unit,
                    ],
                    from: [0, 0],
                    unit,
                    across: out,
                    up: 1,
                    step: 0.1,
                    numbered: 5,
                    places: 1,
                },
            });
        });
        await layOut("compare-eyes", ew * 2 + 10, eh * 2 + 10, eyeTiles);
        await layOut("measure-eyes", ew, eh * 2 + 10, gridTiles);
        // The faces, set to the same size by the distance between the
        // inner corners of their eyes.
        const between = (a: number[], b: number[]) =>
            Math.hypot(a[0] - b[0], a[1] - b[1]);
        const perMetre =
            between(eyes.left.inner, eyes.right.inner) /
            Math.abs(measured.eyes.right.x - measured.eyes.left.x);
        const half = (faceSpan / 2) * perMetre;
        const middle = [
            (eyes.left.inner[0] + eyes.right.inner[0]) / 2,
            (eyes.left.inner[1] + eyes.right.inner[1]) / 2 - 0.003 * perMetre,
        ];
        const [fw, fh] = VIEWS.face;
        await layOut("compare-face", fw * 2 + 10, fh, [
            {
                src: "/reference",
                crop: [middle[0] - half, middle[1] - half, half * 2, half * 2],
                at: [0, 0, fw, fh],
                label: "Picture",
            },
            {
                src: "/drawn/face.png",
                at: [fw + 10, 0, fw, fh],
                label: "Figure",
            },
        ]);
        // Both faces again, this time made the same size by the width of
        // an eye, under a grid in eye widths: across from the middle of
        // the face, and down from the inner corners of the eyes. It is
        // what a style's levels and outline of the head are read off.
        const eyeMetres =
            (measured.eyes.left.width + measured.eyes.right.width) / 2;
        const eyePixels =
            (Math.abs(eyes.left.outer[0] - eyes.left.inner[0]) +
                Math.abs(eyes.right.outer[0] - eyes.right.inner[0])) /
            2;
        const drawnPerMetre = fh / faceSpan;
        const picturePerMetre = eyePixels / eyeMetres;
        const halfPicture = (faceSpan / 2) * picturePerMetre;
        const corners = [
            (eyes.left.inner[0] + eyes.right.inner[0]) / 2,
            (eyes.left.inner[1] + eyes.right.inner[1]) / 2,
        ];
        const grid = {
            origin: [fw / 2, fh / 2 + 0.003 * drawnPerMetre],
            from: [0, 0],
            unit: eyeMetres * drawnPerMetre,
            across: 1,
            up: -1,
            step: 0.1,
            numbered: 5,
            places: 1,
        };
        await layOut("measure-face", fw * 2 + 10, fh, [
            {
                src: "/reference",
                crop: [
                    corners[0] - halfPicture,
                    corners[1] - 0.003 * picturePerMetre - halfPicture,
                    halfPicture * 2,
                    halfPicture * 2,
                ],
                at: [0, 0, fw, fh],
                label: "Picture: eye widths from between the eyes",
                grid,
            },
            {
                src: "/drawn/face.png",
                at: [fw + 10, 0, fw, fh],
                label: "Figure",
                grid,
            },
        ]);
        console.log(
            "  compare-face.png, compare-eyes.png, measure-eyes.png, " +
                "measure-face.png"
        );
    }
    console.log(`Wrote ${path.relative(process.cwd(), outDir) || "."}`);
} finally {
    await browser.close();
    server.close();
}
