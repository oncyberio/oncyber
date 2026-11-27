// The check tool imports the SDK's TypeScript source directly. Node strips
// types itself, except for files under node_modules, which is where an
// installed package lives. This load hook strips them for .ts files there.
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

// Said once per file otherwise: "stripTypeScriptTypes is an experimental
// feature". Hooks run on a thread of their own, with their own process.
const emit = process.emitWarning;
process.emitWarning = (warning, ...rest) =>
    /stripTypeScriptTypes/.test(String(warning?.message ?? warning))
        ? undefined
        : emit.call(process, warning, ...rest);

export async function load(url, context, nextLoad) {
    if (
        url.startsWith("file:") &&
        /\.m?ts$/.test(url) &&
        url.includes("/node_modules/")
    ) {
        const source = await readFile(fileURLToPath(url), "utf8");
        return {
            format: "module",
            shortCircuit: true,
            source: stripTypeScriptTypes(source),
        };
    }
    return nextLoad(url, context);
}
