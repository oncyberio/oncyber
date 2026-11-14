// const withPWA = require("next-pwa");
// const runtimeCaching = require("next-pwa/cache");

const fs = require("fs");
const path = require("path");
const { siteOrigin } = require("./utils/siteOrigin");

// Firebase config is env-only (see env.ts). Fail production builds early
// rather than shipping a site that cannot sign anyone in.
const REQUIRED_FIREBASE_ENV = [
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
];
const missingFirebaseEnv = REQUIRED_FIREBASE_ENV.filter(
    (name) => !process.env[name]
);
if (missingFirebaseEnv.length) {
    const message = `Missing Firebase settings: ${missingFirebaseEnv.join(
        ", "
    )}. Copy frontend/.env.example and fill in your own Firebase project.`;
    if (
        process.env.NODE_ENV === "production" &&
        process.env.ALLOW_MISSING_FIREBASE_ENV !== "1"
    )
        throw new Error(message);
    console.warn(message);
}

// Licensed fonts live outside the repo (docs/fonts.md). Only preload them
// when scripts/fetch-licensed-fonts.mjs put them in place.
const hasLicensedFonts = (() => {
    try {
        return fs
            .readdirSync(path.join(__dirname, "public/fonts/licensed"))
            .some((name) => /\.(otf|ttf|woff2?)$/i.test(name));
    } catch {
        return false;
    }
})();

let removeConsoleConf = {};

if (process.env.NODE_ENV === "production") {
    removeConsoleConf = {
        removeConsole: {
            exclude: ["error"],
        },
    };
}

/**
 * Files whose URL changes whenever their content does: cached for a year and
 * never revalidated. Only add a folder here if every file name in it carries
 * a content hash or sits in a version-named folder that is never rewritten.
 */
const STATIC_IMMUTABLE = [
    { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];
const STATIC_IMMUTABLE_SOURCES = [
    // Lobby motion packs: name.<12 hex content hash>.lcp (the manifests that
    // point at them are not hashed and stay in the revalidated tier).
    "/lobby/:pack/:file([A-Za-z0-9_-]+\\.[0-9a-f]{12}\\.lcp)",
    // detect-gpu benchmark tables, one folder per library version.
    "/detect-gpu/:version(\\d+\\.\\d+\\.\\d+)/:file*",
];

/**
 * Engine and font files with fixed names (decoders, fonts, rooms, maps): used
 * from the browser cache for an hour, then served stale for up to a day while
 * the browser revalidates in the background. A changed file reaches every
 * visitor within that window. Version their paths to make them immutable.
 */
const STATIC_REVALIDATED = [
    {
        key: "Cache-Control",
        value: "public, max-age=3600, stale-while-revalidate=86400",
    },
];
const STATIC_REVALIDATED_SOURCES = [
    "/draco/:path*",
    "/basis/:path*",
    "/libs/basis/:path*",
    "/fonts/:path*",
    "/lobby/:path*",
    "/models/:path*",
    "/envmaps/:path*",
    "/textures/:path*",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Lets a dev server run beside a production build (NEXT_DIST_DIR=.next-dev).
    distDir: process.env.NEXT_DIST_DIR || ".next",
    poweredByHeader: false,
    env: {
        NEXT_PUBLIC_LICENSED_FONTS: hasLicensedFonts ? "1" : "",
        NEXT_PUBLIC_SITE_ORIGIN: siteOrigin(),
        // Stamped on every analytics event (utils/analytics.ts), so PostHog
        // can tell this frontend's builds and environments apart.
        NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(
            0,
            7
        ),
        NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV || "",
    },
    experimental: {
        // The lobby imports shared TS from ../multiplayer (protocol, identity,
        // crowd room). Without this, Next only compiles TS inside frontend/.
        externalDir: true,
    },
    // Generate browser source maps only when we're going to upload them to
    // PostHog (POSTHOG_CLI_API_KEY set in the production Vercel env). Keeps
    // preview/local builds fast, and is a no-op until that secret is added. The
    // postbuild step (scripts/posthog-sourcemaps.mjs) uploads them to PostHog
    // Error Tracking, then deletes the .map files so source isn't served publicly.
    productionBrowserSourceMaps: !!process.env.POSTHOG_CLI_API_KEY,
    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        // !! WARN !!
        ignoreBuildErrors: true,
    },
    compiler: {
        styledComponents: true,
        ...removeConsoleConf,
    },
    // pwa: {
    //     dest: "public",

    //     runtimeCaching,

    //     disable: process.env.NODE_ENV === "development",

    //     scope: "/",
    // },
    webpack: (config, { isServer, dev }) => {
        // utils/net/publicFetch is server-only; shared modules guard its use
        // with `typeof window`, so the browser bundle only needs stubs.
        if (!isServer) {
            config.resolve.fallback = {
                ...(config.resolve.fallback || {}),
                dns: false,
                net: false,
            };
        }
        config.experiments = { topLevelAwait: true, layers: true };

        // One Three for the whole app. `three`, `three/webgpu` and `three/tsl`
        // share build/three.core.js, so classes are identical across entries.
        // TS's classic resolver can't read package exports; pin the subpaths.
        const threeBuild = path.dirname(require.resolve("three/webgpu"));
        config.resolve.alias = {
            ...config.resolve.alias,
            "three/webgpu$": path.join(threeBuild, "three.webgpu.js"),
            "three/tsl$": path.join(threeBuild, "three.tsl.js"),
        };
        const rules = [
            // three r187 uses static class blocks, which the Terser bundled
            // with next 13.1 can't parse. Lowering them alone leaves a
            // `static #_` field that this Terser then mis-hoists (`this` is
            // lost), so lower class fields too, to plain assignments.
            {
                test: /\.js$/,
                include: fs.realpathSync(path.dirname(threeBuild)),
                use: {
                    loader: "babel-loader",
                    options: {
                        babelrc: false,
                        configFile: false,
                        compact: false,
                        plugins: [
                            "@babel/plugin-transform-class-static-block",
                            "@babel/plugin-transform-class-properties",
                            "@babel/plugin-transform-private-methods",
                        ],
                    },
                },
            },

            // Shaders

            {
                test: /\.worker\.js$/,
                use: { loader: "worker-loader" },
            },

            {
                test: /\.(glsl|frag|vert)$/,
                exclude: /node_modules/,
                loader: path.resolve("glslifyloader/glslifyimport.js"),
            },
            {
                test: /\.(glsl|frag|vert)$/,
                exclude: /node_modules/,
                loader: "raw-loader",
            },
            {
                test: /\.(glsl|frag|vert)$/,
                exclude: /node_modules/,
                loader: "glslify-loader",
            },
        ];

        for (const rule of rules) {
            config.module.rules.push(rule);
        }

        // Minify browser bundles with Terser, not the SWC minifier: SWC once
        // miscompiled control flow here (fetchExhibitData constant-folded its
        // `type` param and dropped the custom-link branch, 404ing galleries).
        if (!dev && !isServer) {
            const TerserPlugin = require("terser-webpack-plugin");
            config.optimization.minimizer = [
                new TerserPlugin({
                    parallel: true,
                    terserOptions: {
                        ecma: 2020,
                        compress: { passes: 1 },
                        format: { comments: false },
                    },
                    extractComments: false,
                }),
            ];
        }

        return config;
    },
    async headers() {
        const headers = [];

        if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") {
            headers.push({
                headers: [
                    {
                        key: "X-Robots-Tag",
                        value: "noindex",
                    },
                ],
                source: "/:path*",
            });
        }

        headers.push({
            source: "/(.*)",
            headers: [
                // TODO: enable after new entry page release
                // {
                //     key: "X-Frame-Options",
                //     value: "SAMEORIGIN",
                // },
                {
                    key: "X-Content-Type-Options",
                    value: "nosniff",
                },
                {
                    key: "Referrer-Policy",
                    value: "strict-origin-when-cross-origin",
                },
                ...(process.env.NODE_ENV === "production"
                    ? [
                          {
                              key: "Strict-Transport-Security",
                              value: "max-age=31536000; includeSubDomains",
                          },
                      ]
                    : []),
            ],
        });

        // Pages that grant access or edit a space must never be framed by
        // another site (clickjacking). Spaces themselves stay embeddable.
        const NO_THIRD_PARTY_FRAMES = [
            {
                key: "Content-Security-Policy",
                value: "frame-ancestors 'self'",
            },
        ];
        for (const source of [
            "/cli-auth",
            "/studio",
            "/studio/:path*",
            "/create",
            "/create/:path*",
        ])
            headers.push({ source, headers: NO_THIRD_PARTY_FRAMES });

        // Browser caching for static files under public/ (Next already serves
        // /_next/static, where the engine and three.js chunks live, as
        // immutable). Without these, every file here is revalidated on each
        // use. Later entries win, so the immutable rules come last.
        for (const source of STATIC_REVALIDATED_SOURCES)
            headers.push({ source, headers: STATIC_REVALIDATED });
        for (const source of STATIC_IMMUTABLE_SOURCES)
            headers.push({ source, headers: STATIC_IMMUTABLE });

        return headers;
    },
    async redirects() {
        return [
            {
                source: "/exhibits/:path*",
                destination: "/spaces/:path*",
                permanent: true,
            },
            {
                source: "/upload",
                destination: "/destinations",
                permanent: true,
            },
            {
                source: "/uploader",
                destination: "/destinations",
                permanent: true,
            },
            {
                source: "/create",
                destination: "/studio",
                permanent: true,
            },
        ];
    },
    rewrites: async () => {
        const isVercelProdDeploy = process.env.VERCEL_ENV === "production";

        const posthogRewrites = [
            {
                source: "/ingest/static/:path*",
                destination: "https://us-assets.i.posthog.com/static/:path*",
            },
            {
                source: "/ingest/array/:path*",
                destination: "https://us-assets.i.posthog.com/array/:path*",
            },
            {
                source: "/ingest/:path*",
                destination: "https://us.i.posthog.com/:path*",
            },
        ];

        // Docs as plain text for agents (see features/docs/content.ts).
        const docsRewrites = [
            { source: "/llms.txt", destination: "/api/docs/llms" },
            { source: "/docs.md", destination: "/api/docs/raw" },
            {
                source: "/docs/:slug.md",
                destination: "/api/docs/raw?slug=:slug",
            },
        ];

        if (isVercelProdDeploy) {
            return {
                beforeFiles: [
                    {
                        source: "/:path*.map",
                        destination: "/404",
                    },
                ],
                //
                afterFiles: [
                    {
                        source: "/template",
                        destination: "/marketplace",
                    },
                    ...docsRewrites,
                    ...posthogRewrites,
                ],
            };
        }

        //
        return [
            {
                source: "/templates",
                destination: "/marketplace",
            },
            ...docsRewrites,
            ...posthogRewrites,
        ];
    },
    skipTrailingSlashRedirect: true,
    i18n: {
        locales: ["en", "ja"],
        defaultLocale: "en",
    },
};

/**
 * `pnpm -C frontend analyze` (ANALYSE=true; ANALYZE=true also works) writes
 * one static bundle report per compiler to `.next/analyze/`: client.html,
 * nodejs.html and edge.html. Regular builds never load the analyzer.
 */
function withBundleAnalyzer(config) {
    const enabled = [process.env.ANALYSE, process.env.ANALYZE].includes("true");
    if (!enabled) return config;
    // webpack-bundle-analyzer comes with @next/bundle-analyzer (a dev
    // dependency). That wrapper names every server report server.html, so
    // the edge compile (middleware.ts) would overwrite the Node one.
    const { BundleAnalyzerPlugin } = require(require.resolve(
        "webpack-bundle-analyzer",
        { paths: [path.dirname(require.resolve("@next/bundle-analyzer"))] }
    ));
    return {
        ...config,
        webpack(webpackConfig, options) {
            const name = options.isServer
                ? options.nextRuntime === "edge"
                    ? "edge"
                    : "nodejs"
                : "client";
            webpackConfig.plugins.push(
                new BundleAnalyzerPlugin({
                    analyzerMode: "static",
                    openAnalyzer: false,
                    // Relative to each compiler's output directory.
                    reportFilename: options.isServer
                        ? `../analyze/${name}.html`
                        : `./analyze/${name}.html`,
                })
            );
            return config.webpack(webpackConfig, options);
        },
    };
}

// module.exports = withPWA(nextConfig);
module.exports = withBundleAnalyzer(nextConfig);
