#!/usr/bin/env node
/**
 * Licensed fonts (Aeonik, PP Editorial New, PP Neue Bit) are not in the
 * repository. When LICENSED_FONTS_URL points at a .tar.gz of the font files,
 * this downloads it into public/fonts/licensed before dev/build. Without it the
 * site falls back to the open fonts in public/fonts. See docs/fonts.md.
 *
 * LICENSED_FONTS_URL    https URL of a .tar.gz with the font files at its root
 * LICENSED_FONTS_TOKEN  optional bearer token sent with the request
 */
import { mkdir, readdir, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, "../public/fonts/licensed");
const url = process.env.LICENSED_FONTS_URL;

const present = async () =>
    (await readdir(target).catch(() => [])).some((name) =>
        /\.(otf|ttf|woff2?)$/i.test(name)
    );

if (!url) {
    console.log(
        (await present())
            ? "Licensed fonts: using files already in public/fonts/licensed."
            : "Licensed fonts: LICENSED_FONTS_URL not set, using open fallback fonts."
    );
    process.exit(0);
}

const headers = process.env.LICENSED_FONTS_TOKEN
    ? { authorization: `Bearer ${process.env.LICENSED_FONTS_TOKEN}` }
    : {};
const response = await fetch(url, { headers });
if (!response.ok) {
    console.error(`Licensed fonts: download failed (${response.status}).`);
    process.exit(1);
}
const archive = path.join(os.tmpdir(), `licensed-fonts-${process.pid}.tar.gz`);
await writeFile(archive, Buffer.from(await response.arrayBuffer()));
await mkdir(target, { recursive: true });
execFileSync("tar", ["-xzf", archive, "-C", target, "--no-same-owner"]);
await rm(archive, { force: true });
console.log(`Licensed fonts: ${(await readdir(target)).length} files ready.`);
