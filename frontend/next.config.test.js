/** @jest-environment node */
// The `analyze` script sets ANALYSE=true; the config must then add one static
// bundle report per compiler and leave regular builds untouched.

const variables = ["ANALYSE", "ANALYZE"];
const saved = Object.fromEntries(
    variables.map((name) => [name, process.env[name]])
);

function loadConfig(env) {
    for (const name of variables) delete process.env[name];
    Object.assign(process.env, env);
    let config;
    jest.isolateModules(() => {
        config = require("./next.config.js");
    });
    return config;
}

function compile(config, options) {
    const webpackConfig = {
        plugins: [],
        module: { rules: [] },
        resolve: { alias: {} },
        optimization: {},
    };
    config.webpack(webpackConfig, options);
    return webpackConfig;
}

afterEach(() => {
    for (const name of variables) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
    }
});

test("a regular build has no bundle analyzer", () => {
    const config = loadConfig({});
    const built = compile(config, { isServer: false });
    expect(built.plugins).toHaveLength(0);
    // The app's own webpack rules still apply.
    expect(built.module.rules.length).toBeGreaterThan(0);
});

test.each([[{ ANALYSE: "true" }], [{ ANALYZE: "true" }]])(
    "%p writes client, nodejs and edge reports",
    (env) => {
        const config = loadConfig(env);
        const reports = [
            [{ isServer: false }, "./analyze/client.html"],
            [
                { isServer: true, nextRuntime: "nodejs" },
                "../analyze/nodejs.html",
            ],
            [{ isServer: true, nextRuntime: "edge" }, "../analyze/edge.html"],
        ].map(([options, expected]) => {
            const built = compile(config, options);
            expect(built.plugins).toHaveLength(1);
            expect(built.module.rules.length).toBeGreaterThan(0);
            const plugin = built.plugins[0];
            expect(plugin.constructor.name).toBe("BundleAnalyzerPlugin");
            expect(plugin.opts).toMatchObject({
                analyzerMode: "static",
                openAnalyzer: false,
            });
            return [plugin.opts.reportFilename, expected];
        });
        for (const [actual, expected] of reports) expect(actual).toBe(expected);
        // Everything else in the config is unchanged: browser bundles are
        // still minified by Terser, not the SWC minifier.
        const browser = compile(config, { isServer: false, dev: false });
        expect(browser.optimization.minimizer[0].constructor.name).toBe(
            "TerserPlugin"
        );
        expect(typeof config.headers).toBe("function");
    }
);

describe("static file caching", () => {
    // Next's own route loader (it validates the sources and adds the locale
    // prefix) and matcher; the request path carries the default locale.
    const loadCustomRoutes =
        require("next/dist/lib/load-custom-routes").default;
    const {
        getPathMatch,
    } = require("next/dist/shared/lib/router/utils/path-match");
    let headers;
    beforeAll(async () => {
        ({ headers } = await loadCustomRoutes(loadConfig({})));
    });
    const cacheControl = (path) => {
        let value;
        for (const rule of headers) {
            if (!getPathMatch(rule.source)(`/en${path}`)) continue;
            for (const header of rule.headers)
                if (header.key === "Cache-Control") value = header.value;
        }
        return value;
    };
    const IMMUTABLE = "public, max-age=31536000, immutable";
    const REVALIDATED = "public, max-age=3600, stale-while-revalidate=86400";

    test.each([
        ["/lobby/cc0/quaternius-core.c66c3d2a7450.lcp", IMMUTABLE],
        ["/lobby/travel/travel.f7d646d776ff.lcp", IMMUTABLE],
        ["/detect-gpu/3.1.30/d-apple.json", IMMUTABLE],
        ["/lobby/cc0/manifest.json", REVALIDATED],
        ["/lobby/native-avatar-motion.json", REVALIDATED],
        ["/draco/draco_decoder.wasm", REVALIDATED],
        ["/draco/gltf/draco_decoder.js", REVALIDATED],
        ["/basis/basis_transcoder.wasm", REVALIDATED],
        ["/libs/basis/basis_transcoder.js", REVALIDATED],
        ["/fonts/licensed/Aeonik-Regular.otf", REVALIDATED],
        ["/fonts/SpaceGrotesk/SpaceGrotesk-Regular.ttf", REVALIDATED],
        ["/models/room.glb", REVALIDATED],
        ["/envmaps/studio.hdr", REVALIDATED],
        ["/textures/noise.png", REVALIDATED],
    ])("%s", (path, expected) => {
        expect(cacheControl(path)).toBe(expected);
    });

    test.each([
        "/",
        "/rift",
        "/spaces/abc",
        "/studio",
        "/api/exhibit",
        "/ingest/e",
        "/manifest.json",
        "/images/logo.png",
        "/detect-gpu/latest/d-apple.json",
    ])("%s keeps the default (no Cache-Control rule)", (path) => {
        expect(cacheControl(path)).toBeUndefined();
    });
});
