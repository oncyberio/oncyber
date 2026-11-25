module.exports = {
    transform: {
        // three r187 ships static class blocks, which next/babel can't parse.
        "^.+\\.[jt]sx?$": [
            "babel-jest",
            {
                presets: ["next/babel"],
                plugins: ["@babel/plugin-transform-class-static-block"],
            },
        ],
    },
    // Resolve bare imports from the frontend root ("env", "config/...") the
    // way tsconfig's baseUrl does for Next, so tests load the same files.
    modulePaths: ["<rootDir>"],
    moduleNameMapper: {
        "^three/webgpu$":
            "<rootDir>/../node_modules/three/build/three.webgpu.js",
        "^three/tsl$": "<rootDir>/../node_modules/three/build/three.tsl.js",
        "^@ui/(.*)$": "<rootDir>/ui/$1",
        "^@features/(.*)$": "<rootDir>/features/$1",
        "^@styles/(.*)$": "<rootDir>/styles/$1",
        "^@utils/(.*)$": "<rootDir>/utils/$1",
        "^@components/(.*)$": "<rootDir>/components/$1",
        "^@config/(.*)$": "<rootDir>/config/$1",
        "^@dapp/(.*)$": "<rootDir>/dApp/$1",
        "^@api/(.*)$": "<rootDir>/pages/api/_v2/$1",
        "^@env$": "<rootDir>/env.ts",
        // `import.meta.url` worker bundling does not parse under CommonJS.
        "^\\./destinationWarmupWorkerFactory$":
            "<rootDir>/features/lobby/destinationWarmupWorkerFactory.jest.ts",
    },
    transformIgnorePatterns: ["/node_modules/(?!three/|@pixiv/)"],
    // Build output is never a test, whatever folder a build was sent to
    // (NEXT_DIST_DIR=.next-anything, see .gitignore).
    testPathIgnorePatterns: ["/node_modules/", "/\\.next[^/]*/", "/dist/"],
    modulePathIgnorePatterns: ["<rootDir>/\\.next[^/]*/"],
};
