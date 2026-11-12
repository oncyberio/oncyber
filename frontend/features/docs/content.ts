import fs from "fs";
import path from "path";

/** Server-only: reads the Markdown docs in frontend/content/docs. */

export interface DocPage {
    slug: string;
    title: string;
    description: string;
    order: number;
    body: string;
}

const DIR = path.join(process.cwd(), "content", "docs");

function parse(slug: string, raw: string): DocPage {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
    const meta: Record<string, string> = {};
    (match?.[1] || "").split("\n").forEach((line) => {
        const [key, ...rest] = line.split(":");
        if (key && rest.length) meta[key.trim()] = rest.join(":").trim();
    });
    return {
        slug,
        title: meta.title || slug,
        description: meta.description || "",
        order: Number(meta.order) || 0,
        body: match ? raw.slice(match[0].length) : raw,
    };
}

export function allDocs(): DocPage[] {
    return fs
        .readdirSync(DIR)
        .filter((file) => file.endsWith(".md"))
        .map((file) => {
            const name = file.replace(/\.md$/, "");
            return parse(
                name === "index" ? "" : name,
                fs.readFileSync(path.join(DIR, file), "utf8")
            );
        })
        .sort((a, b) => a.order - b.order);
}

/** The plain-text index agents read at /llms.txt. */
export function llmsText(origin: string) {
    const docs = allDocs();
    const home = docs.find((doc) => !doc.slug);
    return [
        "# Oncyber",
        "",
        `> ${home?.description || ""}`,
        "",
        "Oncyber is an open-source shared 3D lobby that connects many worlds:",
        "galleries and web experiences people travel into with the same",
        "identity and avatar. Each page below is also available as Markdown",
        "by adding .md to its URL.",
        "",
        "## Docs",
        "",
        ...docs.map(
            (doc) =>
                `- [${doc.title}](${origin}/docs${
                    doc.slug ? `/${doc.slug}` : ""
                }.md): ${doc.description}`
        ),
        "",
    ].join("\n");
}
