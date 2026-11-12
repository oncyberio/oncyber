/** CC0 is an explicit development audition; the default is the original set. */
export function useCC0MotionPreview() {
    return (
        process.env.NODE_ENV === "development" &&
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("motionPack") === "cc0"
    );
}

export async function loadCC0MotionPreview(
    fetchAsset: (url: string) => Promise<ArrayBuffer>
) {
    const [{ decodeCC0LocomotionPack }, coreBytes, jumpBytes, defaultBytes] =
        await Promise.all([
            import("./cc0LocomotionPack"),
            fetchAsset("/lobby/cc0/quaternius-core.c66c3d2a7450.lcp"),
            fetchAsset("/lobby/cc0/quaternius-jump.8983c8916396.lcp"),
            fetchAsset("/lobby/locomotion/core.0e2fa3a1be67.lcp"),
        ]);
    const core = decodeCC0LocomotionPack(coreBytes).clips;
    const jump = decodeCC0LocomotionPack(jumpBytes).clips;
    const defaults = decodeCC0LocomotionPack(defaultBytes).clips;
    // Use the same three gait bands in either comparison set.
    return {
        IDLE: core.IDLE,
        IDLE_ONCYBER: defaults.IDLE_ONCYBER,
        IDLE_RELAXED: { ...defaults.IDLE, name: "IDLE_RELAXED" },
        WALK: core.WALK,
        RUN: { ...core.JOG, name: "RUN" },
        SPRINT: { ...core.RUN, name: "SPRINT" },
        JUMP: jump.JUMP,
    };
}

/** Animation-only packs decode once and share the existing retarget/bake caches. */
export async function loadDefaultMotion(
    fetchAsset: (url: string) => Promise<ArrayBuffer>
) {
    const [{ decodeCC0LocomotionPack }, core, air] = await Promise.all([
        import("./cc0LocomotionPack"),
        fetchAsset("/lobby/locomotion/core.0e2fa3a1be67.lcp"),
        fetchAsset("/lobby/locomotion/air.2dccf421740f.lcp"),
    ]);
    return {
        ...decodeCC0LocomotionPack(core).clips,
        ...decodeCC0LocomotionPack(air).clips,
    };
}
