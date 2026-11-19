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

test.each([
    [
        "the space's own size",
        { avatarSize: 0.8 },
        { avatarSize: 0.2286 },
        "0.8",
    ],
    ["the destination's size", {}, { avatarSize: 0.2286 }, "0.2286"],
    ["0.5 when neither has one", {}, {}, "0.5"],
])("it shows %s", (_name, space, destination, shown) => {
    mockSpace = space;
    mockDestination = destination;
    open();

    expect(sizeInput().value).toBe(shown);
});

test("a size the owner types is saved to the space", () => {
    mockDestination = { avatarSize: 0.2286 };
    open();
    type("0.4");
    wait();

    expect(mockStore.updateExhibitParams).toHaveBeenCalledTimes(1);
    expect(mockStore.updateExhibitParams).toHaveBeenCalledWith({
        avatarSize: 0.4,
    });
});

test("an emptied field saves nothing", () => {
    open();
    type("");
    wait();

    expect(mockStore.updateExhibitParams).not.toHaveBeenCalled();
});
