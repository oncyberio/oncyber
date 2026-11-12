/** @jest-environment jsdom */
import {
    beginWorldTravel,
    captureWorldTravelFrame,
    finishWorldTravel,
    pendingWorldTravel,
    markWorldTravelReady,
} from "./nativeWorldTravel";
import {
    goToExperience,
    registerExperienceDeparture,
} from "./experienceNavigation";
jest.mock("./lobbyDestinationBridge", () => ({
    requestLobbyDestinationBack: () => false,
}));
const view = {
    cameraOffset: { x: 0, y: 2, z: 4 },
    cameraTargetOffset: { x: 0, y: 1, z: 0 },
    avatarRotation: 0,
    avatarLift: 0,
    fov: 60,
};
const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};
afterEach(() => {
    finishWorldTravel();
    jest.restoreAllMocks();
});
test("exit completes before navigation; scene readiness releases arrival without an artwork fence", async () => {
    let exit: (view: any) => void;
    const unregister = registerExperienceDeparture(
        () =>
            new Promise((resolve) => {
                exit = resolve;
            })
    );
    const navigate = jest.fn(async () => true);
    goToExperience("/next", navigate);
    expect(navigate).not.toHaveBeenCalled();
    exit(view);
    await flush();
    expect(navigate).toHaveBeenCalledWith("/next");
    expect(pendingWorldTravel()).toMatchObject({
        view,
        ready: false,
        claimed: false,
    });
    markWorldTravelReady();
    expect(pendingWorldTravel()?.ready).toBe(true);
    expect(document.querySelector("[data-world-travel]")).not.toBeNull();
    finishWorldTravel();
    expect(document.querySelector("[data-world-travel]")).toBeNull();
    unregister();
});
test.each([false, new Error("route cancelled")])(
    "failed routing restores the old world and removes the cover",
    async (result) => {
        const restore = jest.fn();
        const unregister = registerExperienceDeparture(
            async () => view,
            restore
        );
        goToExperience("/next", () =>
            result === false ? Promise.resolve(false) : Promise.reject(result)
        );
        await flush();
        expect(restore).toHaveBeenCalledTimes(1);
        expect(pendingWorldTravel()).toBeUndefined();
        unregister();
    }
);
test("a late completion cannot remove a newer trip's cover", () => {
    const old = beginWorldTravel(view);
    const next = beginWorldTravel(view);
    finishWorldTravel(old);
    expect(pendingWorldTravel()).toBe(next);
});

test("captures the source in the render task and carries that frame across routing", () => {
    const source = document.createElement("canvas");
    source.width = 640;
    source.height = 480;
    const draw = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        drawImage: draw,
    } as any);
    const render = jest.fn();
    captureWorldTravelFrame(view, source, render);
    expect(render.mock.invocationCallOrder[0]).toBeLessThan(
        draw.mock.invocationCallOrder[0]
    );
    expect(draw).toHaveBeenNthCalledWith(1, source, 0, 0);
    beginWorldTravel(view, source);
    const preserved = draw.mock.calls[1][0];
    expect(preserved).not.toBe(source);
    expect(preserved.width).toBe(640);
    expect(preserved.height).toBe(480);
});
