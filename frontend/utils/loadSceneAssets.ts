/** Load independent assets together, but settle both before session teardown. */
export async function loadSceneAssets<Player, Space>(
    loadPlayer: () => Promise<Player>,
    loadSpace: () => Promise<Space>
): Promise<[Player, Space]> {
    const [player, space] = await Promise.allSettled([
        Promise.resolve().then(loadPlayer),
        Promise.resolve().then(loadSpace),
    ]);
    // A fail-fast Promise.all would let cleanup race the other asset loader.
    if (player.status === "rejected") throw player.reason;
    if (space.status === "rejected") throw space.reason;
    return [player.value, space.value];
}
