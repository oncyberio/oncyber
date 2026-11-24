/** @jest-environment jsdom */
import { goToExperience, goToLobby } from "./experienceNavigation";

jest.mock("./lobbyDestinationBridge", () => ({
    requestLobbyDestinationBack: jest.fn(() => false),
}));
const mockTravel = jest.fn();
jest.mock("@features/worlds/worldDocument", () => ({
    worldDocument: () => ({ travel: mockTravel }),
}));

// A world in the site's frame cannot navigate anything but itself, so its
// ways out are requests to the page (features/worlds).
beforeEach(() => mockTravel.mockReset());

test("travel to another experience is asked of the page", () => {
    const navigate = jest.fn();
    goToExperience("/second-space", navigate);
    expect(mockTravel).toHaveBeenCalledWith("/second-space");
    expect(navigate).not.toHaveBeenCalled();
});

test("going to the lobby is asked of the page", () => {
    const fallback = jest.fn();
    goToLobby(fallback);
    expect(mockTravel).toHaveBeenCalledWith("/?lobby=1");
    expect(fallback).not.toHaveBeenCalled();
});
