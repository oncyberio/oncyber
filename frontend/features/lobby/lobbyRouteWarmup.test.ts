import { lobbyDataUrl } from "./lobbyRouteWarmup";

test("lobby data URL matches the one the pages router requests", () => {
    // Seen in the browser: /_next/data/<build>/en.json?lobby=1
    expect(lobbyDataUrl("https://o.test", "abc", "en")).toBe(
        "https://o.test/_next/data/abc/en.json?lobby=1"
    );
    expect(lobbyDataUrl("https://o.test", "abc")).toBe(
        "https://o.test/_next/data/abc/index.json?lobby=1"
    );
    expect(lobbyDataUrl("https://o.test", "")).toBeNull();
});
