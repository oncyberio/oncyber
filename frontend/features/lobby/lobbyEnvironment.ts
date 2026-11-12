/** Shared art direction for both renderer graphs. Shader colors are linear RGB. */
export const LOBBY_ENVIRONMENT = {
    background: "#050607",
    clear: [0.001518, 0.001821, 0.002125] as const,
    floor: [0.0025, 0.003, 0.0036] as const,
    grid: [0.009, 0.01, 0.012] as const,
    gridSpacing: 2,
    gridFadeStart: 8,
    gridFadeEnd: 44,
    floorFadeStart: 22,
    floorFadeEnd: 72,
    fogNear: 32,
    fogFar: 76,
};
