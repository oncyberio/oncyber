/** Resolve public glTF clip metadata to subtrees that must be sampled freshly.
 * Parent tracks move every descendant mesh, even when those meshes have no tracks.
 * Resolve within each clip owner's subtree, matching AnimationMixer bindings. */
export function getWorldTransitionAnimatedRoots(THREE: any, scene: any): any[] {
    const animated = new Set<any>();
    scene?.traverse?.((owner: any) => {
        for (const clip of owner.animations ?? []) {
            for (const track of clip.tracks ?? []) {
                try {
                    const binding = THREE.PropertyBinding.parseTrackName(
                        track.name
                    );
                    const target = THREE.PropertyBinding.findNode(
                        owner,
                        binding.nodeName
                    );
                    if (target) animated.add(target);
                } catch {
                    // Invalid optional metadata must not prevent scene travel.
                }
            }
        }
    });
    return [...animated].filter((target) => {
        for (let parent = target.parent; parent; parent = parent.parent)
            if (animated.has(parent)) return false;
        return true;
    });
}
