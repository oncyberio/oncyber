import { preloadLegacyTunnel, setLegacyTunnelState } from "./legacyTunnel";

let mockPreparing = false;
let mockDestination = false;
jest.mock("@utils/lobbyDestinationBridge", () => ({
    isLobbyDestinationPreparing: () => mockPreparing,
    isLobbyDestination: () => mockDestination,
}));

const createTunnel = () => ({
    preload: jest.fn(async () => {}),
    setState: jest.fn(async (_state: string, _options: unknown) => true),
});

beforeEach(() => {
    mockPreparing = false;
    mockDestination = false;
});

test("lobby arrival creates no worker and never starts its activation or deactivation", async () => {
    mockPreparing = true;
    mockDestination = true;
    const tunnel = createTunnel();
    await preloadLegacyTunnel(tunnel);
    await expect(
        setLegacyTunnelState(tunnel, "intro", undefined)
    ).resolves.toBe(false);
    await expect(setLegacyTunnelState(tunnel, "space", {})).resolves.toBe(
        false
    );
    expect(tunnel.preload).not.toHaveBeenCalled();
    expect(tunnel.setState).not.toHaveBeenCalled();
});

test("suppressed arrival stays suppressed if entry finishes before its promise is observed", async () => {
    mockPreparing = true;
    mockDestination = true;
    const tunnel = createTunnel();
    const completion = setLegacyTunnelState(tunnel, "space", {});
    mockPreparing = false;
    await expect(completion).resolves.toBe(false);
    expect(tunnel.setState).not.toHaveBeenCalled();
});

test("ordinary entry still preloads and forwards its exact state and options", async () => {
    const tunnel = createTunnel();
    const options = { userData: { settings: { camera: "third_person" } } };
    await preloadLegacyTunnel(tunnel);
    await expect(setLegacyTunnelState(tunnel, "space", options)).resolves.toBe(
        true
    );
    expect(tunnel.preload).toHaveBeenCalledTimes(1);
    expect(tunnel.setState).toHaveBeenCalledWith("space", options);
});

test("ordinary unfinished transitions do not restore the entry camera", async () => {
    const tunnel = createTunnel();
    tunnel.setState.mockResolvedValue(false);
    await expect(
        setLegacyTunnelState(tunnel, "intro", undefined)
    ).resolves.toBe(false);
});

test.each([true, false])(
    "late completion cannot restore a lobby camera when preparing is %s",
    async (preparing) => {
        const tunnel = createTunnel();
        let finish: (value: boolean) => void;
        tunnel.setState.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        const completion = setLegacyTunnelState(tunnel, "space", {});
        mockDestination = true;
        mockPreparing = preparing;
        finish(true);
        await expect(completion).resolves.toBe(false);
    }
);

test("native artwork and portal states still update after lobby entry", async () => {
    mockDestination = true;
    const tunnel = createTunnel();
    await setLegacyTunnelState(tunnel, "transition", { highlight: true });
    await setLegacyTunnelState(tunnel, "space", {});
    expect(tunnel.setState).toHaveBeenNthCalledWith(1, "transition", {
        highlight: true,
    });
    expect(tunnel.setState).toHaveBeenNthCalledWith(2, "space", {});
});

test("ordinary preload and transition failures still propagate", async () => {
    const tunnel = createTunnel();
    const error = new Error("tunnel failed");
    tunnel.preload.mockRejectedValue(error);
    tunnel.setState.mockRejectedValue(error);
    await expect(preloadLegacyTunnel(tunnel)).rejects.toBe(error);
    await expect(setLegacyTunnelState(tunnel, "intro", undefined)).rejects.toBe(
        error
    );
});
