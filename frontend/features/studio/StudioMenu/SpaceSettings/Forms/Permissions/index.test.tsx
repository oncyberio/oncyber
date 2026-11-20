/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Permissions } from "./index";

const mockStore = { updateExhibitParams: jest.fn() };
let mockSpace: any;
let mockDestination: any;

jest.mock("@features/studio/context/ExhibitContext", () => ({
    useCurrentExhibit: () => ({
        exhibit: { params: mockSpace },
        destination: mockDestination,
        exhibitStore: mockStore,
        userRole: "owner",
        baseAnalyticsEvent: {},
    }),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@components/context/I18nContext", () => ({
    tx: (text: string) => text,
}));
jest.mock("@features/studio/components/Toggle", () => ({
    Toggle: () => null,
}));
jest.mock("@ui/components/Dropdown", () => ({
    __esModule: true,
    default: () => null,
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const open = () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Permissions />));
};

const sizeInput = () =>
    container.querySelector('input[type="number"]') as HTMLInputElement;

const type = (value: string) =>
    act(() => {
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
        ).set;
        setValue.call(sizeInput(), value);
        sizeInput().dispatchEvent(new Event("input", { bubbles: true }));
    });

const wait = () => act(() => jest.advanceTimersByTime(600));

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    mockStore.updateExhibitParams.mockReset();
    mockSpace = {};
    mockDestination = {};
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});

test("opening the tab saves no avatar size", () => {
    mockDestination = { avatarSize: 0.2286 };
    open();
    wait();

    expect(mockStore.updateExhibitParams).not.toHaveBeenCalled();
});

// The field is in metres; the saved size is 0 to 1 across 1 m to 4.5 m.
test.each([
    [
        "the space's own height",
        { avatarSize: 0.8 },
        { avatarSize: 0.2286 },
        "3.8",
    ],
    ["the destination's height", {}, { avatarSize: 0.2286 }, "1.8"],
    ["2.75 m when neither has one", {}, {}, "2.75"],
])("it shows %s", (_name, space, destination, shown) => {
    mockSpace = space;
    mockDestination = destination;
    open();

    expect(sizeInput().value).toBe(shown);
    expect(sizeInput().min).toBe("1");
    expect(sizeInput().max).toBe("4.5");
});

test("a height the owner types is saved to the space as a size", () => {
    mockDestination = { avatarSize: 0.2286 };
    open();
    type("1.7");
    wait();

    expect(mockStore.updateExhibitParams).toHaveBeenCalledTimes(1);
    expect(mockStore.updateExhibitParams).toHaveBeenCalledWith({
        avatarSize: 0.2,
    });
});

test("typing the height already shown saves nothing", () => {
    mockDestination = { avatarSize: 0.2286 };
    open();
    type("1.8");
    wait();

    expect(mockStore.updateExhibitParams).not.toHaveBeenCalled();
});

test("an emptied field saves nothing", () => {
    open();
    type("");
    wait();

    expect(mockStore.updateExhibitParams).not.toHaveBeenCalled();
});
