import { inferContentKind, resolveEmbeddedRuntime } from "./runtime";

test("preserves AWE draft selection and chooses renderer-only embed", () => {
    const runtime = resolveEmbeddedRuntime(
        {
            kind: "awe-app",
            url: "https://awe.box/play/DmFRffk2waOgtkemeAyt?draft=true&ref=discard#private",
        },
        "https://oncyber.io"
    );
    expect(runtime.url).toBe(
        "https://awe.box/play/DmFRffk2waOgtkemeAyt?draft=true&embed=oncyber"
    );
    expect(runtime.readyOn).toBe("message");
    expect(runtime.capabilities).toEqual([]);
    expect(inferContentKind(runtime.url)).toBe("awe-app");
});
test("arbitrary engines stay URLs; capability declarations are strict", () => {
    expect(
        resolveEmbeddedRuntime(
            {
                kind: "web",
                url: "https://games.example/three/",
                engine: "WebGPU",
                capabilities: ["wallet.connect"],
            },
            "https://oncyber.io"
        )
    ).toEqual({
        kind: "web",
        url: "https://games.example/three/",
        engine: "WebGPU",
        capabilities: ["wallet.connect"],
    });
    expect(() =>
        resolveEmbeddedRuntime(
            {
                kind: "web",
                url: "https://games.example",
                capabilities: ["eth_sendTransaction"],
            },
            "https://oncyber.io"
        )
    ).toThrow();
});
test("rejects provider and host origins masquerading as an AWE app", () => {
    for (const url of [
        "https://awe.box.evil.test/play/id",
        "https://awe.box/studio/id",
        "https://awe.box:444/play/id",
        "https://oncyber.io/a-game",
        "javascript:alert(1)",
    ])
        expect(() =>
            resolveEmbeddedRuntime(
                { kind: "awe-app", url },
                "https://oncyber.io"
            )
        ).toThrow();
});

test("rehosts existing and new AWE attachments without rewriting saved links", () => {
    const host = "https://oncyber.com";
    const player = "https://worlds.example";
    for (const draft of [false, true]) {
        const search = draft ? "draft=true&embed=oncyber" : "embed=oncyber";
        const input = {
            kind: "awe-app",
            url: `https://www.awe.box/play/world-4?${search}&token=discard#fragment`,
        };
        const registered = resolveEmbeddedRuntime(input, host);
        expect(registered.url).toBe(
            `https://www.awe.box/play/world-4?${search}`
        );
        for (const descriptor of [input, registered])
            expect(
                resolveEmbeddedRuntime(descriptor, host, false, player)
            ).toEqual({
                ...registered,
                url: `${player}/play/world-4?${search}`,
            });
    }
    const web = { kind: "web", url: "https://other.example/world" };
    expect(resolveEmbeddedRuntime(web, host, false, player).url).toBe(web.url);
});

test("requires a separate player origin and validates the original attachment", () => {
    const host = "https://oncyber.com";
    const world = { kind: "awe-app", url: "https://awe.box/play/id" };
    for (const origin of [
        host,
        "http://player.example",
        "https://user@player.example",
        "https://player.example/path",
        "https://player.example/?query",
        "https://player.example/#fragment",
    ])
        expect(() =>
            resolveEmbeddedRuntime(world, host, false, origin)
        ).toThrow();
    expect(() =>
        resolveEmbeddedRuntime(
            { ...world, url: "https://elsewhere.example/play/id" },
            host,
            false,
            "https://player.example"
        )
    ).toThrow();
});
