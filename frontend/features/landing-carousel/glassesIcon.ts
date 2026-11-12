import { baseTokens as base } from "@styles/tokens/base";

/**
 * CryptoPunks-style 3D glasses: white band with an even 1px rim, blue left
 * lens, red right lens. Built from tokens so the red lens is always the same
 * red as the Create accent.
 */
const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 4" shape-rendering="crispEdges">' +
    '<rect width="9" height="4" fill="#f0f0f0"/>' +
    `<rect x="1" y="1" width="3" height="2" fill="${base.color.anaglyphBlue}"/>` +
    `<rect x="5" y="1" width="3" height="2" fill="${base.color.accentCreate}"/>` +
    "</svg>";

export const GLASSES_ICON_URL = `data:image/svg+xml,${encodeURIComponent(svg)}`;
