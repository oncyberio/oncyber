/**
 * The app shell (pages/_app.tsx and what UserContext, the AI provider and
 * the shared dialogs import) is downloaded on every page. These files used
 * to import three.js and the engine (through `three/constants`), all of
 * ethers, Firebase Firestore and Database, the 319 KB xchain list and the
 * Facebook / Google Ads tags. Each now imports a small module instead, or
 * loads the heavy one when it is used. This test pins the static imports
 * so a later edit does not put them back on every page.
 */
import fs from "fs";
import path from "path";

const FE = path.join(__dirname, "../..");

function staticImports(file: string): string[] {
    const source = fs.readFileSync(path.join(FE, file), "utf8");
    const specifiers: string[] = [];
    const re = /^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gms;
    let match: RegExpExecArray;
    while ((match = re.exec(source))) specifiers.push(match[1]);
    return specifiers;
}

const FORBIDDEN = [
    /^three$/,
    /^three\//,
    /_3DExhibit-v2\/three\/constants$/,
    /^@3constants$/,
    /three\/utils\/spaceutils$/,
    /^ethers$/,
    /^web3$/,
    /^@utils\/firebase$/,
    /^@features\/auth\/providers$/,
    /^@utils\/auth\/gnosis$/,
    /counterpartyAssets$/,
    /xchain-projects\.json$/,
    /fbPixel/,
    /googleAds/,
    /GPTInput$/,
];

const SHELL_FILES = [
    "components/context/UserContext.tsx",
    "components/context/GatingErrorContext.tsx",
    "utils/metadata/formatExhibit.ts",
    "utils/getAddrType.tsx",
    "utils/autographAssets.ts",
    "utils/auth/gnosis/index.ts",
    "components/CloudinaryNextImage.tsx",
    "features/ai/context/AIContext.tsx",
    "features/auth/providers/index.ts",
    "components/_3DExhibit-v2/three/shellconstants.js",
    "components/_3DExhibit-v2/three/device.js",
    "components/_3DExhibit-v2/three/utils/spacecoords.js",
    "components/_3DExhibit-v2/three/factory/space/kits/cyber/components/spawn/data.js",
];

describe("app-shell modules keep heavy libraries out of every page", () => {
    it.each(SHELL_FILES)("%s", (file) => {
        const offending = staticImports(file).filter((spec) =>
            FORBIDDEN.some((re) => re.test(spec))
        );
        expect(offending).toEqual([]);
    });
});
