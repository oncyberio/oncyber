// AnimationMixer only writes a property when the sampled value changes.
// Keep its local rotations separate from the contact and recoil rotations
// that the renderer sees at the end of each frame.
export function createPoseSampler(bones, mixer) {
    const base = bones.map((bone) => bone.quaternion.clone());
    return function sample(seconds) {
        for (let i = 0; i < bones.length; i++)
            bones[i].quaternion.copy(base[i]);
        mixer.update(seconds);
        for (let i = 0; i < bones.length; i++)
            base[i].copy(bones[i].quaternion);
    };
}
