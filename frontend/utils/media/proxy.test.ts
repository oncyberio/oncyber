import { relay, fixCloudinaryBehindProxy } from "../urlUtils";
jest.mock("@env", () => ({ nodeEnv: { POLAR_SAMA: "/api/proxyv2?url=" } }));
jest.mock("../js", () => ({
    clamp: (v, min, max) => Math.max(min, Math.min(v, max)),
}));
test("proxy URLs preserve nested transformations and signed query parameters", () => {
    const source =
        "https://example.test/art%20name.png?w=256&format=webp&signature=a%2Bb#frame";
    const proxied = relay(source);
    expect(new URL(proxied, "https://oncyber.io").searchParams.get("url")).toBe(
        source
    );
    expect(fixCloudinaryBehindProxy(proxied)).toBe(source);
    expect(fixCloudinaryBehindProxy("/api/proxyv2?url=" + source)).toBe(source);
});
