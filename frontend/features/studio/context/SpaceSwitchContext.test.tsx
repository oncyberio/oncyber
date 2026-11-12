/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UserContext } from "@components/context/UserContext";
import { getExhibitById } from "@utils/csr";
import { getCinematic, getDestination, updateUser } from "@utils/saveToDb";
import { SpaceSwitchNotice } from "../components/SpaceSwitchNotice";
import { SpaceSwitchProvider, useSpaceSwitch } from "./SpaceSwitchContext";

const spaceA = { id: "a", info: { room: "room-a" } } as any;
const spaceB = { id: "b", info: { room: "room-b" } } as any;
const spaceC = { id: "c", info: { room: "room-c" } } as any;

const mockWorld = {
    current: { setState: jest.fn(), loadSpace: jest.fn() },
};
const mockRouter = { pathname: "/studio" };
const mockExhibitContext = {
    exhibit: spaceA,
    setExhibit: jest.fn(),
    setDestination: jest.fn(),
};
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    APP_STATES: { EXIT: "EXIT", INTRO: "INTRO", SPACE: "SPACE" },
}));
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: () => mockWorld,
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("next/router", () => ({ useRouter: () => mockRouter }));
jest.mock("@utils/csr", () => ({ getExhibitById: jest.fn() }));
jest.mock("@utils/saveToDb", () => ({
    getDestination: jest.fn(),
    getCinematic: jest.fn(),
    updateUser: jest.fn(),
}));
jest.mock("./ExhibitContext", () => ({
    useCurrentExhibit: () => mockExhibitContext,
}));

const fetchExhibit = getExhibitById as jest.Mock;
const fetchDestination = getDestination as jest.Mock;
const fetchCinematic = getCinematic as jest.Mock;
const pointAccount = updateUser as jest.Mock;
const { setState: engineState, loadSpace } = mockWorld.current;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let api: ReturnType<typeof useSpaceSwitch>;
function Probe() {
    api = useSpaceSwitch();
    return null;
}

function mount() {
    act(() =>
        root.render(
            <UserContext.Provider
                value={{ token: "token", user: { id: "me" } } as any}
            >
                <SpaceSwitchProvider>
                    <Probe />
                    <SpaceSwitchNotice />
                </SpaceSwitchProvider>
            </UserContext.Provider>
        )
    );
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    // jsdom under jest has no structuredClone.
    (globalThis as any).structuredClone ??= (value) =>
        JSON.parse(JSON.stringify(value));
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockRouter.pathname = "/studio";
    engineState.mockResolvedValue(undefined);
    loadSpace.mockReset().mockResolvedValue({ scene: "loaded" });
    fetchExhibit.mockImplementation(async (id) => ({
        id,
        info: { room: `room-${id}` },
        fresh: true,
    }));
    fetchDestination.mockImplementation(async (slug) => ({ slug }));
    fetchCinematic.mockResolvedValue({ success: true, cinematic: "cine" });
    pointAccount.mockResolvedValue({ success: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    mount();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const failure = () => container.querySelector('[role="alert"]');
const button = (name: string) =>
    Array.from(container.querySelectorAll("button")).find(
        (element) => element.textContent === name
    );
const click = (name: string) => act(async () => button(name).click());
const open = async (target, isAnon?: boolean) => {
    let opened: boolean;
    await act(async () => {
        opened = await api.switchTo(target, isAnon);
    });
    return opened;
};
const engineStates = () => engineState.mock.calls.map(([state]) => state);
const BACK = "Back to the previous space";

it("opens the space and says nothing", async () => {
    expect(await open(spaceB)).toBe(true);
    expect(engineStates()).toEqual(["EXIT", "INTRO", "SPACE"]);
    const fresh = { id: "b", info: { room: "room-b" }, fresh: true };
    expect(mockExhibitContext.setExhibit).toHaveBeenCalledWith(fresh);
    expect(mockExhibitContext.setDestination).toHaveBeenCalledWith({
        slug: "room-b",
    });
    expect(engineState).toHaveBeenLastCalledWith("SPACE", {
        roomParameters: { slug: "room-b" },
        exhibit: fresh,
        space: { scene: "loaded" },
        cinematic: "cine",
    });
    expect(api.state).toEqual({ status: "idle" });
    expect(failure()).toBeNull();
});

it("keeps the intro up with the failure, and Retry runs the same switch", async () => {
    loadSpace.mockRejectedValueOnce(new Error("glb did not load"));
    expect(await open(spaceB)).toBe(false);
    // The engine left the old space and is still on its intro.
    expect(engineStates()).toEqual(["EXIT", "INTRO"]);
    expect(failure().textContent).toBe("Couldn't open this space.Retry");
    expect(button(BACK)).toBeTruthy();
    expect(api.state).toMatchObject({
        status: "failed",
        target: spaceB,
        from: spaceA,
    });

    await click("Retry");
    expect(fetchExhibit.mock.calls).toEqual([["b"], ["b"]]);
    expect(engineStates()).toEqual(["EXIT", "INTRO", "EXIT", "INTRO", "SPACE"]);
    expect(failure()).toBeNull();
    expect(button(BACK)).toBeUndefined();
    expect(api.state).toEqual({ status: "idle" });
});

it("puts the failure away while the retry runs, and shows it again if that fails", async () => {
    loadSpace.mockRejectedValueOnce(new Error("glb did not load"));
    await open(spaceB);
    let fail: (error: Error) => void;
    loadSpace.mockReturnValueOnce(
        new Promise((_resolve, reject) => (fail = reject))
    );
    await click("Retry");
    expect(api.state.status).toBe("switching");
    expect(failure()).toBeNull();

    await act(async () => fail(new Error("still broken")));
    expect(failure().textContent).toBe("Couldn't open this space.Retry");
    // Still the way back to where they started, not to the failed space.
    expect(api.state).toMatchObject({ target: spaceB, from: spaceA });
});

it.each<[string, string, number]>([
    ["on /studio, and points the account back at it", "/studio", 1],
    [
        "on a space's own edit page, leaving the account alone",
        "/studio/edit/[id]",
        0,
    ],
])("goes back to the space they left %s", async (_name, pathname, calls) => {
    mockRouter.pathname = pathname;
    loadSpace.mockRejectedValueOnce(new Error("glb did not load"));
    await open(spaceB);
    pointAccount.mockClear();

    await click(BACK);
    expect(fetchExhibit).toHaveBeenLastCalledWith("a");
    expect(engineStates().slice(-3)).toEqual(["EXIT", "INTRO", "SPACE"]);
    expect(failure()).toBeNull();
    expect(api.state).toEqual({ status: "idle" });
    expect(pointAccount).toHaveBeenCalledTimes(calls);
    if (calls) {
        expect(pointAccount).toHaveBeenCalledWith(
            "token",
            { currentExhibitId: "a" },
            "me"
        );
    }
});

it("offers only Retry when going back is what failed", async () => {
    loadSpace.mockRejectedValue(new Error("offline"));
    await open(spaceB);
    await click(BACK);
    expect(failure().textContent).toBe("Couldn't open this space.Retry");
    expect(button(BACK)).toBeUndefined();
    expect(pointAccount).not.toHaveBeenCalled();
    expect(api.state).toMatchObject({ target: spaceA, from: spaceA });
});

it("offers a guest Retry only, and opens their space without fetching it", async () => {
    loadSpace.mockRejectedValueOnce(new Error("glb did not load"));
    expect(await open(spaceB, true)).toBe(false);
    expect(fetchExhibit).not.toHaveBeenCalled();
    expect(mockExhibitContext.setExhibit).toHaveBeenCalledWith(spaceB);
    expect(failure().textContent).toBe("Couldn't open this space.Retry");
    expect(button(BACK)).toBeUndefined();

    await click("Retry");
    expect(fetchExhibit).not.toHaveBeenCalled();
    expect(failure()).toBeNull();
});

it.each<[string, () => unknown]>([
    ["space", () => fetchExhibit.mockResolvedValueOnce(null)],
    ["destination", () => fetchDestination.mockResolvedValueOnce(null)],
])(
    "leaves the studio's exhibit alone when the %s does not load",
    async (_name, arrange) => {
        arrange();
        expect(await open(spaceB)).toBe(false);
        expect(mockExhibitContext.setExhibit).not.toHaveBeenCalled();
        expect(mockExhibitContext.setDestination).not.toHaveBeenCalled();
        expect(loadSpace).not.toHaveBeenCalled();
        expect(failure().textContent).toBe("Couldn't open this space.Retry");
    }
);

it("fails when the engine cannot leave the old space", async () => {
    engineState.mockRejectedValueOnce(new Error("engine"));
    expect(await open(spaceB)).toBe(false);
    expect(fetchExhibit).not.toHaveBeenCalled();
    expect(failure()).not.toBeNull();
});

it("runs one switch at a time", async () => {
    let finish: (space: unknown) => void;
    loadSpace.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    let first: Promise<boolean>;
    await act(async () => {
        first = api.switchTo(spaceB);
    });
    expect(api.state).toMatchObject({ status: "switching", target: spaceB });

    expect(await open(spaceC)).toBe(false);
    expect(fetchExhibit).toHaveBeenCalledTimes(1);
    expect(api.state).toMatchObject({ status: "switching", target: spaceB });
    // Being turned away is not a failure of the switch that is running.
    expect(failure()).toBeNull();

    await act(async () => {
        finish({ scene: "loaded" });
        await first;
    });
    expect(await first).toBe(true);
    expect(api.state).toEqual({ status: "idle" });
});
