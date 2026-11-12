import Head from "next/head";
import { useRouter } from "next/router";
import { baseTokens } from "@styles/tokens/base";

/**
 * Fonts preloaded at high priority: only those a page shows first.
 *
 * - World pages (and the lobby's hidden world frame) show a canvas first, so
 *   they preload no font; their interface fonts load when first used.
 * - The landing and the lobby (`/`, `/?lobby=1`) show Oncyber Sans regular
 *   and medium. The mono face (small hints) loads when used.
 * - Every other page keeps the previous set until each is audited. Their
 *   globals.css faces use `font-display: swap` with metric-matched fallbacks
 *   (docs/fonts.md), so a face that is not preloaded still shows once it
 *   arrives; the preloads only make it arrive sooner.
 */
const LANDING_FONTS = [
    baseTokens.font.files.regular,
    baseTokens.font.files.medium,
];

const OTHER_PAGE_FONTS = [
    "/fonts/licensed/Aeonik-Air.otf",
    "/fonts/licensed/Aeonik-AirItalic.otf",
    "/fonts/licensed/Aeonik-Thin.otf",
    "/fonts/licensed/Aeonik-Regular.otf",
    "/fonts/licensed/Aeonik-Medium.otf",
    "/fonts/licensed/Aeonik-Bold.otf",
    "/fonts/licensed/Aeonik-Black.otf",
    "/fonts/SpaceGrotesk/SpaceGrotesk-Light.woff2",
    "/fonts/SpaceGrotesk/SpaceGrotesk-Regular.woff2",
    "/fonts/SpaceGrotesk/SpaceGrotesk-Medium.woff2",
    "/fonts/SpaceGrotesk/SpaceGrotesk-SemiBold.woff2",
    "/fonts/SpaceGrotesk/SpaceGrotesk-Bold.woff2",
    "/fonts/licensed/PPNeueBit-Regular.ttf",
    "/fonts/licensed/PPNeueBit-Bold.ttf",
    "/fonts/licensed/PPEditorialNew-Regular.ttf",
];

const WORLD_ROUTES = ["/spaces/[id]", "/gl/[id]"];
const LANDING_ROUTES = ["/", "/landing-carousel"];

// Licensed fonts are fetched at build time (docs/fonts.md); forks skip them,
// so their files are only preloaded when the build has them.
const isLicensed = (href: string) => href.startsWith("/fonts/licensed/");

function fontsForRoute(pathname: string, slug?: string | string[]): string[] {
    if (WORLD_ROUTES.includes(pathname)) return [];
    // `/[slug]` is a world, except `/@name`, which is a profile page.
    if (pathname === "/[slug]")
        return typeof slug === "string" && slug.startsWith("@")
            ? OTHER_PAGE_FONTS
            : [];
    if (LANDING_ROUTES.includes(pathname)) return LANDING_FONTS;
    return OTHER_PAGE_FONTS;
}

const fontType = (href: string) =>
    href.endsWith(".woff2")
        ? "font/woff2"
        : href.endsWith(".otf")
        ? "font/otf"
        : "font/ttf";

export function fontPreloadsFor(
    pathname: string,
    slug?: string | string[]
): string[] {
    const licensed = process.env.NEXT_PUBLIC_LICENSED_FONTS === "1";
    return fontsForRoute(pathname, slug).filter(
        (href) => licensed || !isLicensed(href)
    );
}

export const SITE_TITLE = "oncyber: forever";

// Link previews (X, iMessage, Slack, ...) need an absolute image URL. The
// image ships in public/, so it is served from the deployment that rendered
// the page (NEXT_PUBLIC_SITE_ORIGIN, set in next.config.js).
export const SHARE_IMAGE_PATH = "/brand/share-card.png";

export default function Headers() {
    const shareImage = `${
        process.env.NEXT_PUBLIC_SITE_ORIGIN || "http://localhost:13000"
    }${SHARE_IMAGE_PATH}`;
    const router = useRouter();
    return (
        <Head>
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover"
            />
            <link rel="manifest" href="/manifest.json" />
            {fontPreloadsFor(router?.pathname, router?.query?.slug).map(
                (href) => (
                    <link
                        key={`font-preload:${href}`}
                        rel="preload"
                        href={href}
                        as="font"
                        type={fontType(href)}
                        crossOrigin=""
                    />
                )
            )}
            <title key="title">{SITE_TITLE}</title>
            <meta
                key="description"
                name="description"
                content="A multiverse for creators, oncyber is the easiest way for artists and collectors to show their digital assets (NFTs) in fully immersive experiences (3D/VR), for free."
            />
            <meta key="ogTitle" property="og:title" content={SITE_TITLE} />
            <meta
                key="ogDescription"
                property="og:description"
                content="A digital world for creators, oncyber is the easiest way for artists and collectors to show their digital assets (NFTs) in fully immersive experiences (3D/VR), for free."
            />
            <meta key="ogImage" property="og:image" content={shareImage} />
            <meta key="ogImageWidth" property="og:image:width" content="1200" />
            <meta
                key="ogImageHeight"
                property="og:image:height"
                content="630"
            />
            <meta
                key="ogImageType"
                property="og:image:type"
                content="image/png"
            />
            <meta
                key="twitterImage"
                name="twitter:image"
                content={shareImage}
            />
            <meta
                key="twitterCard"
                name="twitter:card"
                content="summary_large_image"
            />
            <meta
                key="twitterTitle"
                name="twitter:title"
                content={SITE_TITLE}
            />
            <meta
                key="twitterDescription"
                name="twitter:description"
                content="A digital world for creators, oncyber is the easiest way for artists and collectors to show their digital assets (NFTs) in fully immersive experiences (3D/VR), for free."
            />
        </Head>
    );
}
