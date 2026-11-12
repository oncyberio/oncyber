const { hash } = require("../../cloud-functions/artist-index/core");
function runConfig(values, ids, taskCount) {
    const assetLimit =
        values["asset-limit"] === undefined
            ? null
            : Number(values["asset-limit"]);
    if (!Number.isSafeInteger(taskCount) || taskCount < 1)
        throw Error("Invalid task count");
    if (
        assetLimit !== null &&
        (!Number.isSafeInteger(assetLimit) || assetLimit < 1)
    )
        throw Error("Asset limit must be a positive integer");
    if (values.artwork && !values.gallery)
        throw Error("--artwork requires --gallery");
    if (values.gallery && values.manifest)
        throw Error("Select either --gallery or --manifest");
    if (values["stored-only"] && !values["artists-only"])
        throw Error("--stored-only requires --artists-only");
    const config = {
        version: 1,
        project: values.project,
        bucket: values.bucket,
        selectionHash: hash(ids),
        selected: ids.length,
        taskCount,
        artistsOnly: !!values["artists-only"],
        // Preserve the configuration hashes of existing enriched/media runs.
        ...(values["stored-only"] ? { storedOnly: true } : {}),
        assetLimit,
        artwork: values.artwork || null,
    };
    return { ...config, configHash: hash(config) };
}
async function bindRun(db, run, config) {
    await db.runTransaction(async (tx) => {
        const existing = (await tx.get(run)).data();
        if (existing && existing.configHash !== config.configHash)
            throw Error(
                "Run configuration differs from its saved checkpoint; use a new --run ID"
            );
        if (!existing) tx.set(run, { ...config, createdAt: Date.now() });
    });
}
module.exports = { runConfig, bindRun };
