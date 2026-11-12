/** @jest-environment jsdom */
import { publishNativeStartupDiagnostics } from "./nativeStartupDiagnostics";

const originalEnvironment = process.env.NODE_ENV;
const originalEntries = performance.getEntriesByType;
afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalEnvironment });
    Object.defineProperty(performance, "getEntriesByType", {
        configurable: true,
        value: originalEntries,
    });
});

test("exposes bounded SSR durations without header descriptions or unrelated metrics", () => {
    Object.assign(process.env, { NODE_ENV: "development" });
    Object.defineProperty(performance, "getEntriesByType", {
        configurable: true,
        value: (kind: string) =>
            kind === "navigation"
                ? [
                      {
                          type: "navigate",
                          responseStart: 5000,
                          serverTiming: [
                              {
                                  name: "ssr_exhibit",
                                  duration: 43.8,
                                  description: "private description",
                              },
                              { name: "account", duration: 2 },
                              { name: "ssr_bad-name", duration: 9 },
                          ],
                      },
                  ]
                : [],
    });
    const target = document.createElement("div");
    publishNativeStartupDiagnostics(target);
    const nav = JSON.parse(
        target.getAttribute("data-native-startup-navigation")
    );
    expect(nav.serverTiming).toEqual([{ name: "ssr_exhibit", duration: 44 }]);
    expect(nav.responseStart).toBe(5000);
    expect(target.outerHTML).not.toContain("private description");
});

test("remains absent in production", () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    const target = document.createElement("div");
    publishNativeStartupDiagnostics(target);
    expect(target.attributes).toHaveLength(0);
});
