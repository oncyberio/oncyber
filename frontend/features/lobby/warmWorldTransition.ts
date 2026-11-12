/** Compile the intact room and animated tiles before either becomes visible.
 * Restore presentation synchronously after collecting each render list: a
 * native frame may run while the GPU compiles its pipelines asynchronously.
 * Only already-loaded geometry is visited; artwork downloads are never awaited. */
export async function warmWorldTransition(
    renderer: { compileAsync(scene: any, camera: any): Promise<unknown> },
    scene: any,
    camera: any,
    setProgress: (progress: number) => void,
    signal?: AbortSignal
) {
    for (const progress of [1, 0.5]) {
        if (signal?.aborted)
            throw new DOMException("Transition cancelled", "AbortError");
        const visibility: Array<[any, boolean, boolean]> = [];
        let compilation: Promise<unknown>;
        try {
            setProgress(progress);
            scene.traverse?.((object: any) => {
                if (!object.isMesh) return;
                let tile = false;
                for (let parent = object; parent; parent = parent.parent)
                    tile ||= parent.name === "native-world-cube-reveal";
                visibility.push([object, object.visible, object.frustumCulled]);
                if (progress === 0.5 && tile) object.visible = true;
                object.frustumCulled = false;
            });
            compilation = renderer.compileAsync(scene, camera);
        } finally {
            for (const [object, visible, culled] of visibility) {
                object.visible = visible;
                object.frustumCulled = culled;
            }
            setProgress(0);
        }
        await compilation;
    }
    if (signal?.aborted)
        throw new DOMException("Transition cancelled", "AbortError");
}
