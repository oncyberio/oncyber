/** @jest-environment jsdom */
import React, { act, useReducer } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@components/context/UserContext", () => {
    const { createContext } = require("react");
    return {
        UserContext: createContext({}),
        USER_LOGIN: "USER_LOGIN",
    };
});
const mockLink: { visitor: jest.Mock; framed: boolean } = {
    visitor: jest.fn(),
    framed: true,
};
jest.mock("./worldDocument", () => ({
    worldDocument: () => (mockLink.framed ? mockLink : null),
}));

import { UserContext } from "@components/context/UserContext";
import { readTravelAvatar } from "@utils/travelAvatar";
import { useWorldVisitor } from "./useWorldVisitor";
import { readWorldVisitor } from "./worldVisitor";

const ada = readWorldVisitor({
    guest: false,
    name: "ada",
    pfp: "https://cdn.example/ada.png",
    avatarUrl: "https://cdn.example/ada.vrm",
    avatarId: "robot",
    avatarName: "Robot",
    avatarSize: 0.4,
});

let root: Root;
let host: HTMLDivElement;
let seen: { ready: boolean; userData: any; id?: string; token?: string }[];

/** A world page: the account state, and what started below it. */
function World({ framed }: { framed: boolean }) {
    const [state, dispatch] = useReducer(
        (current: any, action: any) => ({ ...current, ...action.payload }),
        { userData: null, user: { id: "" }, token: "" }
    );
    return (
        <UserContext.Provider
            value={{ ...state, dispatch, isAnonInitialized: true } as any}
        >
            <Scene framed={framed} />
        </UserContext.Provider>
    );
}
function Scene({ framed }: { framed: boolean }) {
    const { ready } = useWorldVisitor(framed);
    const { userData, user, token } = React.useContext(UserContext) as any;
    seen.push({ ready, userData, id: user?.id, token });
    return ready ? <div data-world>{userData?.username ?? "guest"}</div> : null;
}
const world = () => host.querySelector("[data-world]");
const render = (framed: boolean) =>
    act(async () => root.render(<World framed={framed} />));

beforeEach(() => {
    seen = [];
    sessionStorage.clear();
    mockLink.visitor.mockReset();
    mockLink.framed = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

test("outside a frame the world starts at once, as it always has", async () => {
    await render(false);
    expect(seen[0].ready).toBe(true);
    expect(mockLink.visitor).not.toHaveBeenCalled();
});

test("a framed world waits for its visitor, then starts as them", async () => {
    let say: (visitor: any) => void;
    mockLink.visitor.mockReturnValue(new Promise((resolve) => (say = resolve)));
    await render(true);
    expect(world()).toBeNull();

    await act(async () => say(ada));
    expect(world().textContent).toBe("ada");
    // the world never started as anyone else
    expect(seen.filter(({ ready }) => ready)).toEqual([
        {
            ready: true,
            userData: {
                username: "ada",
                avatar: "https://cdn.example/ada.png",
                settings: { default_vrm_scale: 0.4 },
            },
            id: "",
            token: "",
        },
    ]);
    // and finds their avatar where it looks for the one a visitor arrives with
    expect(readTravelAvatar(seen.at(-1).userData)).toMatchObject({
        id: "robot",
        url: "https://cdn.example/ada.vrm",
    });
});

test("a signed-in visitor's world knows who they are and holds a stand-in, never a session", async () => {
    mockLink.visitor.mockResolvedValue({
        ...ada,
        account: {
            id: "0xada",
            username: "ada",
            profile: {
                avatar: "https://cdn.example/ada.png",
                walletId: "0xada",
                settings: { quality: "high" },
            },
        },
    });
    await render(true);
    expect(seen.at(-1)).toEqual({
        ready: true,
        userData: {
            walletId: "0xada",
            username: "ada",
            avatar: "https://cdn.example/ada.png",
            settings: { quality: "high", default_vrm_scale: 0.4 },
        },
        id: "0xada",
        token: "page",
    });
});

test("a guest starts as the world's own guest, with the avatar they picked", async () => {
    mockLink.visitor.mockResolvedValue({ ...ada, guest: true });
    await render(true);
    expect(world().textContent).toBe("guest");
    expect(seen.at(-1).userData).toBeNull();
    expect(readTravelAvatar(null)).toMatchObject({ id: "robot" });
});

test("a page that names no one still lets the world start", async () => {
    mockLink.visitor.mockResolvedValue(null);
    await render(true);
    expect(world().textContent).toBe("guest");
    expect(readTravelAvatar(null)).toBeNull();
});

test("a world served with the world's role but in no frame starts as a guest", async () => {
    mockLink.framed = false;
    await render(true);
    expect(world().textContent).toBe("guest");
});
