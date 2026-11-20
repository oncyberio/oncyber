// Run with: node --test scripts/seo-check.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import {
    checkPage,
    checkRobots,
    isProductionOrigin,
    readPage,
    sitemapLocs,
} from "./seo-check.mjs";

const page = ({
    title = "Frahm Gallery",
    description = "Premium frames.",
    canonical = "https://www.oncyber.com/frahm-gallery",
    head = "",
    body = "",
    types = ["WebPage", "CreativeWork", "BreadcrumbList"],
} = {}) => `<html><head>
<title>${title}</title>
<meta name="description" content="${description}"/>
${canonical ? `<link rel="canonical" href="${canonical}"/>` : ""}
<meta property="og:image" content="https://example.com/hero.png"/>
<script type="application/ld+json">${JSON.stringify({
    // Nested, as a breadcrumb is inside its page.
    "@graph": [
        {
            "@type": types[0],
            parts: types.slice(1).map((type) => ({ "@type": type })),
        },
    ],
})}</script>
${head}</head><body>
<section aria-label="About this space"><h1>Frahm Gallery</h1>
<p>3D space by <a href="/@frahm">@frahm</a> on oncyber. Premium frames for the metaverse.</p></section>
${body}</body></html>`;

test("reads a page's tags, structured data and text", () => {
    const read = readPage(page());
    assert.deepEqual(read.titles, ["Frahm Gallery"]);
    assert.deepEqual(read.canonicals, [
        "https://www.oncyber.com/frahm-gallery",
    ]);
    assert.deepEqual(read.h1, ["Frahm Gallery"]);
    assert.ok(read.types.includes("CreativeWork"));
    assert.ok(read.summaryWords >= 10);
    assert.equal(read.summaryLinks, 1);
});

test("a space page with everything passes", () => {
    assert.deepEqual(
        checkPage("space", "/frahm-gallery", { status: 200, html: page() }),
        []
    );
});

test("a space page says what it lost", () => {
    const failures = checkPage(
        "space",
        "/frahm-gallery",
        {
            status: 200,
            html: page({
                title: "oncyber: forever",
                description: "The default.",
                canonical: "",
                types: ["WebPage"],
            })
                .replace(/<section[\s\S]*?<\/section>/, "")
                .replace(/<meta property="og:image"[^>]*>/, ""),
        },
        { title: "oncyber: forever", description: "The default." }
    );
    assert.deepEqual(failures, [
        "0 canonical tags",
        "no CreativeWork in the structured data",
        "no BreadcrumbList in the structured data",
        "no h1",
        "has the site's default description",
        "has the site's default title",
        "its text holds 0 words, expected 8 or more",
        "no og:image",
    ]);
});

test("two description tags, a wrong canonical or broken data fail", () => {
    const failures = checkPage("page", "/about", {
        status: 200,
        html: page({
            canonical: "https://www.oncyber.com/",
            head: '<meta name="description" content="Again"/><script type="application/ld+json">{oops</script>',
        }),
    });
    assert.deepEqual(failures, [
        "2 description tags",
        "structured data does not parse",
        "canonical is /, expected /about",
    ]);
});

test("a missing link must answer 404, unindexed, with no canonical", () => {
    const missing = page({
        canonical: "",
        head: '<meta name="robots" content="noindex"/>',
    });
    assert.deepEqual(
        checkPage("missing", "/nope", { status: 404, html: missing }),
        []
    );
    assert.deepEqual(
        checkPage("missing", "/nope", { status: 200, html: missing }),
        ["status 200, expected 404"]
    );
    assert.deepEqual(
        checkPage("missing", "/nope", { status: 404, html: page() }),
        ["should be noindex", "has a canonical"]
    );
});

test("an indexable page must not be noindex", () => {
    assert.deepEqual(
        checkPage("page", "/about", {
            status: 200,
            html: page({
                canonical: "https://www.oncyber.com/about",
                head: '<meta name="robots" content="noindex, nofollow"/>',
            }),
        }),
        ["is noindex"]
    );
});

test("robots.txt must name a sitemap and let crawlers in", () => {
    const good =
        "User-agent: *\nDisallow: /templates\n\nUser-agent: Bytespider\nDisallow: /\n\nSitemap: https://www.oncyber.com/sitemap.xml\n";
    assert.deepEqual(checkRobots({ status: 200, text: good }), []);
    assert.deepEqual(
        checkRobots({ status: 200, text: "User-agent: *\nDisallow: /\n" }),
        ["names no sitemap", "shuts every crawler out of the whole site"]
    );
    assert.deepEqual(checkRobots({ status: 404, text: "" }), ["status 404"]);
});

test("reads the addresses a sitemap lists", () => {
    assert.deepEqual(
        sitemapLocs(
            "<urlset><url><loc>https://www.oncyber.com/a?x=1&amp;y=2</loc></url><url><loc>https://www.oncyber.com/b</loc></url></urlset>"
        ),
        ["https://www.oncyber.com/a?x=1&y=2", "https://www.oncyber.com/b"]
    );
});

test("knows the production site from a preview", () => {
    assert.equal(isProductionOrigin("https://www.oncyber.com"), true);
    assert.equal(isProductionOrigin("https://oncyber.io/"), true);
    assert.equal(
        isProductionOrigin("https://oncyber-git-branch-oncyber.vercel.app"),
        false
    );
    assert.equal(isProductionOrigin("http://localhost:13000"), false);
    assert.equal(isProductionOrigin("not a url"), false);
});

test("a canonical must be on the deployment or a production domain", () => {
    const origins = {
        canonicalOrigins: [
            "https://preview.example",
            "https://oncyber.io",
            "https://www.oncyber.com",
        ],
    };
    const at = (canonical) =>
        checkPage(
            "page",
            "/about",
            { status: 200, html: page({ canonical }) },
            origins
        );
    assert.deepEqual(at("https://oncyber.io/about"), []);
    assert.deepEqual(at("https://preview.example/about"), []);
    assert.deepEqual(at("https://other.example/about"), [
        "canonical is on https://other.example",
    ]);
});

test("on production, no page meant for search may answer the noindex header", () => {
    const response = {
        status: 200,
        html: page({ canonical: "https://oncyber.io/about" }),
        robotsHeader: "noindex",
    };
    assert.deepEqual(
        checkPage("page", "/about", response, { production: true }),
        ["answers X-Robots-Tag: noindex"]
    );
    // A preview answers it on every page.
    assert.deepEqual(checkPage("page", "/about", response), []);
});
