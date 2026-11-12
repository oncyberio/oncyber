/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import EventSchedulerService from "@api/eventScheduler/_api";
import { showConfirm, showError } from "@components/Dialogs";
import { UserContext } from "@components/context/UserContext";
import Event from "./Event";

const mockToggleAuth = jest.fn();
jest.mock(
    "@api/eventScheduler/_api",
    () => ({
        __esModule: true,
        default: {
            deleteEvent: jest.fn(),
            sendNotification: jest.fn(),
            cancelNotification: jest.fn(),
        },
    }),
    { virtual: true }
);
jest.mock("@env", () => ({ nodeEnv: { PUBLIC_API: "https://oncyber.test" } }));
jest.mock("@components/Dialogs", () => ({
    showConfirm: jest.fn(),
    showError: jest.fn(),
}));
jest.mock("@components/context/HomeContext", () => ({
    useHome: () => ({ toggleAuth: mockToggleAuth }),
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({ user: { id: "" } }),
}));
jest.mock("@components/DesignSystem/buttons", () => ({
    RoundButton: ({ isLight, ...props }) => <button {...props} />,
}));
jest.mock("@utils/notifications", () => ({
    getNotificationSubscription: jest.fn(async () => {}),
    getAnonNotificationSubscription: jest.fn(async () => "device"),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@ui/components/Spinner", () => () => <i data-spinner="" />);
jest.mock("@ui/components/IconImg", () => ({ name }) => <i data-icon={name} />);
jest.mock("@ui/components/IconButton", () => ({
    IconButton: ({ name, onClick }) => (
        <button aria-label={name} onClick={onClick} />
    ),
}));
jest.mock("./Shape", () => () => null);
jest.mock("./SubscribedUsers", () => () => null);

const mockApi = EventSchedulerService as unknown as Record<
    "deleteEvent" | "sendNotification" | "cancelNotification",
    jest.Mock
>;
const confirm = showConfirm as jest.Mock;
const errorDialog = showError as jest.Mock;
const setEvents = jest.fn();

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

/** An event next week that `owner` created, seen by `viewer`. */
function mount(
    viewer: string,
    owner = "host",
    subscribedUsers = [],
    subscriptionNotificationId?: string
) {
    const now = Math.floor(Date.now() / 1000);
    act(() =>
        root.render(
            <UserContext.Provider value={{ user: { id: viewer } } as any}>
                <Event
                    id="event-1"
                    title="Opening night"
                    eventType="Party"
                    date={now + 7 * 86400}
                    endDate={now + 7 * 86400 + 3600}
                    exhibitId="space-1"
                    thumbnail=""
                    customLink=""
                    eventLocation="Warehouse"
                    userId={owner}
                    subscribedUsers={subscribedUsers}
                    subscriptionNotificationId={subscriptionNotificationId}
                    setEvents={setEvents}
                />
            </UserContext.Provider>
        )
    );
}
const button = (name: string) =>
    Array.from(container.querySelectorAll("button")).find(
        (element) =>
            element.textContent === name ||
            element.getAttribute("aria-label") === name
    );
const click = (element: Element) =>
    act(async () => (element as HTMLElement).click());
const spinner = () => container.querySelector("[data-spinner]");
const trash = () => container.querySelector('[data-icon="trash"]');
const failure = () => container.querySelector('[role="alert"]');
/** A request the test settles by hand. */
function held<T>() {
    let settle: { resolve: (value: T) => void; reject: (e: Error) => void };
    const promise = new Promise<T>(
        (resolve, reject) => (settle = { resolve, reject })
    );
    return { promise, ...settle };
}

describe("RSVP", () => {
    it("asks a signed-out visitor to sign in and does not look busy", async () => {
        mount("");
        await click(button("Subscribe Now"));
        expect(mockToggleAuth).toHaveBeenCalledTimes(1);
        expect(mockApi.sendNotification).not.toHaveBeenCalled();
        // It used to stay on "Loading…" until the page was reloaded.
        expect(button("Subscribe Now")).toBeTruthy();
        expect(button("Loading…")).toBeUndefined();

        // And it still answers the next click.
        await click(button("Subscribe Now"));
        expect(mockToggleAuth).toHaveBeenCalledTimes(2);
    });

    it("says Loading… only while the request is on its way", async () => {
        const request = held<{ success: boolean; notificationId: string }>();
        mockApi.sendNotification.mockReturnValueOnce(request.promise);
        mount("guest");
        await click(button("Subscribe Now"));
        expect(button("Loading…")).toBeTruthy();

        await act(async () =>
            request.resolve({ success: true, notificationId: "n-1" })
        );
        expect(button("Loading…")).toBeUndefined();
        // Subscribed: the button gives way to the bell.
        expect(button("bell-check")).toBeTruthy();
    });

    it("stops loading when subscribing fails, and says so", async () => {
        mockApi.sendNotification.mockRejectedValueOnce(new Error("offline"));
        mount("guest");
        await click(button("Subscribe Now"));
        expect(button("Subscribe Now")).toBeTruthy();
        expect(errorDialog).toHaveBeenCalledTimes(1);
        expect(errorDialog.mock.calls[0][0]).toContain("subscribe");
    });

    it("unsubscribes with the stored notification", async () => {
        mockApi.cancelNotification.mockResolvedValueOnce({ success: true });
        // The server returns only the viewer's own notification id.
        mount("guest", "host", [{ userId: "guest" }], "n-1");
        await click(button("bell-check"));
        expect(mockApi.cancelNotification).toHaveBeenCalledWith({
            eventId: "event-1",
            notificationId: "n-1",
        });
        expect(spinner()).toBeNull();
        expect(errorDialog).not.toHaveBeenCalled();
    });
});

describe("deleting", () => {
    it("is only offered to whoever created the event", () => {
        mount("guest");
        expect(trash()).toBeNull();
    });

    it("removes the event once the owner confirms", async () => {
        confirm.mockResolvedValueOnce(true);
        mockApi.deleteEvent.mockResolvedValueOnce({ success: true });
        mount("host");
        await click(trash().parentElement);
        expect(mockApi.deleteEvent).toHaveBeenCalledWith({
            eventId: "event-1",
        });
        const keep = setEvents.mock.calls[0][0];
        expect(keep([{ id: "event-1" }, { id: "event-2" }])).toEqual([
            { id: "event-2" },
        ]);
        expect(spinner()).toBeNull();
        expect(failure()).toBeNull();
    });

    it("does nothing when the owner says no", async () => {
        confirm.mockResolvedValueOnce(false);
        mount("host");
        await click(trash().parentElement);
        expect(mockApi.deleteEvent).not.toHaveBeenCalled();
        expect(spinner()).toBeNull();
        expect(failure()).toBeNull();
    });

    it.each<[string, () => unknown]>([
        [
            "the request fails",
            () => mockApi.deleteEvent.mockRejectedValueOnce(new Error("off")),
        ],
        [
            "the server refuses",
            () =>
                mockApi.deleteEvent.mockResolvedValueOnce({
                    success: false,
                    message: "Failed to delete event",
                }),
        ],
    ])(
        "stops spinning when %s, and Retry deletes without asking again",
        async (_name, arrange) => {
            confirm.mockResolvedValueOnce(true);
            arrange();
            mount("host");
            await click(trash().parentElement);
            // The spinner used to stay for good after a failed request.
            expect(spinner()).toBeNull();
            expect(trash()).not.toBeNull();
            expect(failure().textContent).toBe(
                "Couldn't delete the event.Retry"
            );
            expect(setEvents).not.toHaveBeenCalled();

            mockApi.deleteEvent.mockResolvedValueOnce({ success: true });
            await click(failure().querySelector("button"));
            expect(confirm).toHaveBeenCalledTimes(1);
            expect(mockApi.deleteEvent).toHaveBeenCalledTimes(2);
            expect(setEvents).toHaveBeenCalledTimes(1);
            expect(failure()).toBeNull();
        }
    );

    it("spins while the delete is running and ignores a second click", async () => {
        const request = held<{ success: boolean }>();
        confirm.mockResolvedValue(true);
        mockApi.deleteEvent.mockReturnValueOnce(request.promise);
        mount("host");
        await click(trash().parentElement);
        expect(spinner()).not.toBeNull();

        await click(spinner().parentElement);
        expect(confirm).toHaveBeenCalledTimes(1);

        await act(async () => request.resolve({ success: true }));
        expect(spinner()).toBeNull();
    });
});
