/** @jest-environment jsdom */
import {
    groupDestinationHref,
    readLobbyGroupCohort,
} from "./lobbyGroupContext";
import { initializeLobbyDestinationBridge } from "./lobbyDestinationBridge";
jest.mock("./lobbyDestinationBridge", () => ({
    initializeLobbyDestinationBridge: jest.fn(),
}));
afterEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, "", "/");
});
test("one travel produces one shared cohort while preserving the destination path", () => {
    expect(
        groupDestinationHref(
            "/gallery?view=1",
            "travel-1234567890123",
            window.location.origin
        )
    ).toBe("/gallery?view=1&lobbyGroupCohort=travel-1234567890123");
    expect(() =>
        groupDestinationHref(
            "https://outside.example/world",
            "travel-1234567890123",
            window.location.origin
        )
    ).toThrow("same-origin");
});
test("only a validated parent preparation context forwards the native cohort", () => {
    window.history.replaceState({}, "", "/gallery?lobbyGroupCohort=travel-1234567890123");
    (initializeLobbyDestinationBridge as jest.Mock).mockReturnValue(null);
    expect(readLobbyGroupCohort()).toBeUndefined();
    (initializeLobbyDestinationBridge as jest.Mock).mockReturnValue({
        attempt: "validated-attempt",
    });
    expect(readLobbyGroupCohort()).toBe("travel-1234567890123");
    window.history.replaceState(
        {},
        "",
        "/gallery?lobbyGroupCohort=bad%2Fcontext"
    );
    expect(readLobbyGroupCohort()).toBeUndefined();
});
