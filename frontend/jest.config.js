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
    moduleNameMapper: {
        "^three/webgpu$": "<rootDir>/../node_modules/three/build/three.webgpu.js",
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
    testPathIgnorePatterns: [
        "/node_modules/",
        "/.next/",
        "/dist/",
        "<rootDir>/features/lobby/webgpu/",
    ],
};
