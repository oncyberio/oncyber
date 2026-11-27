/**
 * Proof that something was drawn: three.js calls `onBeforeRender` on each
 * mesh it submits to the renderer, so a body that is hidden, detached or
 * culled leaves no mark. No renderer import, so games that draw avatars
 * with their own code can report the same fact.
 */
export function drawProbe() {
    let drawn = false;
    const mark = () => {
        drawn = true;
    };
    return {
        /** Watch every mesh under `object`. Call again after adding meshes. */
        watch(object) {
            object.traverse((o) => {
                if (o.isMesh) o.onBeforeRender = mark;
            });
        },
        /** True when a watched mesh was drawn since the last call. */
        take() {
            const was = drawn;
            drawn = false;
            return was;
        },
    };
}
