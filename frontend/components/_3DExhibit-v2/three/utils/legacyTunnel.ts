import {
    isLobbyDestination,
    isLobbyDestinationPreparing,
} from "@utils/lobbyDestinationBridge";

type LegacyTunnel = {
    preload: () => Promise<unknown>;
    setState: (state: any, options: any) => Promise<unknown>;
};

/** The lobby owns arrival presentation; do not create its competing worker. */
export async function preloadLegacyTunnel(tunnel: LegacyTunnel) {
    if (isLobbyDestinationPreparing()) return;
    await tunnel.preload();
}

export async function setLegacyTunnelState(
    tunnel: LegacyTunnel,
    state: any,
    options: any
) {
    if (isLobbyDestinationPreparing()) return false;
    const finished = await tunnel.setState(state, options);
    // Completion can outlive preparation. Never let an old tunnel restore a
    // camera over the lobby's staged or handed-off travel camera.
    return !!finished && !isLobbyDestination();
}
