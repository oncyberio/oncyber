/** Select only authored derivatives; compressed variants need decoder support. */
export function selectModelVariant(
    files,
    {
        isMobile = false,
        compressedSupport = false,
        preferLowResolution = false,
        fromEdit = false,
    } = {}
) {
    if (!files) return;
    const lowFirst = isMobile || (preferLowResolution && !fromEdit);
    const low = [compressedSupport && files.low_compressed, files.low];
    return (lowFirst ? [...low, files.high] : [files.high, ...low]).find(
        (url) => typeof url === "string" && url.trim().length > 0
    );
}
