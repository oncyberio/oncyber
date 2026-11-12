/** @jest-environment jsdom */
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import Headers, { fontPreloadsFor, SITE_TITLE } from "./headers";
import { siteOrigin } from "@utils/siteOrigin";

let mockRouter: { pathname: string; query: Record<string, string> };
jest.mock("next/router", () => ({ useRouter: () => mockRouter }));
jest.mock("next/head", () => ({
    __esModule: true,
    default: ({ children }) => <>{children}</>,
}));

beforeEach(() => {
    process.env.NEXT_PUBLIC_LICENSED_FONTS = "1";
});
afterAll(() => {
    delete process.env.NEXT_PUBLIC_LICENSED_FONTS;
});

function preloads(pathname: string, query: Record<string, string> = {}) {
    mockRouter = { pathname, query };
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<Headers />));
    const links = Array.from(
        container.querySelectorAll('link[rel="preload"]')
    ).map((link) => ({
        href: link.getAttribute("href"),
        as: link.getAttribute("as"),
        type: link.getAttribute("type"),
        crossOrigin: link.getAttribute("crossorigin"),
    }));
    act(() => root.unmount());
    return links;
}

test("world pages, including the lobby's hidden world frame, preload no font", () => {
    expect(preloads("/[slug]", { slug: "rift" })).toEqual([]);
    expect(
        preloads("/[slug]", { slug: "rift", __lobbyAttempt: "a".repeat(24) })
    ).toEqual([]);
    expect(preloads("/spaces/[id]", { id: "abc" })).toEqual([]);
    expect(preloads("/gl/[id]", { id: "abc" })).toEqual([]);
});

test("the landing and lobby preload the two Oncyber Sans files they show", () => {
    const landing = [
        {
            href: "/fonts/licensed/Aeonik-Regular.otf",
            as: "font",
            type: "font/otf",
            crossOrigin: "",
        },
        {
            href: "/fonts/licensed/Aeonik-Medium.otf",
            as: "font",
            type: "font/otf",
            crossOrigin: "",
        },
    ];
    expect(preloads("/")).toEqual(landing);
    expect(preloads("/", { lobby: "1" })).toEqual(landing);
    expect(preloads("/landing-carousel")).toEqual(landing);
});

test("other pages, and profile pages under /[slug], keep the previous 15", () => {
    for (const links of [
        preloads("/studio"),
        preloads("/[slug]", { slug: "@artist" }),
    ]) {
        expect(links).toHaveLength(15);
        expect(new Set(links.map((link) => link.href)).size).toBe(15);
        expect(links[0]).toEqual({
            href: "/fonts/licensed/Aeonik-Air.otf",
            as: "font",
            type: "font/otf",
            crossOrigin: "",
        });
        expect(links[14].type).toBe("font/ttf");
    }
});

test("without a router it falls back to the previous set", () => {
    expect(fontPreloadsFor(undefined)).toHaveLength(15);
});

test("a build without the licensed fonts preloads only the open ones", () => {
    delete process.env.NEXT_PUBLIC_LICENSED_FONTS;
    expect(preloads("/")).toEqual([]);
    const other = preloads("/studio").map((link) => link.href);
    expect(other).toHaveLength(5);
    expect(other.every((href) => href.startsWith("/fonts/SpaceGrotesk/"))).toBe(
        true
    );
});

test("Space Grotesk preloads the WOFF2 files that globals.css uses", () => {
    delete process.env.NEXT_PUBLIC_LICENSED_FONTS;
    const links = preloads("/studio");
    expect(links.map((link) => link.href)).toEqual([
        "/fonts/SpaceGrotesk/SpaceGrotesk-Light.woff2",
        "/fonts/SpaceGrotesk/SpaceGrotesk-Regular.woff2",
        "/fonts/SpaceGrotesk/SpaceGrotesk-Medium.woff2",
        "/fonts/SpaceGrotesk/SpaceGrotesk-SemiBold.woff2",
        "/fonts/SpaceGrotesk/SpaceGrotesk-Bold.woff2",
    ]);
    expect(links.every((link) => link.type === "font/woff2")).toBe(true);
    const css = require("fs").readFileSync(
        require("path").join(__dirname, "../../styles/globals.css"),
        "utf8"
    );
    for (const { href } of links)
        expect(css).toContain(`url("${href}") format("woff2")`);
});

function renderedHead(pathname = "/") {
    mockRouter = { pathname, query: {} };
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<Headers />));
    const meta = (selector: string) =>
        container.querySelector(selector)?.getAttribute("content");
    const result = {
        title: container.querySelector("title")?.textContent,
        ogTitle: meta('meta[property="og:title"]'),
        twitterTitle: meta('meta[name="twitter:title"]'),
        ogImage: meta('meta[property="og:image"]'),
        twitterImage: meta('meta[name="twitter:image"]'),
        twitterCard: meta('meta[name="twitter:card"]'),
    };
    act(() => root.unmount());
    return result;
}

test("the site title and link preview use the oncyber: forever card", () => {
    const head = renderedHead();
    expect(SITE_TITLE).toBe("oncyber: forever");
    expect(head.title).toBe(SITE_TITLE);
    expect(head.ogTitle).toBe(SITE_TITLE);
    expect(head.twitterTitle).toBe(SITE_TITLE);
    expect(head.twitterCard).toBe("summary_large_image");
    expect(head.ogImage).toMatch(/^https?:\/\/.+\/brand\/share-card\.png$/);
    expect(head.twitterImage).toBe(head.ogImage);
});

test("the preview image URL is absolute for each deployment", () => {
    expect(
        siteOrigin({
            VERCEL_ENV: "production",
            VERCEL_PROJECT_PRODUCTION_URL: "oncyber.io",
        })
    ).toBe("https://oncyber.io");
    expect(siteOrigin({ VERCEL_ENV: "production" })).toBe("https://oncyber.io");
    expect(
        siteOrigin({
            VERCEL_ENV: "preview",
            VERCEL_BRANCH_URL: "oncyber-git-x-oncyber.vercel.app",
            VERCEL_URL: "oncyber-abc123-oncyber.vercel.app",
        })
    ).toBe("https://oncyber-git-x-oncyber.vercel.app");
    expect(siteOrigin({})).toBe("http://localhost:13000");
});
