import { AmbientLight, DirectionalLight } from "three/webgpu";
import { lights } from "three/tsl";

// Avatar-only lights: spaces keep their authored world lighting. Native rooms
// use legacyLights (which applies PI in the renderer); the lobby uses SI lights.
const profiles = new Map<number, ReturnType<typeof lights>>();
export function avatarLighting(lightScale = Math.PI) {
    let profile = profiles.get(lightScale);
    if (!profile) {
        const ambient = new AmbientLight(0xffffff, 0.42 * lightScale);
        const key = new DirectionalLight(0xffffff, 0.9 * lightScale);
        key.position.set(200, 200, 200);
        const rim = new DirectionalLight(0xe7edff, 0.22 * lightScale);
        rim.position.set(-8, 6, -10);
        for (const light of [ambient, key, rim]) light.updateMatrixWorld(true);
        profile = lights([ambient, key, rim]);
        profiles.set(lightScale, profile);
    }
    return profile;
}
export function isAvatarLighting(node: unknown) {
    return Array.from(profiles.values()).includes(node as any);
}
