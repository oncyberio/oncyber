/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SpaceList } from "./SpaceList";
import { deleteExhibit } from "@utils/saveToDb";
import ExhibitService from "@api/exhibit/_api";
import { showConfirm } from "@components/Dialogs";

const mockMutate = jest.fn();
const spaces = [
    { id: "current", info: { headline: "Current world" } },
    { id: "other", info: { headline: "Other world" } },
];

jest.mock("../context/StudioContext", () => ({
    useStudioMenu: () => ({
        exhibit: { id: "current" },
        baseAnalyticsEvent: {},
    }),
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({
        user: { id: "me" },
        token: "t",
    }),
}));
jest.mock("@utils/saveToDb", () => ({
    deleteExhibit: jest.fn(),
    duplicateSpace: jest.fn(),
    leaveSpace: jest.fn(),
}));
jest.mock("@api/exhibit/_api", () => ({
    __esModule: true,
    default: { duplicate: jest.fn() },
}));
jest.mock("@components/Dialogs", () => ({
    showConfirm: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("./useUserSpaces", () => ({
    useUserSpaces: () => ({
        ownedSpaces: spaces,
        collabSpaces: [],
        shownSpaces: spaces,
        queryData: spaces,
        isLoading: false,
        error: null,
        mutate: mockMutate,
    }),
}));
// Each world's menu becomes plain buttons named after its actions.
jest.mock("./SpaceActions", () => ({
    SpaceActions: ({ handleAction }) => (
        <>
            <button onClick={() => handleAction("delete")}>delete</button>
            <button onClick={() => handleAction("duplicate")}>duplicate</button>
        </>
    ),
}));
jest.mock("../components/ExhibitPicture", () => ({
    ExhibitPicture: () => null,
}));
jest.mock("@features/studio/utils", () => ({
    getSpaceStatus: () => "Draft",
}));
jest.mock("@features/onboarding/context/OnboardingContext", () => ({
    useOnboarding: () => ({}),
}));
jest.mock("next/router", () => ({ useRouter: () => ({}) }));
jest.mock("@components/forms/Input", () => ({
    Input: (props) => <input onChange={props.onChange} />,
}));
jest.mock("@ui/components/Spinner", () => ({
    __esModule: true,
    default: () => <span>Working…</span>,
}));
jest.mock("@ui/components/IconImg", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("@ui/icons/Plus", () => ({ __esModule: true, default: () => null }));

beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

function mount() {
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
        root.render(
            <SpaceList onCreateSpace={jest.fn()} onChangeSpace={jest.fn()} />
        )
    );
    const click = async (label: string, index = 0) => {
        const button = [...host.querySelectorAll("button")].filter(
            (it) => it.textContent === label
        )[index];
        await act(async () => {
            button.click();
        });
    };
    return { host, root, click };
}

it("says a failed delete under the world and retries it without asking again", async () => {
    (deleteExhibit as jest.Mock)
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ success: true });
    jest.spyOn(console, "error").mockImplementation(() => {});

    const { host, root, click } = mount();

    // The second world's delete (the current one cannot be deleted in the
    // real menu; here both rows render the same buttons).
    await click("delete", 1);

    const alert = host.querySelector('[role="alert"]');
    expect(alert.textContent).toContain("Couldn't delete this world.");
    expect(showConfirm).toHaveBeenCalledTimes(1);

    await click("Retry");

    expect(deleteExhibit).toHaveBeenCalledTimes(2);
    expect(deleteExhibit).toHaveBeenLastCalledWith("t", "other");
    expect(showConfirm).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(mockMutate).toHaveBeenCalledWith([spaces[0]]);

    act(() => root.unmount());
});

it("says a refused duplicate under that world only", async () => {
    (ExhibitService.duplicate as jest.Mock).mockResolvedValueOnce({
        success: false,
    });

    const { host, root, click } = mount();

    await click("duplicate", 0);

    const alerts = host.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toContain("Couldn't duplicate this world.");
    // It sits in the first world's row.
    expect(alerts[0].parentElement.textContent).toContain("Current world");
    expect(alerts[0].parentElement.textContent).not.toContain("Other world");

    act(() => root.unmount());
});
