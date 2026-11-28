/**
 * Sewn clothes, step one: hands the figure's body to the sewing
 * simulator (see sewn/README.md).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { loadFigure } from "../clothes/figure";
import { writeBody } from "./body";

declare const process: { argv: string[]; env: Record<string, string> };

const ROOT = process.env.CLOTHES_ROOT;
const FIGURE = path.join(ROOT, "frontend/public/models/figure_male.vrm");
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const figure = await loadFigure(FIGURE);
const m = writeBody(figure, out);
console.log(JSON.stringify(m, null, 1));
