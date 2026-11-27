import fs from "fs";
import path from "path";

/** Server-only: reads the Markdown docs in frontend/content/docs. */

export interface DocPage {
    slug: string;
    title: string;
    description: string;
    order: number;
    body: string;
    /** Questions and answers, when the page is written as them (`faq: true`). */
    faq?: FaqEntry[];
}

/** Markdown as plain text: links keep their words, marks go. */
function plain(markdown: string): string {
    return markdown
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[`*_]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** A name or description as one line that cannot break a Markdown link. */
function oneLine(text: string): string {
    return String(text ?? "")
        .replace(/[[\]()]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export interface FaqEntry {
    question: string;
    /** The answer as plain text. */
    answer: string;
    /** The answer as written, with its links. */
    markdown: string;
}

/** Each "## Question?" heading with the text under it. */
export function faqOf(body: string): FaqEntry[] {
    return body
        .split(/^## /m)
        .slice(1)
        .map((section) => {
            const [heading, ...rest] = section.split("\n");
            const markdown = rest.join("\n").trim();
            return {
                question: plain(heading),
                answer: plain(markdown),
                markdown,
            };
        })
        .filter(({ question, answer }) => question.endsWith("?") && answer);
}

/** The about page (/about): what Oncyber is, in plain words. */
export interface AboutPage {
    title: string;
    description: string;
    /** The opening statement, before the questions. */
    lead: string;
    faq: FaqEntry[];
    /** The whole page as Markdown, for llms-full.txt. */
    body: string;
}

export function aboutPage(): AboutPage {
    const page = parse(
        "about",
        fs.readFileSync(path.join(process.cwd(), "content", "about.md"), "utf8")
    );
    const [opening] = page.body.split(/^## /m);
    return {
        title: page.title,
        description: page.description,
        lead: plain(opening.replace(/^# .*$/m, "")),
        faq: faqOf(page.body),
        body: page.body,
    };
}

const DIR = path.join(process.cwd(), "content", "docs");

function parse(slug: string, raw: string): DocPage {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
    const meta: Record<string, string> = {};
    (match?.[1] || "").split("\n").forEach((line) => {
        const [key, ...rest] = line.split(":");
        if (key && rest.length) meta[key.trim()] = rest.join(":").trim();
    });
    const body = match ? raw.slice(match[0].length) : raw;
    return {
        slug,
        title: meta.title || slug,
        description: meta.description || "",
        order: Number(meta.order) || 0,
        body,
        ...(meta.faq === "true" ? { faq: faqOf(body) } : {}),
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
export interface FeaturedSpace {
    title: string;
    href: string;
    creator?: string;
    description?: string;
}

export function llmsText(origin: string, featured: FeaturedSpace[] = []) {
    const docs = allDocs();
    const home = docs.find((doc) => !doc.slug);
    return [
        "# Oncyber",
        "",
        `> ${home?.description || ""}`,
        "",
        "Oncyber is an open-source home for 3D spaces on the web: galleries,",
        "worlds people build in the browser, and a shared lobby where everyone",
        "meets and travels between them with the same identity and avatar.",
        "Each page below is also available as Markdown by adding .md to its URL.",
        "",
        "## Product",
        "",
        `- [Explore spaces](${origin}/): staff picks and the most visited spaces; search by name, creator or collection with ${origin}/?q=<words>`,
        `- [The lobby](${origin}/?lobby=1): the shared 3D world where visitors meet, chat, talk and travel to spaces together`,
        `- [Studio](${origin}/studio): build a gallery or a world in the browser and publish it, for free`,
        `- [About](${origin}/about): what Oncyber is, in plain questions and answers, and where to find the team`,
        `- A space lives at ${origin}/<its-link> or ${origin}/spaces/<id>; a creator's profile at ${origin}/@<name>`,
        `- [Sitemap](${origin}/sitemap.xml): every public space`,
        "",
        ...(featured.length
            ? [
                  "## Featured spaces",
                  "",
                  ...featured.map(
                      (space) =>
                          `- [${oneLine(space.title)}](${origin}${space.href})${
                              space.creator
                                  ? ` by ${oneLine(space.creator)}`
                                  : ""
                          }${
                              space.description
                                  ? `: ${oneLine(space.description).slice(
                                        0,
                                        160
                                    )}`
                                  : ""
                          }`
                  ),
                  "",
              ]
            : []),
        "## Building a game",
        "",
        `Asked to make a game for Oncyber? Read ${origin}/games/llms.txt first:`,
        "what a game must do, what is optional (lobby arrival, avatars,",
        "animations, walking, parties, voice, results, saved data, menus) and",
        "the SDK helper for each.",
        "",
        "## Everything in one file",
        "",
        `- [All docs](${origin}/llms-full.txt): every page below, in full`,
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

/** Every docs page in full, in one file, served at /llms-full.txt. */
export function llmsFullText(origin: string) {
    const docs = allDocs();
    const home = docs.find((doc) => !doc.slug);
    return [
        "# Oncyber docs",
        "",
        `> ${home?.description || ""}`,
        "",
        "---",
        "",
        `Source: ${origin}/about`,
        "",
        aboutPage().body.trim(),
        "",
        ...docs.flatMap((doc) => [
            "---",
            "",
            `Source: ${origin}/docs${doc.slug ? `/${doc.slug}` : ""}`,
            "",
            doc.body.trim(),
            "",
        ]),
    ].join("\n");
}
