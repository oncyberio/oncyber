type ReflectorMode = "reveal" | "dissolve";

export interface WorldReflectorRevealOptions {
    sources?: readonly any[];
    mode?: ReflectorMode;
}

const REVEAL_START = 0.65;
const DISSOLVE_FINISH = 0.3;
const clamp = (value: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const smoothstep = (value: number) => value * value * (3 - 2 * value);

function isNativeWater(source: any) {
    const material = source?.material;
    return (
        source?.isMesh === true &&
        material?.isNodeMaterial === true &&
        material.name === "WaterMaterial" &&
        material.transparent === true &&
        Number.isFinite(material.uniforms?.alpha?.value)
    );
}

/** Native planar reflectors need their original mirror camera/render hook
 * (the TSL reflector node's updateBefore). Fade their authored opacity as the room settles instead of hiding the shader
 * until the last tile. The caller excludes supportedSources from tile effects.
 * This adapter allocates no geometry, materials, render targets or render hooks. */
export function createWorldReflectorReveal(
    options: WorldReflectorRevealOptions
) {
    const mode = options.mode ?? "reveal";
    const seen = new Set<any>();
    const records: Array<{
        source: any;
        uniform: { value: number };
        opacity: number;
        visible: boolean;
    }> = [];
    for (const source of options.sources ?? []) {
        if (!source || seen.has(source)) continue;
        seen.add(source);
        const material = source.material;
        // Native water (factory/water) is a custom shader the tiles cannot
        // cut either; without this it vanished at the first frame of a
        // departure and popped in at the end of an arrival. It fades the same
        // way through its alpha uniform.
        if (isNativeWater(source)) {
            records.push({
                source,
                uniform: material.uniforms.alpha,
                opacity: material.uniforms.alpha.value,
                visible: source.visible,
            });
            continue;
        }
        const uniform = material?.uniforms?.opacity;
        if (
            source.isMesh !== true ||
            source.isReflector !== true ||
            material?.isNodeMaterial !== true ||
            material.transparent !== true ||
            !Number.isFinite(uniform?.value) ||
            // TSL reflector(): the node's value is the mirror render target.
            !material.uniforms.tDiffuse?.value?.isTexture ||
            // The cyber-city shader uses fixed alpha, ignoring opacity.
            Object.prototype.hasOwnProperty.call(
                material.defines ?? {},
                "CYBER_CITY"
            )
        )
            continue;
        records.push({
            source,
            uniform,
            opacity: uniform.value,
            visible: source.visible,
        });
    }
    let disposed = false;
    let opacity = mode === "reveal" ? 0 : 1;
    const setProgress = (value: number) => {
        if (disposed) return;
        const progress = clamp(value);
        opacity =
            mode === "dissolve"
                ? 1 - smoothstep(clamp(progress / DISSOLVE_FINISH))
                : smoothstep(
                      clamp((progress - REVEAL_START) / (1 - REVEAL_START))
                  );
        for (const record of records) {
            record.uniform.value = record.opacity * opacity;
            record.source.visible = record.visible && opacity > 0;
        }
    };
    setProgress(0);
    return {
        supportedSources: records.map(({ source }) => source),
        stats: {
            sources: records.length,
            /** Fade multiplier; each reflector retains its authored opacity. */
            get opacity() {
                return opacity;
            },
        },
        setProgress,
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const record of records) {
                record.uniform.value = record.opacity;
                record.source.visible = record.visible;
            }
            records.length = 0;
        },
    };
}
