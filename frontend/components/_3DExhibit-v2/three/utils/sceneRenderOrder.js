// Transparent world batches sort by distance below this ceiling. Keep the
// artwork-focus veil above them, then draw the selected work and its particles.
export const SCENE_RENDER_ORDER = Object.freeze({
    transparentWorld: 2000,
    fade: 3000,
    artworkParticles: 3001,
    artwork: 3002,
});
