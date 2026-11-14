export const GRAPHICS = Object.freeze({
  high: Object.freeze({
    label: "High",
    pixelRatio: 2,
    pixelBudget: 3200000,
    samples: 4,
    edgeSmoothing: true,
    shadowMapSize: 2048,
    anisotropy: 8,
  }),
  balanced: Object.freeze({
    label: "Balanced",
    pixelRatio: 1.5,
    pixelBudget: 2100000,
    samples: 2,
    edgeSmoothing: false,
    shadowMapSize: 1024,
    anisotropy: 4,
  }),
});

export function graphicsProfile(mode, width, height, deviceRatio = 1) {
  const name = mode === "balanced" ? "balanced" : "high";
  const settings = GRAPHICS[name];
  const w = Math.max(1, Number.isFinite(width) ? width : 1);
  const h = Math.max(1, Number.isFinite(height) ? height : 1);
  const dpr = Math.max(1, Number.isFinite(deviceRatio) ? deviceRatio : 1);
  return {
    ...settings,
    name,
    pixelRatio: Math.min(
      dpr,
      settings.pixelRatio,
      Math.sqrt(settings.pixelBudget / (w * h))
    ),
  };
}

/** Only use sample counts supported for the render target's actual format. */
export function supportedSamples(available, desired) {
  return Math.max(
    0,
    ...Array.from(available || []).filter((n) => n <= desired)
  );
}
