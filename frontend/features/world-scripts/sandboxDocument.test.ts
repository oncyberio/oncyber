import {
    buildSandboxDocument,
    WORLD_SCRIPT_CSP,
    WORLD_SCRIPT_SANDBOX,
} from "./sandboxDocument";
import { WORLD_SCRIPT_SDK, wrapUserSource } from "./sdk";

describe("the world script frame", () => {
    it("is sandboxed without same-origin access", () => {
        expect(WORLD_SCRIPT_SANDBOX).toBe("allow-scripts");
    });

    it("blocks the network and every other resource", () => {
        expect(WORLD_SCRIPT_CSP).toContain("default-src 'none'");
        expect(WORLD_SCRIPT_CSP).toContain("connect-src 'none'");
        expect(WORLD_SCRIPT_CSP).not.toMatch(/https?:/);
        expect(buildSandboxDocument()).toContain(WORLD_SCRIPT_CSP);
    });

    it("has exactly one script element and no user code in it", () => {
        const html = buildSandboxDocument();
        expect(html.match(/<\/script/gi)).toHaveLength(1);
        expect(html).not.toContain("__defineScript(function");
    });

    it("ships an SDK and a wrapper that parse", () => {
        expect(() => new Function(WORLD_SCRIPT_SDK)).not.toThrow();
        expect(
            () => new Function(wrapUserSource("world.add({ id: 'a' });"))
        ).not.toThrow();
    });
});
