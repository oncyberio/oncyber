/** @jest-environment jsdom */
import { readTransportStyle, readRevealStyle } from "./lobbyPreviewOptions";
beforeEach(() => sessionStorage.clear());
test("portal transport and sweep reveal can be selected independently", () => {
    history.replaceState(null, "", "/?travel=portal&reveal=sweep");
    expect(readTransportStyle()).toBe("portal");
    expect(readRevealStyle()).toBe("sweep");
});
test("reveal alone does not enable portal transport", () => {
    history.replaceState(null, "", "/?reveal=sweep");
    expect(readTransportStyle()).toBe("standard");
    expect(readRevealStyle()).toBe("sweep");
});
test("legacy travel=sweep remains supported", () => {
    history.replaceState(null, "", "/?travel=sweep");
    expect(readTransportStyle()).toBe("standard");
    expect(readRevealStyle()).toBe("sweep");
});

test("default remains cube reveals in and out even after trying a portal", () => {
    const { readWorldDepartureStyle } = require("./worldSweepReveal");
    sessionStorage.setItem("oncyber:preview:travel", "portal");
    history.replaceState(null, "", "/?lobby=1");
    expect(readTransportStyle()).toBe("standard");
    expect(readWorldDepartureStyle()).toBe("tiles");
    expect(readRevealStyle()).toBe("tiles");
    history.replaceState(null, "", "/?travel=portal");
    expect(readTransportStyle()).toBe("portal");
    expect(readRevealStyle()).toBe("tiles");
    history.replaceState(null, "", "/");
    expect(readTransportStyle()).toBe("standard");
});
