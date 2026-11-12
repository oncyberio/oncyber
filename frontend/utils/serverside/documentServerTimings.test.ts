/** @jest-environment node */
import { readDocumentServerTimings } from "./documentServerTimings";

function browser(
    serverTiming: { name: string; duration: number }[] | undefined,
    documentUrl = "https://oncyber.io/rift",
    currentUrl = "https://oncyber.io/rift"
) {
    const location = new URL(currentUrl) as unknown as Location;
    const performance = {
        getEntriesByType: (type: string) =>
            type === "navigation" ? [{ name: documentUrl, serverTiming }] : [],
    } as unknown as Performance;
    return { performance, location };
}

test("reads this document's server stages in rounded milliseconds", () => {
    expect(
        readDocumentServerTimings(
            browser([
                { name: "ssr_exhibit", duration: 120.46 },
                { name: "ssr_total", duration: 181.5 },
                { name: "cdn-cache", duration: 3 },
            ])
        )
    ).toEqual({ ssr_exhibit: 120, ssr_total: 182 });
});

test("is empty after an in-app navigation to another page", () => {
    expect(
        readDocumentServerTimings(
            browser(
                [{ name: "ssr_total", duration: 90 }],
                "https://oncyber.io/",
                "https://oncyber.io/rift?lobby=1"
            )
        )
    ).toEqual({});
});

test("is empty without the API, the header, or a window", () => {
    expect(readDocumentServerTimings(browser(undefined))).toEqual({});
    expect(readDocumentServerTimings({})).toEqual({});
    expect(readDocumentServerTimings()).toEqual({});
    const throwing = {
        performance: {
            getEntriesByType: () => {
                throw new Error("blocked");
            },
        } as unknown as Performance,
    };
    expect(readDocumentServerTimings(throwing)).toEqual({});
});
