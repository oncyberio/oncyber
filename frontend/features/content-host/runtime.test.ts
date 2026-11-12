import { inferContentKind, resolveEmbeddedRuntime } from "./runtime";

test("preserves AWE draft selection and chooses renderer-only embed", () => {
    const runtime = resolveEmbeddedRuntime(
        {
            kind: "awe-app",
            url: "https://awe.box/play/DmFRffk2waOgtkemeAyt?draft=true",
        },
        "https://oncyber.io"
    );
    expect(runtime.url).toBe(
        "https://awe.box/play/DmFRffk2waOgtkemeAyt?draft=true&embed=oncyber"
    );
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
