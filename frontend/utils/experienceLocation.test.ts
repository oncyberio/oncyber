/** @jest-environment jsdom */
import {
    createHostedExperienceLocation,
    publicExperienceHref,
    replaceExperienceLocation,
} from "./experienceLocation";

test("a retained lobby tracks space, coordinates and facing, then restores its original entry", () => {
    const state = {
        __N: true,
        key: "lobby",
        as: "/?lobby=1",
        url: "/?lobby=1",
    };
    window.history.replaceState(state, "", "/?lobby=1");
    const location = createHostedExperienceLocation();
    location.update("/rayan?__lobbyAttempt=internal&coords=1x2x3x0.5");
    expect(window.location.pathname + window.location.search).toBe(
        "/rayan?coords=1x2x3x0.5"
    );
    expect(window.history.state).toEqual({
        ...state,
        as: "/rayan?coords=1x2x3x0.5",
        url: "/rayan?coords=1x2x3x0.5",
    });
    location.update("/crypto-trap-house?coords=4x5x6x1.2");
    expect(window.location.pathname).toBe("/crypto-trap-house");
    location.restore();
    expect(window.location.pathname + window.location.search).toBe("/?lobby=1");
    expect(window.history.state).toEqual(state);
});
test.each([
    "https://elsewhere.test/a",
    "//elsewhere.test/a",
    "/\\elsewhere.test/a",
    "javascript:alert(1)",
    null,
])("rejects unsafe public address %s", (href) => {
    expect(publicExperienceHref(href, window.location.origin)).toBeNull();
});
test("coordinate updates replace one history entry without route events", () => {
    const event = jest.fn();
    window.addEventListener("popstate", event);
    const length = window.history.length;
    replaceExperienceLocation("/rayan?coords=-1x2x3x-0.4");
    replaceExperienceLocation("/rayan?coords=-2x2x3x-0.4");
    expect(window.history.length).toBe(length);
    expect(event).not.toHaveBeenCalled();
    window.removeEventListener("popstate", event);
});
