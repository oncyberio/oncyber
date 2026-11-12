import {
    CONTENT_PERMISSIONS,
    CONTENT_SANDBOX,
    ConnectPermissionStore,
    isTrustedContentHostWindow,
    validateExternalContentUrl,
    allowsLocalContentPreviewWallet,
} from "./security";

describe("external content boundary", () => {
    const host = "https://oncyber.io";

    it("keeps all arbitrary engine documents opaque and host chrome visible", () => {
        expect(CONTENT_SANDBOX.split(" ")).toEqual([
            "allow-scripts",
            "allow-pointer-lock",
        ]);
        for (const permission of [
            "fullscreen",
            "payment",
            "camera",
            "microphone",
            "clipboard-read",
        ]) {
            expect(CONTENT_PERMISSIONS).toContain(`${permission} 'none'`);
        }
    });

    it("preserves external AWE draft URLs", () => {
        const url = "https://awe.box/play/DmFRffk2waOgtkemeAyt?draft=true";
        expect(validateExternalContentUrl(url, host).href).toBe(url);
    });

    it.each([
        "javascript:alert(1)",
        "data:text/html,hello",
        "blob:https://oncyber.io/not-an-engine",
        "/relative.html",
        "https://oncyber.io/engine",
        "https://oncyber.io:443/engine",
        "https://user:password@games.example.com/game",
        "http://games.example.com/game",
        "http://127.0.0.1:8080/game",
        "https://",
    ])("rejects unsafe engine URL %s", (url) => {
        expect(() => validateExternalContentUrl(url, host)).toThrow();
    });

    it("allows separate loopback origins only with explicit local development", () => {
        const url = "http://localhost:3001/game";
        expect(() =>
            validateExternalContentUrl(url, host, { allowLocalhost: true })
        ).toThrow();
        expect(() =>
            validateExternalContentUrl(url, "http://localhost:13000")
        ).toThrow();
        expect(
            validateExternalContentUrl(url, "http://localhost:13000", {
                allowLocalhost: true,
            }).href
        ).toBe(url);
        expect(() =>
            validateExternalContentUrl(url, "http://localhost:3001", {
                allowLocalhost: true,
            })
        ).toThrow();
    });

    it("supports isolated AWE localhost subdomains but not lookalike domains", () => {
        const local = "http://dancefloor.worlds.awe.localhost:4700/world";
        expect(
            validateExternalContentUrl(local, "http://localhost:13000", {
                allowLocalhost: true,
            }).href
        ).toBe(local);
        for (const remote of [
            "http://localhost.attacker.test/world",
            "http://notlocalhost/world",
        ]) {
            expect(() =>
                validateExternalContentUrl(remote, "http://localhost:13000", {
                    allowLocalhost: true,
                })
            ).toThrow();
        }
        expect(() =>
            validateExternalContentUrl(local, "https://oncyber.io", {
                allowLocalhost: true,
            })
        ).toThrow();
    });
});

describe("wallet host ancestry", () => {
    const top = (origin = "https://oncyber.io") => {
        const frame: any = { location: { origin } };
        frame.parent = frame;
        return frame;
    };
    const child = (parent: any) =>
        ({
            location: { origin: "https://oncyber.io" },
            parent,
        } as any);

    it("allows top-level hosts and every same-origin lobby ancestor", () => {
        expect(isTrustedContentHostWindow(top())).toBe(true);
        expect(isTrustedContentHostWindow(child(child(top())))).toBe(true);
    });

    it("rejects a hostile ancestor even when the immediate parent is trusted", () => {
        expect(
            isTrustedContentHostWindow(
                child(child(top("https://attacker.example")))
            )
        ).toBe(false);
        const inaccessible: any = {};
        Object.defineProperty(inaccessible, "location", {
            get() {
                throw new Error("SecurityError");
            },
        });
        expect(isTrustedContentHostWindow(child(child(inaccessible)))).toBe(
            false
        );
    });

    it("fails closed for opaque, missing, or malformed window contexts", () => {
        expect(isTrustedContentHostWindow(top("null"))).toBe(false);
        expect(isTrustedContentHostWindow(null)).toBe(false);
        const cyclic = child(null);
        cyclic.parent = child(cyclic);
        expect(isTrustedContentHostWindow(cyclic)).toBe(false);
    });
});

describe("wallet explanation preference (not authorization)", () => {
    const identity = {
        experienceId: "experience-1",
        url: "https://games.example.com/game?release=1",
        accountId: "account-1",
        releaseId: "release-1",
    };
    const createStore = () => {
        const values = new Map<string, string>();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
            removeItem: (key: string) => values.delete(key),
        };
        let now = 1000;
        return {
            store: new ConnectPermissionStore(storage, () => now),
            values,
            advance: (value: number) => (now += value),
        };
    };

    it("scopes dismissal to the exact content, source, release and account", () => {
        const { store } = createStore();
        expect(store.has(identity)).toBe(false);
        store.grant(identity);
        expect(store.has(identity)).toBe(true);
        for (const change of [
            { experienceId: "other" },
            { url: "https://games.example.com/game?release=2" },
            { accountId: "other" },
            { releaseId: "other" },
        ]) {
            expect(store.has({ ...identity, ...change })).toBe(false);
        }
        store.revoke(identity);
        expect(store.has(identity)).toBe(false);
    });

    it("expires and removes dismissed explanations", () => {
        const { store, advance, values } = createStore();
        store.grant(identity);
        advance(8 * 60 * 60 * 1000);
        expect(store.has(identity)).toBe(false);
        expect(values.size).toBe(0);
    });

    it("fails safely when storage is unavailable or corrupt", () => {
        const broken = new ConnectPermissionStore({
            getItem: () => {
                throw new Error("denied");
            },
            setItem: () => {
                throw new Error("denied");
            },
            removeItem: () => {
                throw new Error("denied");
            },
        });
        expect(() => broken.grant(identity)).not.toThrow();
        expect(() => broken.revoke(identity)).not.toThrow();
        expect(broken.has(identity)).toBe(false);
        expect(new ConnectPermissionStore().has(identity)).toBe(false);
        const { store, values } = createStore();
        store.grant(identity);
        values.forEach((_, key) => values.set(key, "not json"));
        expect(store.has(identity)).toBe(false);
    });

    it("cannot write a wildcard or anonymous-account preference", () => {
        const { store, values } = createStore();
        store.grant({ ...identity, accountId: "" });
        store.grant({ ...identity, url: "" });
        expect(values.size).toBe(0);
    });
});

describe("unregistered preview capability policy", () => {
    it.each([
        "http://localhost:13000",
        "http://127.0.0.1:13000",
        "http://[::1]:13000",
        "https://host.awe.localhost",
    ])("allows explicit local development only at %s", (origin) => {
        expect(allowsLocalContentPreviewWallet(origin, true)).toBe(true);
        expect(allowsLocalContentPreviewWallet(origin, false)).toBe(false);
    });
    it.each([
        "https://oncyber.io",
        "https://preview.example.com",
        "https://localhost.attacker.test",
        "https://notlocalhost",
        "file://localhost",
        "data:text/html,hello",
        "null",
        "",
        "https://user:password@localhost",
    ])("rejects remote or invalid dev origins: %s", (origin) => {
        expect(allowsLocalContentPreviewWallet(origin, true)).toBe(false);
    });
});
