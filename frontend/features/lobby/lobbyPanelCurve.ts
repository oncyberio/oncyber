import { lobbyTokens } from "@styles/tokens/lobby";

/** Shared convex cylinder for the dock's card pickers. Layout stays untransformed. */
export function getLobbyCardCurve(
    offset: number,
    viewportWidth: number,
    cardWidth: number
) {
    const { edgeAngle: edgeDeg, maxAngle, viewportInset } = lobbyTokens.curve;
    const edgeAngle = (edgeDeg * Math.PI) / 180;
    const limit = Math.sin((maxAngle * Math.PI) / 180);
    const radius =
        Math.max(cardWidth, (viewportWidth - viewportInset - cardWidth) / 2) /
        Math.sin(edgeAngle);
    const angle = Math.asin(Math.max(-limit, Math.min(limit, offset / radius)));
    return {
        turn: (angle * 180) / Math.PI,
        depth: radius * (Math.cos(angle) - Math.cos(edgeAngle)),
    };
}
