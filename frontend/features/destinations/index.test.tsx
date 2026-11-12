/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import DestinationsPage from "./index";
import { UserContext } from "@components/context/UserContext";
const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
let mockScene: any;
let mockRoomsState: any;
let mockProviderMounts = 0;
const mockRefetch = jest.fn();
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("@utils/analytics", () => ({
    setCookie: jest.fn(),
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("next/head", () => () => null);
jest.mock("next/dynamic", () => (loader) => {
    if (!String(loader).includes("Scene"))
        return () => <div role="dialog">Sign in modal</div>;
    return (props) => {
        mockScene = props;
        return (
            <section hidden={!props.active} aria-label={props.browseLabel}>
                {props.cards.map((card) => (
                    <button
                        key={card.id}
                        onClick={() => props.onCardActivate(card)}
                    >
                        {card.title}
                    </button>
                ))}
                <button onClick={props.onCreate}>{props.createLabel}</button>
                {props.viewControls}
            </section>
        );
    };
});
jest.mock("@features/landing-carousel/components/Header", () => ({
    __esModule: true,
    default: ({ menu, search }) => (
        <header>
            {menu}
            {search}
        </header>
    ),
}));
jest.mock(
    "@features/spaces/create/components/DestinationSelector/useRooms",
    () => ({
        useRooms: () => mockRoomsState,
        RoomsProvider: ({ children }) => {
            require("react").useEffect(() => {
                mockProviderMounts++;
            }, []);
            return children;
        },
    })
);
jest.mock(
    "@features/spaces/create/components/DestinationSelector/Uploader/UploaderProvider",
    () => ({ UploaderProvider: ({ children }) => children })
);
jest.mock("./components/DestinationDetails", () => ({
    __esModule: true,
    default: ({ room, onClose }) => (
        <div role="dialog">
            Managing {room.name}
            <button onClick={onClose}>Close details</button>
        </div>
    ),
}));
jest.mock("./components/UploadDestination", () => ({
    __esModule: true,
    default: ({ onClose }) => (
        <div role="dialog">
            Gallery GLB and Kitbash uploads
            <button onClick={onClose}>Close uploads</button>
        </div>
    ),
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
let identity: any;
beforeEach(() => {
    mockScene = null;
    mockProviderMounts = 0;
    mockRefetch.mockClear();
    identity = {
        user: { id: "user-1" },
        token: "token-1",
        authenticated: true,
    };
    mockRoomsState = {
        rooms: [
            {
                _id: "1",
                slug: "one",
                name: "My upload",
                status: "tested",
                params: {},
            },
            {
                _id: "2",
                slug: "two",
                name: "My published gallery",
                status: "active",
                params: {},
            },
        ],
        isLoadinUploads: false,
        loadingError: null,
        refetchRooms: mockRefetch,
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    render();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});
function render() {
    act(() =>
        root.render(
            <UserContext.Provider value={identity}>
                <DestinationsPage />
            </UserContext.Provider>
        )
    );
}
function button(text: string) {
    return Array.from(container.querySelectorAll("button")).find(
        (element) => element.textContent.trim() === text
    );
}
function click(text: string) {
    act(() => {
        const target = button(text);
        Simulate.click(target);
        if (target.type === "submit" && target.form)
            Simulate.submit(target.form);
    });
}

it("opens the shared grid in 2×2, changes density and opens management without navigation", () => {
    expect(mockScene.cards.map((card) => card.destinationStatus)).toEqual([
        "Testing",
        "Published",
    ]);
    expect(mockScene.columns).toBe(2);
    click("1×1");
    expect(mockScene.columns).toBe(1);
    click("My upload");
    expect(container.querySelector('[role="dialog"]').textContent).toContain(
        "Managing My upload"
    );
    expect(mockScene.interactionsBlocked).toBe(true);
    click("Close details");
    expect(mockScene.interactionsBlocked).toBe(false);
});
it("filters on typing and restores destinations when clearing search", () => {
    const input = container.querySelector("input");
    act(() =>
        Simulate.change(input, { target: { value: "published" } } as any)
    );
    expect(mockScene.cards.map((card) => card.id)).toEqual(["two"]);
    act(() => Simulate.change(input, { target: { value: "nothing" } } as any));
    expect(container.textContent).toContain("No matching destinations.");
    click("Show all destinations");
    expect(mockScene.cards.length).toBe(2);
});
it("applies status filters without losing contract and distribution options", () => {
    click("Filters");
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("Community Ethereum");
    expect(dialog.textContent).toContain("Self claim tokens");
    const label = Array.from(dialog.querySelectorAll("label")).find(
        (element) => element.textContent === "Published / deployed"
    );
    act(() =>
        Simulate.change(label.querySelector("input"), {
            target: { checked: true },
        } as any)
    );
    click("Apply filters");
    expect(mockScene.cards.map((card) => card.id)).toEqual(["two"]);
});
it("keeps uploading available and displays retry after a load error", () => {
    click("Upload destination");
    expect(container.textContent).toContain("Gallery GLB and Kitbash uploads");
    click("Close uploads");
    mockRoomsState = {
        ...mockRoomsState,
        rooms: [],
        loadingError: "Failed to load",
    };
    render();
    expect(container.querySelector('[role="alert"]').textContent).toContain(
        "Couldn’t load your destinations."
    );
    click("Try again");
    expect(mockRefetch).toHaveBeenCalledTimes(1);
});
it("remounts the upload provider on identity changes and unmounts private data on logout", () => {
    expect(mockProviderMounts).toBe(1);
    identity = { ...identity, user: { id: "user-2" } };
    render();
    expect(mockProviderMounts).toBe(2);
    identity = { user: null, token: null, authenticated: false };
    render();
    expect(container.textContent).toContain(
        "Sign in to manage your uploaded and published destinations."
    );
    expect(container.textContent).not.toContain("My upload");
});
it("signs in from the empty page with the blue action", () => {
    identity = { user: null, token: null, authenticated: false };
    render();
    const empty = container.querySelector('main [role="status"]');
    expect(empty.querySelector("h2").textContent).toBe(
        "Your destinations, in one place."
    );
    const signIn = button("Sign in");
    expect(empty.contains(signIn)).toBe(true);
    expect(signIn.getAttribute("data-variant")).toBe("blue");
    expect(container.textContent).not.toContain("Sign in modal");
    click("Sign in");
    expect(container.textContent).toContain("Sign in modal");
});
it("offers the upload as the one white action when there is nothing yet", () => {
    mockRoomsState = { ...mockRoomsState, rooms: [] };
    render();
    const empty = container.querySelector('main [role="status"]');
    expect(empty.textContent).toContain("Your next destination starts here.");
    const actions = empty.querySelectorAll("button");
    expect(actions).toHaveLength(1);
    expect(actions[0].textContent.trim()).toBe("Upload destination");
    expect(actions[0].getAttribute("data-variant")).toBe("white");
});
