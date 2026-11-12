import { IDLE, IDLE_CC0 } from "../factory/player/instanceavatarvrm/constants";

/** A temporary return pose, shared with the lobby's post-teleport ready idle. */
export function nativeTravelIdleAction(avatar: any) {
    if (!avatar?.travelReadyIdle) return undefined;
    // Arrival keeps its ready pose until the first real movement. Back/departure
    // holds omit this flag and continue to own the animation while input is held.
    if (
        avatar.travelReadyIdleUntilMovement &&
        (Math.abs(avatar.floorVelocity || 0) >= 0.012 ||
            Math.abs(avatar.smoothedFloorVelocity || 0) >= 0.012 ||
            avatar.isJumping ||
            avatar.onFloor === false)
    ) {
        avatar.travelReadyIdle = false;
        avatar.travelReadyIdleUntilMovement = false;
        return undefined;
    }
    const available = (name: string) =>
        avatar.isHighQuality
            ? !!avatar.vrm?.possibleActions?.[name]
            : (avatar.metaIds?.[0]?.indexOf(name) ?? -1) >= 0;
    return available(IDLE_CC0.name)
        ? IDLE_CC0
        : available(IDLE.name)
        ? IDLE
        : undefined;
}

/** Select once and keep advancing the existing mixer/baked clock on each hold. */
export function holdNativeTravelIdle(avatar: any, immediate = false) {
    if (!avatar) return;
    avatar.travelReadyIdle = true;
    avatar.onFloor = true;
    avatar.isJumping = false;
    avatar.floorVelocity = avatar.smoothedFloorVelocity = 0;
    if (typeof avatar.emoteResolve === "function") avatar.stopEmote?.();
    avatar.emote = -1;
    avatar.currentEmote = null;
    avatar.emoteResolve = null;
    const action = nativeTravelIdleAction(avatar);
    if (action) avatar.setCurrentAction?.(action);
    if (!immediate || !action) return;
    if (avatar.isHighQuality) {
        const actions = avatar.vrm?.possibleActions;
        const selected = actions?.[action.name];
        if (!selected) return;
        for (const other of Object.values(actions) as any[])
            other
                .stopFading()
                .stopWarping()
                .setEffectiveWeight(other === selected ? 1 : 0);
        selected.enabled = true;
        selected.paused = false;
        selected.setEffectiveTimeScale(1);
        if (!selected.isRunning()) selected.play();
        selected.getMixer().update(0);
        avatar.vrm.vrm?.update(0);
    } else {
        const index = avatar.metaIds?.[0]?.indexOf(action.name);
        if (index >= 0) {
            avatar.currentAnimationIndex = index;
            avatar.animations = [index, index, avatar.animations?.[2] || 0, 0];
        }
    }
}

/** Read the rendered phase, not a new clock started when the host receives it. */
export function readNativeTravelIdleTime(avatar: any, animationTimer: number) {
    if (avatar?.currentAction?.name !== IDLE_CC0.name) return undefined;
    if (avatar.isHighQuality) {
        const time = avatar.vrm?.possibleActions?.[IDLE_CC0.name]?.time;
        return Number.isFinite(time)
            ? ((time % IDLE_CC0.duration) + IDLE_CC0.duration) %
                  IDLE_CC0.duration
            : undefined;
    }
    if (!Number.isFinite(animationTimer)) return undefined;
    // The native atlas bakes at 30 Hz, starting at 1/30s. Its shader loops all
    // but the final frame and samples with floor(timer / (1/30)).
    const loopFrames = Math.max(
        1,
        Math.floor(IDLE_CC0.duration / (1 / 30)) - 1
    );
    const frame =
        ((Math.floor(animationTimer / (1 / 30)) % loopFrames) + loopFrames) %
        loopFrames;
    return (frame + 1) / 30;
}
