import { CURRENT_SPACE } from "@3constants";
import ModelFactoryManager from "./modelmanager";
import { getAvatarAnimation } from "./avatarAnimations";

const pending = new Map();

export async function preloadAvatar(url) {
    if (!CURRENT_SPACE?.exhibit?.id || !url) return;
    const key = `${CURRENT_SPACE.exhibit.id}:${url}`;
    if (pending.has(key)) return pending.get(key);
    // Avoid flooding the connection while the pointer crosses the grid.
    if (pending.size >= 2) return;
    const promise = ModelFactoryManager.preload(url, {
        ...CURRENT_SPACE,
        fromEdit: true,
    })
        .then((gltf) => getAvatarAnimation(gltf, "avatar:idle"))
        .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
}
