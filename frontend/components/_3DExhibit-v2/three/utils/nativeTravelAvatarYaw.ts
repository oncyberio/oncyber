/** Native Wrapper.rotation adds a model-version offset that the lobby's raw
 * VRM scene does not. Travel views use the latter so the visible pose survives
 * a renderer handoff; camera yaw always stays in world coordinates. */
export function nativeTravelAvatarYawOffset(avatar?: { isVersion0?: boolean }) {
    return avatar && !avatar.isVersion0 ? Math.PI : 0;
}
