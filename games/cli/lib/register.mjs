// `node --import <this file>`: lets the check tool load the SDK's
// TypeScript source from an installed package (ts-hook.mjs).
import { register } from "node:module";

// stripTypeScriptTypes prints an "experimental" warning for every file.
const emit = process.emitWarning;
process.emitWarning = (warning, ...rest) =>
    /stripTypeScriptTypes/.test(String(warning?.message ?? warning))
        ? undefined
        : emit.call(process, warning, ...rest);

register("./ts-hook.mjs", import.meta.url);
