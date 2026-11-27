// Where the SDK is. An installed package carries a copy of the parts of the
// repository a game needs, laid out as they are there (sdk/games/runtime,
// sdk/games/kits, sdk/scripts/games, sdk/docs/games, ...), written by
// scripts/prepack.mjs. Run from a checkout, the repository itself is used.
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The package's own folder (games/cli in the repository). */
export const PACKAGE = realpathSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "..")
);

const packed = join(PACKAGE, "sdk");
const checkout = resolve(PACKAGE, "../..");

/** True when this is an installed package, not a checkout. */
export const PACKED = existsSync(join(packed, "scripts/games/games.mjs"));

/** The folder laid out like the repository. */
export const SDK = PACKED ? packed : checkout;

if (!existsSync(join(SDK, "scripts/games/games.mjs")))
    throw new Error(
        "the oncyber package is incomplete: its sdk folder is missing. Install it from a tarball made with `npm pack`"
    );

export const sdk = (...parts) => join(SDK, ...parts);
