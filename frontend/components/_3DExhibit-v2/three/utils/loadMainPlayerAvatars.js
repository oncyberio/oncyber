import { markNativeStartup } from "@utils/nativeStartupDiagnostics";

/** Both meshes must be ready before player creation, but their downloads and
 * worker animation bakes are independent. Keep fallback and pool ownership here. */
export async function loadMainPlayerAvatars(
    opts,
    { models, avatars, lodUrl, fallbackUrl, setDefaultVrm }
) {
    markNativeStartup("avatar-assets-start");
    const lod = async () => {
        if (models[lodUrl] == null) {
            await models.loadOnce({ name: lodUrl, url: lodUrl });
            avatars.getMesh({ userData: { VRM: lodUrl } });
        }
        markNativeStartup("avatar-lod-ready");
    };
    const lodReady = lod();
    const selected = async () => {
        try {
            if (opts.userData.VRM === lodUrl) await lodReady;
            else
                await models.loadOnce({
                    name: opts.userData.VRM,
                    url: opts.userData.VRM,
                });
        } catch (error) {
            if (!fallbackUrl || opts.userData.VRM === fallbackUrl) throw error;
            console.error(
                "Failed to load VRM, falling back to default",
                opts.userData.VRM,
                error
            );
            opts.userData.VRM = fallbackUrl;
            setDefaultVrm(fallbackUrl);
            await models.loadOnce({ name: fallbackUrl, url: fallbackUrl });
        }
        if (models[opts.userData.VRM]?.isHighQuality) {
            opts.userData.VRMMeshes = await models.requestPool(
                opts.userData.VRM
            );
            opts.userData.VRMMeshes.scene.poolUsed = true;
        }
        markNativeStartup("avatar-main-ready");
    };
    // Wait for both even on failure: session cleanup must not race a remaining
    // avatar bake/mesh allocation. Successful readiness takes the longer branch.
    const results = await Promise.allSettled([lodReady, selected()]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    markNativeStartup("avatar-assets-ready");
}
