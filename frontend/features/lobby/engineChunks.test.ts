import {
    listEngineChunks,
    readEngineChunks,
    serializeEngineChunks,
} from "./engineChunks";

// The shape Next 13.1 writes: keys are `<file relative to pages/> -> <request>`.
const loadable = {
    "../components/_3DExhibit-v2/displyUI/Exhibit3DGate.tsx -> ./DisplayScene":
        {
            files: [
                "static/chunks/1111.aaaa.js",
                "static/chunks/2222.bbbb.js",
                "static/css/3333.cccc.css",
                "static/chunks/1111.aaaa.js.map",
            ],
        },
    "../components/_3DExhibit-v2/three/api.js -> @3renderer": {
        files: ["static/chunks/4444.dddd.js"],
    },
    "../components/_3DExhibit-v2/three/states.js -> ./world3D.js": {
        files: ["static/chunks/5555.eeee.js", "static/chunks/2222.bbbb.js"],
    },
    "../components/_3DExhibit-v2/three/states.js -> ./events/mediator.js": {
        files: ["static/chunks/6666.ffff.js"],
    },
    // Not the engine: never listed.
    "../components/_3DExhibit-v2/three/world3D.js -> @3editgui/physics": {
        files: ["static/chunks/7777.gggg.js"],
    },
    "../features/lobby/Lobby.tsx -> ./FlashPicker": {
        files: ["static/chunks/8888.hhhh.js"],
    },
};
const build = {
    polyfillFiles: ["static/chunks/polyfills-1.js"],
    pages: {
        "/_app": [
            "static/chunks/webpack-1.js",
            "static/chunks/pages/_app-1.js",
        ],
        "/": ["static/chunks/pages/index-1.js", "static/chunks/2222.bbbb.js"],
        "/spaces/[id]": [
            "static/chunks/webpack-1.js",
            "static/chunks/pages/spaces/[id]-1.js",
        ],
        "/[slug]": ["static/chunks/pages/[slug]-1.js"],
    },
};

test("lists the engine's chunk groups and the world pages, once each", () => {
    expect(listEngineChunks(loadable, build, "/")).toEqual([
        "/_next/static/chunks/1111.aaaa.js",
        "/_next/static/css/3333.cccc.css",
        "/_next/static/chunks/4444.dddd.js",
        "/_next/static/chunks/5555.eeee.js",
        "/_next/static/chunks/6666.ffff.js",
        "/_next/static/chunks/pages/%5Bslug%5D-1.js",
        "/_next/static/chunks/pages/spaces/%5Bid%5D-1.js",
    ]);
});

test("leaves out what the lobby page already loads", () => {
    const list = listEngineChunks(loadable, build, "/");
    // In `/`'s own files and in `_app`'s.
    expect(list).not.toContain("/_next/static/chunks/2222.bbbb.js");
    expect(list).not.toContain("/_next/static/chunks/webpack-1.js");
    // On another page, the shared chunk is listed.
    expect(listEngineChunks(loadable, build, "/landing-carousel")).toContain(
        "/_next/static/chunks/2222.bbbb.js"
    );
});

test("keeps the asset prefix the page's own scripts use", () => {
    expect(
        listEngineChunks(loadable, build, "/", "https://cdn.example")[0]
    ).toBe("https://cdn.example/_next/static/chunks/1111.aaaa.js");
});

test("an unexpected manifest lists nothing instead of throwing", () => {
    expect(listEngineChunks({}, {}, "/")).toEqual([]);
    expect(
        listEngineChunks(
            { "x/Exhibit3DGate.tsx -> ./DisplayScene": { files: "nope" } },
            { pages: { "/[slug]": null } },
            "/"
        )
    ).toEqual([]);
});

test("writes nothing outside production or on other pages", () => {
    // Jest runs with NODE_ENV=test.
    expect(readEngineChunks("/", build)).toBeNull();
});

test("the list cannot close its script element", () => {
    expect(serializeEngineChunks(["/_next/</script><b>"])).toBe(
        '["/_next/\\u003c/script>\\u003cb>"]'
    );
});
