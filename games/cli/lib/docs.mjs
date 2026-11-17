// `oncyber docs [topic]`: the pages a game's author reads, from the copy
// this package carries.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { PACKED, SDK, sdk } from "./paths.mjs";

/** Every topic and its file, relative to the SDK folder. */
export function topics() {
    const pages = {
        guide: "games/llms.txt",
        brief: "games/BRIEF.md",
        games: "docs/games.md",
    };
    for (const file of readdirSync(sdk("docs/games")).sort())
        if (file.endsWith(".md"))
            pages[file.slice(0, -3)] = `docs/games/${file}`;
    return pages;
}

/** The text of a topic; the guide (games/llms.txt) when none is named. */
export function readTopic(topic = "guide") {
    const pages = topics();
    const name = topic.replace(/^docs\/games\//, "").replace(/\.md$/, "");
    const file = Object.hasOwn(pages, name) ? pages[name] : null;
    if (!file || !existsSync(sdk(file)))
        throw new Error(
            `no page named ${topic}. Pages: ${Object.keys(pages).join(", ")}`
        );
    return { file, text: readFileSync(sdk(file), "utf8") };
}

/** Said above a page read outside the repository: where its paths are. */
export const OUTSIDE_NOTE = PACKED
    ? `> You are reading this through the \`oncyber\` command, outside the Oncyber
> repository. Paths such as \`docs/games/...\` and \`games/runtime/src/...\`
> are in this package's copy: ${SDK}
> Read a page with \`oncyber docs <name>\` (\`oncyber docs --list\`). Where a
> page says \`pnpm games:check <id>\`, run \`oncyber check\` in the game's
> folder; for \`pnpm games:publish <id>\`, \`oncyber publish\`. Your game is the
> current folder, not \`games/<id>/\`, and it builds to \`dist/\`.

`
    : "";
