// Native avatar pools can detach an entire parent without detaching the
// avatar itself. Weak references let the room discard that subtree normally.
const attached = new Set();

export function trackRoomInk(root) {
    const mesh = root.getObjectByProperty("isSkinnedMesh", true);
    if (!mesh) return;
    const ref = new WeakRef(mesh);
    root.addEventListener("added", () => attached.add(ref));
    root.addEventListener("removed", () => attached.delete(ref));
    if (root.parent) attached.add(ref);
}

export function hasRoomInk(scene, camera) {
    for (const ref of attached) {
        let object = ref.deref();
        if (!object) {
            attached.delete(ref);
            continue;
        }
        if (!camera.layers.test(object.layers)) continue;
        while (object?.visible) {
            if (object === scene) return true;
            object = object.parent;
        }
    }
    return false;
}
