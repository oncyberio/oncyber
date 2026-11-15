import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    auditCredits,
    creditsNotices,
    globToRegExp,
    needsCredit,
    spliceNotices,
    validateCredits,
    NOTICES_START,
} from "../src/credits.ts";

const licenses = {
    allowed: {
        "CC0-1.0": {
            name: "CC0 1.0 Universal",
            url: "https://creativecommons.org/publicdomain/zero/1.0/",
            text: false,
        },
        MIT: { name: "MIT License", text: true },
        "OFL-1.1": { name: "SIL Open Font License 1.1", text: true },
    },
    exceptions: [
        {
            game: "club",
            license: "LicenseRef-Permission",
            reason: "Used with permission.",
            confirmedBy: null,
        },
    ],
};
const file = (path, text = false, bytes = 1000) => ({ path, text, bytes });
const font = {
    title: "Anton",
    kind: "font",
    files: ["assets/Anton-*.ttf"],
    author: "The Anton Project Authors",
    source: "https://github.com/googlefonts/AntonFont",
    license: "OFL-1.1",
    licenseFile: "fonts/OFL.txt",
};
const code = [
    file("index.html", true),
    file("assets/index-abc.js", true),
    file("assets/index-abc.css", true),
];
const codes = (list) => list.map((f) => f.code);

test("code and documents need no credit; media, data and disguised binaries do", () => {
    for (const path of [
        "index.html",
        "assets/a.js",
        "a.css",
        "a.js.map",
        "licenses/MIT.txt",
        "README.md",
    ])
        assert.equal(needsCredit(file(path, true)), false, path);
    for (const path of [
        "a.ttf",
        "a.glb",
        "a.vrm",
        "a.png",
        "a.mp3",
        "a.wasm",
        "a.lcp",
        "noextension",
    ])
        assert.equal(needsCredit(file(path, false)), true, path);
    // Motion data and vector art are text, and still someone's work.
    assert.equal(needsCredit(file("motion.json", true)), true);
    assert.equal(needsCredit(file("preview.svg", true)), true);
    // A font renamed to .js is still a font.
    assert.equal(needsCredit(file("assets/font.js", false)), true);
});

test("globs match hashed names in one folder, ** across folders", () => {
    assert.ok(
        globToRegExp("assets/Anton-*.ttf").test(
            "assets/Anton-Regular-DDTWnLuj.ttf"
        )
    );
    assert.ok(!globToRegExp("assets/*.ttf").test("assets/deep/a.ttf"));
    assert.ok(globToRegExp("lobby/**").test("lobby/travel/core.0e2f.lcp"));
    assert.ok(globToRegExp("**/*.vrm").test("a.vrm"));
    assert.ok(!globToRegExp("a.b").test("axb"));
});

test("an uncredited file fails, a credited or own-made one passes", () => {
    const files = [
        ...code,
        file("assets/Anton-Regular-x1.ttf"),
        file("fonts/OFL.txt", true),
        file("preview.jpg"),
    ];
    const bare = auditCredits({ game: "g", credits: [], files, licenses });
    assert.deepEqual(codes(bare.findings), [
        "ASSET_UNCREDITED",
        "ASSET_UNCREDITED",
    ]);
    assert.match(bare.findings[0].message, /assets\/Anton-Regular-x1\.ttf/);
    const full = auditCredits({
        game: "g",
        name: "G",
        credits: [font, { origin: "own", files: ["preview.jpg"] }],
        files,
        licenses,
    });
    assert.deepEqual(full.findings, []);
    assert.deepEqual(full.warnings, []);
    assert.equal(full.published.own, 1);
    assert.deepEqual(full.published.credits[0].files, [
        "assets/Anton-Regular-x1.ttf",
    ]);
    assert.equal(full.published.credits[0].confirmed, true);
});

test("a game with no credits list at all fails", () => {
    assert.deepEqual(
        codes(
            auditCredits({
                game: "g",
                credits: undefined,
                files: code,
                licenses,
            }).findings
        ),
        ["CREDITS_MISSING"]
    );
});

test("third-party entries need title, kind, author, an https source and a licence", () => {
    const findings = validateCredits(
        [
            { files: ["a.glb"] },
            { ...font, source: "javascript:alert(1)" },
            { ...font, files: ["../secret"] },
        ],
        licenses
    );
    const text = findings.map((f) => f.message).join("\n");
    for (const word of [
        "title",
        "kind",
        "author",
        "source",
        "license",
        "credits[1]: needs a `source`",
        "credits[2]: `files`",
    ])
        assert.ok(text.includes(word), word);
});

test("own-made entries cannot also claim a licence", () => {
    assert.match(
        validateCredits(
            [{ origin: "own", files: ["a.glb"], license: "MIT" }],
            licenses
        )[0].message,
        /own-made entry takes no `license`/
    );
});

test("licences outside the allow list fail unless the game has an exception, which warns until confirmed", () => {
    const model = {
        title: "Robot",
        kind: "model",
        files: ["robot.glb"],
        author: "A",
        source: "https://example.com/robot",
        license: "LicenseRef-Permission",
    };
    const files = [...code, file("robot.glb")];
    assert.deepEqual(
        codes(
            auditCredits({ game: "other", credits: [model], files, licenses })
                .findings
        ),
        ["LICENSE_NOT_ALLOWED"]
    );
    assert.deepEqual(
        codes(
            auditCredits({
                game: "g",
                credits: [{ ...model, license: "CC-BY-NC-4.0" }],
                files,
                licenses,
            }).findings
        ),
        ["LICENSE_NOT_ALLOWED"]
    );
    const pending = auditCredits({
        game: "club",
        credits: [model],
        files,
        licenses,
    });
    assert.deepEqual(pending.findings, []);
    assert.deepEqual(codes(pending.warnings), ["RIGHTS_UNCONFIRMED"]);
    assert.equal(pending.published.credits[0].confirmed, false);
    const confirmed = auditCredits({
        game: "club",
        credits: [model],
        files,
        licenses: {
            ...licenses,
            exceptions: [
                { ...licenses.exceptions[0], confirmedBy: "legal, 2026-11-20" },
            ],
        },
    });
    assert.deepEqual(confirmed.warnings, []);
    assert.equal(confirmed.published.credits[0].confirmed, true);
    // "constructor" and friends are not licences.
    assert.deepEqual(
        codes(
            validateCredits([{ ...model, license: "constructor" }], licenses)
        ),
        ["LICENSE_NOT_ALLOWED"]
    );
});

test("a licence that asks for its text needs the text in the build", () => {
    const files = [...code, file("assets/Anton-Regular-x1.ttf")];
    assert.deepEqual(
        codes(
            auditCredits({
                game: "g",
                credits: [{ ...font, licenseFile: undefined }],
                files,
                licenses,
            }).findings
        ),
        ["LICENSE_TEXT_MISSING"]
    );
    assert.deepEqual(
        codes(
            auditCredits({ game: "g", credits: [font], files, licenses })
                .findings
        ),
        ["LICENSE_FILE_MISSING"]
    );
    assert.deepEqual(
        codes(
            auditCredits({
                game: "g",
                credits: [font],
                files: [...files, file("fonts/OFL.txt", false)],
                licenses,
            }).findings
        ),
        ["LICENSE_FILE_MISSING", "ASSET_UNCREDITED"]
    );
    // CC0 asks for nothing.
    const cc0 = {
        title: "Clips",
        kind: "motion",
        files: ["clips.lcp"],
        author: "Q",
        source: "https://example.com",
        license: "CC0-1.0",
    };
    assert.deepEqual(
        auditCredits({
            game: "g",
            credits: [cc0],
            files: [...code, file("clips.lcp")],
            licenses,
        }).findings,
        []
    );
});

test("bundled libraries are checked against package.json", () => {
    const three = {
        title: "three.js",
        kind: "library",
        package: "three",
        author: "three.js authors",
        source: "https://github.com/mrdoob/three.js",
        license: "MIT",
        licenseFile: "licenses/three.txt",
    };
    const files = [...code, file("licenses/three.txt", true)];
    assert.deepEqual(
        codes(
            auditCredits({
                game: "g",
                credits: [],
                files,
                licenses,
                dependencies: { three: "0.180.0" },
            }).findings
        ),
        ["LIBRARY_UNCREDITED"]
    );
    assert.deepEqual(
        auditCredits({
            game: "g",
            credits: [three],
            files,
            licenses,
            dependencies: { three: "0.180.0" },
            declaredLicenses: { three: "MIT" },
        }).findings,
        []
    );
    assert.deepEqual(
        codes(
            auditCredits({
                game: "g",
                credits: [three],
                files,
                licenses,
                dependencies: { three: "1" },
                declaredLicenses: { three: "GPL-3.0" },
            }).findings
        ),
        ["LIBRARY_LICENSE_MISMATCH"]
    );
    assert.deepEqual(
        codes(
            auditCredits({
                game: "g",
                credits: [three],
                files,
                licenses,
                dependencies: {},
            }).warnings
        ),
        ["CREDIT_UNUSED"]
    );
});

test("a credit that matches nothing is reported", () => {
    const audit = auditCredits({
        game: "g",
        credits: [{ origin: "own", files: ["gone.png"] }],
        files: code,
        licenses,
    });
    assert.deepEqual(codes(audit.warnings), ["CREDIT_UNUSED"]);
});

test("notices list third-party files per game and splice between markers", () => {
    const files = [
        ...code,
        file("assets/Anton-Regular-x1.ttf"),
        file("fonts/OFL.txt", true),
    ];
    const { published } = auditCredits({
        game: "club",
        name: "Club | Padel",
        credits: [font],
        files,
        licenses,
    });
    const section = creditsNotices([
        published,
        { version: 1, game: "ace", name: "Ace", own: 1, credits: [] },
    ]);
    assert.ok(
        section.indexOf("### Ace") < section.indexOf("### Club \\| Padel")
    );
    assert.match(section, /No third-party files\./);
    assert.match(
        section,
        /\| Anton \| font \| The Anton Project Authors \| <https:\/\/github.com\/googlefonts\/AntonFont> \| SIL Open Font License 1.1 \(`fonts\/OFL.txt`\) \|/
    );
    const first = spliceNotices("# Notices\n\nIntro.\n", section);
    assert.ok(first.startsWith("# Notices\n\nIntro.\n\n" + NOTICES_START));
    assert.equal(spliceNotices(first, section), first);
    assert.equal(spliceNotices(first.replace("Anton", "Old"), section), first);
});

test("the repository's allow list is well formed and holds no copyleft or non-commercial licence", () => {
    const list = JSON.parse(
        readFileSync(new URL("../../licenses.json", import.meta.url), "utf8")
    );
    for (const [id, entry] of Object.entries(list.allowed)) {
        assert.match(id, /^[A-Za-z0-9.+-]+$/);
        assert.ok(entry.name && typeof entry.text === "boolean", id);
        assert.doesNotMatch(id, /GPL|NC|ND|SA|LicenseRef/, id);
    }
    for (const e of list.exceptions)
        assert.ok(
            e.game &&
                e.license.startsWith("LicenseRef-") &&
                e.reason &&
                "confirmedBy" in e
        );
});
