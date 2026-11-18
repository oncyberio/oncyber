#!/usr/bin/env node
// Checks what a deployment gives search engines and AI assistants, page
// type by page type, so a change that drops a title, a canonical or a
// space's text is caught before it ships.
//
//   node scripts/seo-check.mjs https://www.oncyber.com
//   node scripts/seo-check.mjs <preview url> --space /frahm-gallery --profile /@6529
//
// Without --space, three spaces are taken from the deployment's own
// sitemap. Exit code 0 when every check passes, 1 when one fails.

import path from "node:path";
import { fileURLToPath } from "node:url";

// The middleware turns away scripts that say they are scripts; pages are
// checked as a browser would get them.
const BROWSER =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const all = (html, pattern) => [...html.matchAll(pattern)].map((m) => m[1]);

/** The parts of a page's HTML the checks read. */
export function readPage(html) {
    const head = html.split(/<\/head>/i)[0] || html;
    const visible = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
    const jsonLd = all(
        html,
        /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    ).map((text) => {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    });
    // Every "@type" anywhere in the data (a breadcrumb sits inside its page).
    const types = [];
    const collect = (node) => {
        if (Array.isArray(node)) return node.forEach(collect);
        if (!node || typeof node !== "object") return;
        types.push(...[node["@type"]].flat().filter(Boolean));
        Object.values(node).forEach(collect);
    };
    jsonLd.forEach(collect);
    const summary = (visible.match(
        /<section[^>]+aria-label="About this space"[\s\S]*?<\/section>/i
    ) || [""])[0];
    const text = (part) =>
        part
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    return {
        titles: all(head, /<title[^>]*>([^<]*)<\/title>/gi),
        descriptions: all(
            head,
            /<meta[^>]+name="description"[^>]+content="([^"]*)"/gi
        ),
        canonicals: all(head, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/gi),
        robots: all(head, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/gi),
        ogImages: all(
            head,
            /<meta[^>]+property="og:image"[^>]+content="([^"]*)"/gi
        ),
        h1: all(visible, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(text),
        jsonLd,
        types,
        summaryWords: summary ? text(summary).split(" ").length : 0,
        summaryLinks: (summary.match(/<a /g) || []).length,
        words: text(visible).split(" ").filter(Boolean).length,
    };
}

/**
 * What each kind of page must carry. `canonical` is "self" (its own path),
 * "none" or "any".
 */
export const PAGE_RULES = {
    home: { canonical: "self", types: ["Organization", "WebSite"], h1: true },
    page: { canonical: "self", h1: true },
    app: { canonical: "self" },
    doc: {
        canonical: "self",
        types: ["TechArticle"],
        h1: true,
        ownDescription: true,
    },
    faq: {
        canonical: "self",
        types: ["FAQPage"],
        h1: true,
        ownDescription: true,
    },
    space: {
        canonical: "any",
        types: ["WebPage", "CreativeWork", "BreadcrumbList"],
        h1: true,
        ownDescription: true,
        summaryWords: 8,
        ownImage: true,
    },
    profile: {
        canonical: "any",
        types: ["ProfilePage"],
        h1: true,
        ownDescription: true,
    },
    template: {
        canonical: "self",
        types: ["WebPage"],
        h1: true,
        ownDescription: true,
    },
    missing: { status: 404, canonical: "none", noindex: true },
};

/** The failures of one page against its kind's rules (empty when it passes). */
export function checkPage(kind, path, { status, html }, defaults = {}) {
    const rules = PAGE_RULES[kind];
    const failures = [];
    const expected = rules.status || 200;
    if (status !== expected) return [`status ${status}, expected ${expected}`];
    const page = readPage(html);
    if (page.titles.length !== 1 || !page.titles[0].trim())
        failures.push(`${page.titles.length} title tags`);
    if (page.descriptions.length !== 1 || !page.descriptions[0].trim())
        failures.push(`${page.descriptions.length} description tags`);
    if (page.jsonLd.includes(null))
        failures.push("structured data does not parse");
    const noindex = page.robots.some((value) => /noindex/i.test(value));
    if (rules.noindex && !noindex) failures.push("should be noindex");
    if (!rules.noindex && noindex) failures.push("is noindex");
    if (rules.canonical === "none") {
        if (page.canonicals.length) failures.push("has a canonical");
    } else if (page.canonicals.length !== 1) {
        failures.push(`${page.canonicals.length} canonical tags`);
    } else {
        let url;
        try {
            url = new URL(page.canonicals[0]);
        } catch {
            failures.push("canonical is not an absolute address");
        }
        if (url && rules.canonical === "self") {
            const own = path.split("?")[0].replace(/\/$/, "") || "/";
            if ((url.pathname.replace(/\/$/, "") || "/") !== own)
                failures.push(`canonical is ${url.pathname}, expected ${own}`);
        }
    }
    for (const type of rules.types || [])
        if (!page.types.includes(type))
            failures.push(`no ${type} in the structured data`);
    if (rules.h1 && page.h1.filter(Boolean).length < 1) failures.push("no h1");
    if (
        rules.ownDescription &&
        defaults.description &&
        page.descriptions[0] === defaults.description
    )
        failures.push("has the site's default description");
    if (
        rules.ownDescription &&
        defaults.title &&
        page.titles[0] === defaults.title
    )
        failures.push("has the site's default title");
    if (rules.summaryWords && page.summaryWords < rules.summaryWords)
        failures.push(
            `its text holds ${page.summaryWords} words, expected ${rules.summaryWords} or more`
        );
    if (rules.ownImage && !page.ogImages[0]) failures.push("no og:image");
    return failures;
}

/** Failures of robots.txt: reachable, names a sitemap, shuts nobody out by default. */
export function checkRobots({ status, text }) {
    if (status !== 200) return [`status ${status}`];
    const failures = [];
    if (!/^sitemap:\s*https?:\/\//im.test(text))
        failures.push("names no sitemap");
    const everyone = text
        .split(/\n\s*\n/)
        .find((group) => /^user-agent:\s*\*\s*$/im.test(group));
    if (!everyone) failures.push("has no group for every crawler");
    else if (/^disallow:\s*\/\s*$/im.test(everyone))
        failures.push("shuts every crawler out of the whole site");
    return failures;
}

/** The addresses a sitemap file lists. */
export function sitemapLocs(xml) {
    return all(xml, /<loc>([^<]+)<\/loc>/g).map((loc) =>
        loc.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    );
}

async function get(origin, path) {
    const response = await fetch(origin + path, {
        headers: { "user-agent": BROWSER, accept: "text/html,*/*" },
        redirect: "manual",
    });
    return {
        status: response.status,
        html: await response.text(),
        type: response.headers.get("content-type") || "",
        robotsHeader: response.headers.get("x-robots-tag") || "",
    };
}

/** Space paths from the deployment's own sitemap (first part that has any). */
async function spacesFromSitemap(origin, count) {
    const index = await get(origin, "/sitemap.xml");
    const parts = sitemapLocs(index.html).filter((loc) => /spaces-/.test(loc));
    for (const part of parts.slice(0, 4)) {
        const xml = await get(origin, new URL(part).pathname);
        const paths = sitemapLocs(xml.html)
            .filter((loc) => !/\.(png|jpe?g|webp|gif)(\?|$)/i.test(loc))
            .map((loc) => {
                const url = new URL(loc);
                return url.pathname + url.search;
            })
            .filter((path) => path.length > 1 && !path.startsWith("/sitemaps"));
        if (paths.length) return paths.slice(0, count);
    }
    return [];
}

export async function main(argv) {
    const origin = (argv.find((arg) => /^https?:\/\//.test(arg)) || "").replace(
        /\/+$/,
        ""
    );
    if (!origin) {
        console.error(
            "Usage: node scripts/seo-check.mjs <origin> [--space /path] [--profile /@name]"
        );
        return 2;
    }
    const option = (name) =>
        argv
            .map((arg, index) => (arg === name ? argv[index + 1] : null))
            .filter(Boolean);
    const spaces = option("--space");
    const profiles = option("--profile");
    if (!spaces.length) spaces.push(...(await spacesFromSitemap(origin, 3)));

    const home = await get(origin, "/");
    const homePage = readPage(home.html);
    // The home page's own description is not the site default, so read the
    // default from a page that has nothing of its own.
    const plain = readPage((await get(origin, "/destinations")).html);
    const defaults = {
        title: homePage.titles[0],
        description: plain.descriptions[0],
    };

    const pages = [
        ["home", "/"],
        ["page", "/about"],
        ["page", "/privacy"],
        ["app", "/studio"],
        ["doc", "/docs"],
        ["doc", "/docs/avatars"],
        ["faq", "/docs/what-is-oncyber"],
        ["template", "/destinations/x1"],
        ...spaces.map((path) => ["space", path]),
        ...profiles.map((path) => ["profile", path]),
        ["missing", "/this-link-does-not-exist-zz9"],
    ];
    let failed = 0;
    const line = (ok, label, detail = "") =>
        console.log(
            `${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`
        );

    for (const [kind, path] of pages) {
        const response = path === "/" ? home : await get(origin, path);
        // The default title belongs to the home page.
        const failures = checkPage(kind, path, response, {
            ...defaults,
            title:
                kind === "space" || kind === "profile" ? defaults.title : null,
        });
        if (failures.length) failed++;
        line(!failures.length, `${kind} ${path}`, failures.join("; "));
    }

    const robots = await get(origin, "/robots.txt");
    const robotsFailures = checkRobots({
        status: robots.status,
        text: robots.html,
    });
    if (robotsFailures.length) failed++;
    line(!robotsFailures.length, "robots.txt", robotsFailures.join("; "));

    const sitemap = await get(origin, "/sitemap.xml");
    const parts = sitemapLocs(sitemap.html);
    const sitemapOk = sitemap.status === 200 && parts.length >= 2;
    if (!sitemapOk) failed++;
    line(
        sitemapOk,
        "sitemap.xml",
        sitemapOk ? "" : `status ${sitemap.status}, ${parts.length} parts`
    );

    for (const path of ["/llms.txt", "/llms-full.txt"]) {
        const response = await get(origin, path);
        const ok =
            response.status === 200 &&
            response.type.includes("text/plain") &&
            response.html.startsWith("# ");
        if (!ok) failed++;
        line(ok, path, ok ? "" : `status ${response.status}, ${response.type}`);
    }

    if (/noindex/i.test(home.robotsHeader))
        console.log(
            "note the whole deployment answers X-Robots-Tag: noindex (expected on previews, never on production)"
        );
    console.log(failed ? `\n${failed} failed` : "\nAll checks passed");
    return failed ? 1 : 0;
}

if (
    process.argv[1] &&
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (err) => {
            console.error(err?.message || err);
            process.exit(2);
        }
    );
}
