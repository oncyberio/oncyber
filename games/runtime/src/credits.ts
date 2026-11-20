// Asset rights: who made each file a game ships, and under which licence.
//
// A game lists its files in `credits` in game.json. This module is the one
// place that knows what a valid list is: it validates the entries, matches
// them against the files of a build, and renders the result for the page's
// credits panel and for THIRD_PARTY_NOTICES.md. It is pure (no file or
// network access), so the check script, the tests and a page can all use it.
// Rules for people and agents: docs/games/credits.md.

export const CREDIT_KINDS = [
    "model",
    "texture",
    "image",
    "audio",
    "font",
    "motion",
    "library",
    "data",
    "other",
] as const;
export type CreditKind = (typeof CREDIT_KINDS)[number];

/** One entry of `credits` in game.json. */
export interface Credit {
    /** Paths in the built folder; `*` matches within a folder, `**` across folders. */
    files?: string[];
    /** "own": made for this game. Then only `files` (and `note`) are needed. */
    origin?: "own";
    title?: string;
    kind?: CreditKind;
    /** For a bundled library: its name in the game's package.json dependencies. */
    package?: string;
    author?: string;
    /** Where it came from: an https URL. */
    source?: string;
    /** An identifier from games/licenses.json, or `LicenseRef-<name>` for anything else. */
    license?: string;
    /** Path in the built folder of the licence text, when the licence asks for it. */
    licenseFile?: string;
    note?: string;
}

export interface LicenseList {
    allowed: Record<string, { name: string; url?: string; text?: boolean }>;
    /** Licences outside the list that one game may still ship, until a person decides. */
    exceptions?: Array<{
        game: string;
        license: string;
        reason: string;
        confirmedBy?: string | null;
    }>;
}

export interface CreditFinding {
    code: string;
    message: string;
}

/** A file of the build: its path and whether its bytes are text. */
export interface BuiltFile {
    path: string;
    text: boolean;
    bytes: number;
}

/** What the page shows and the notices list: third-party entries only. */
export interface PublishedCredit {
    title: string;
    kind: CreditKind;
    author: string;
    source: string;
    license: string;
    licenseName: string;
    licenseUrl: string | null;
    licenseFile: string | null;
    files: string[];
    note: string | null;
    /** False while the licence is an exception nobody has confirmed. */
    confirmed: boolean;
}

export interface PublishedCredits {
    version: 1;
    game: string;
    name: string;
    /** How many files the game declared as made for it. */
    own: number;
    credits: PublishedCredit[];
}

export interface CreditsAudit {
    /** Block the check. */
    findings: CreditFinding[];
    /** Listed in the report; a person should look. */
    warnings: CreditFinding[];
    published: PublishedCredits;
}

/** Code and markup: the only files that need no credit. Everything else does. */
const CODE = new Set(["html", "js", "mjs", "css", "map"]);
/** Plain documents (licence texts, readmes) need none either. */
const DOCUMENTS = new Set(["txt", "md"]);
const LICENSE_ID = /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[^\\\0]+$/;

const extension = (path: string) =>
    (/\.([A-Za-z0-9]+)$/.exec(path)?.[1] ?? "").toLowerCase();

/**
 * Does this built file need a credit? Yes for anything that is not code,
 * markup or a plain document, and for any file with binary content whatever
 * it is called, so renaming a font to `.js` doesn't hide it.
 */
export function needsCredit(file: BuiltFile): boolean {
    const ext = extension(file.path);
    if (!file.text) return true;
    return !CODE.has(ext) && !DOCUMENTS.has(ext);
}

/** `assets/Anton-*.ttf` style patterns: `*` stays in one folder, `**` crosses them. */
export function globToRegExp(pattern: string): RegExp {
    const body = pattern
        .split(/(\*\*\/|\*\*|\*)/)
        .map((part) =>
            part === "**/"
                ? "(?:.*/)?"
                : part === "**"
                ? ".*"
                : part === "*"
                ? "[^/]*"
                : part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        )
        .join("");
    return new RegExp(`^${body}$`);
}

const isString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;

function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

/** Shape errors in `credits`, before any file is looked at. */
export function validateCredits(
    credits: unknown,
    licenses: LicenseList,
    game = ""
): CreditFinding[] {
    const findings: CreditFinding[] = [];
    const bad = (index: number, message: string) =>
        findings.push({
            code: "CREDIT_INVALID",
            message: `credits[${index}]: ${message}`,
        });
    if (credits === undefined)
        return [
            {
                code: "CREDITS_MISSING",
                message:
                    "game.json has no `credits` list; add one, even if empty",
            },
        ];
    if (!Array.isArray(credits))
        return [
            { code: "CREDIT_INVALID", message: "`credits` must be a list" },
        ];
    credits.forEach((entry: Credit, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
            return bad(index, "must be an object");
        const files = entry.files;
        if (
            files !== undefined &&
            (!Array.isArray(files) ||
                !files.length ||
                !files.every((f) => isString(f) && SAFE_PATH.test(f)))
        )
            return bad(
                index,
                "`files` must be a non-empty list of paths inside the build"
            );
        if (entry.origin !== undefined && entry.origin !== "own")
            return bad(index, '`origin` can only be "own"');
        if (entry.origin === "own") {
            if (!files) bad(index, "an own-made entry needs `files`");
            for (const key of [
                "author",
                "source",
                "license",
                "licenseFile",
                "package",
            ] as const)
                if (entry[key] !== undefined)
                    bad(
                        index,
                        `an own-made entry takes no \`${key}\`; drop \`origin\` if this is someone else's work`
                    );
            return;
        }
        if (!files && !isString(entry.package))
            bad(index, "needs `files`, or `package` for a bundled library");
        if (!isString(entry.title)) bad(index, "needs a `title`");
        if (!CREDIT_KINDS.includes(entry.kind as CreditKind))
            bad(index, `\`kind\` must be one of ${CREDIT_KINDS.join(", ")}`);
        if (
            entry.package !== undefined &&
            (!isString(entry.package) || entry.kind !== "library")
        )
            bad(index, '`package` goes with `kind: "library"`');
        if (!isString(entry.author)) bad(index, "needs an `author`");
        if (!isString(entry.source) || !isHttpsUrl(entry.source))
            bad(index, "needs a `source`: the https page it was taken from");
        if (!isString(entry.license) || !LICENSE_ID.test(entry.license))
            return bad(
                index,
                "needs a `license` identifier (see games/licenses.json)"
            );
        if (
            entry.licenseFile !== undefined &&
            (!isString(entry.licenseFile) || !SAFE_PATH.test(entry.licenseFile))
        )
            bad(index, "`licenseFile` must be a path inside the build");
        const allowed = Object.hasOwn(licenses.allowed, entry.license)
            ? licenses.allowed[entry.license]
            : null;
        if (allowed) {
            if (allowed.text && !entry.licenseFile)
                findings.push({
                    code: "LICENSE_TEXT_MISSING",
                    message: `credits[${index}] (${entry.title}): ${entry.license} asks for its text to ship with the file; add \`licenseFile\``,
                });
        } else if (
            !(licenses.exceptions ?? []).some(
                (e) => e.game === game && e.license === entry.license
            )
        ) {
            findings.push({
                code: "LICENSE_NOT_ALLOWED",
                message: `credits[${index}] (${entry.title}): ${entry.license} is not in games/licenses.json. Use a file under an allowed licence, make your own, or ask a person to add it`,
            });
        }
    });
    return findings;
}

export interface AuditInput {
    game: string;
    name?: string;
    credits: unknown;
    files: BuiltFile[];
    licenses: LicenseList;
    /** `dependencies` of the game's package.json: what its bundle contains. */
    dependencies?: Record<string, string>;
    /** Licence each installed dependency declares, where known. */
    declaredLicenses?: Record<string, string>;
}

/** The whole check: is every shipped file accounted for, under a licence we accept? */
export function auditCredits(input: AuditInput): CreditsAudit {
    const { game, licenses, files } = input;
    const findings = validateCredits(input.credits, licenses, game);
    const warnings: CreditFinding[] = [];
    const credits: Credit[] = Array.isArray(input.credits)
        ? input.credits.filter(
              (c) => c && typeof c === "object" && !Array.isArray(c)
          )
        : [];
    const shipped = new Map(files.map((f) => [f.path, f]));
    const covered = new Set<string>();
    const licenseFiles = new Set<string>();
    const published: PublishedCredit[] = [];
    let own = 0;

    credits.forEach((credit, index) => {
        const label = credit.title ?? `credits[${index}]`;
        const patterns = Array.isArray(credit.files)
            ? credit.files.filter(isString)
            : [];
        const matched = new Set<string>();
        for (const pattern of patterns) {
            const regexp = globToRegExp(pattern);
            const hits = files.filter((f) => regexp.test(f.path));
            // A credit for a file that is gone is a claim about nothing.
            if (!hits.length)
                warnings.push({
                    code: "CREDIT_UNUSED",
                    message: `${label}: \`${pattern}\` matches no file in the build; remove it`,
                });
            for (const hit of hits) matched.add(hit.path);
        }
        for (const path of matched) covered.add(path);
        if (credit.origin === "own") {
            own += matched.size;
            return;
        }
        const id = isString(credit.license) ? credit.license : "";
        const allowed = Object.hasOwn(licenses.allowed, id)
            ? licenses.allowed[id]
            : null;
        const exception = allowed
            ? null
            : (licenses.exceptions ?? []).find(
                  (e) => e.game === game && e.license === id
              );
        if (exception && !exception.confirmedBy)
            warnings.push({
                code: "RIGHTS_UNCONFIRMED",
                message: `${label}: ${id} is outside the allow list and nobody has confirmed it. ${exception.reason}`,
            });
        if (isString(credit.licenseFile)) {
            const text = shipped.get(credit.licenseFile);
            if (!text)
                findings.push({
                    code: "LICENSE_FILE_MISSING",
                    message: `${label}: licence text ${credit.licenseFile} is not in the build`,
                });
            else if (!text.text || text.bytes < 20)
                findings.push({
                    code: "LICENSE_FILE_MISSING",
                    message: `${label}: ${credit.licenseFile} is not a licence text`,
                });
            else licenseFiles.add(credit.licenseFile);
        }
        published.push({
            title: String(credit.title ?? ""),
            kind: CREDIT_KINDS.includes(credit.kind as CreditKind)
                ? (credit.kind as CreditKind)
                : "other",
            author: String(credit.author ?? ""),
            source: String(credit.source ?? ""),
            license: id,
            licenseName:
                allowed?.name ??
                id.replace(/^LicenseRef-/, "").replace(/-/g, " "),
            licenseUrl: allowed?.url ?? null,
            licenseFile: isString(credit.licenseFile)
                ? credit.licenseFile
                : null,
            files: [...matched].sort(),
            note: isString(credit.note) ? credit.note : null,
            confirmed: Boolean(allowed || exception?.confirmedBy),
        });
    });

    for (const file of files) {
        if (
            covered.has(file.path) ||
            licenseFiles.has(file.path) ||
            !needsCredit(file)
        )
            continue;
        findings.push({
            code: "ASSET_UNCREDITED",
            message: `${file.path} is in the build but not in game.json \`credits\`. Declare its source, author and licence, or mark it \`"origin": "own"\` if it was made for this game`,
        });
    }

    // Libraries end up inside the bundle, where no file scan can see them.
    const libraries = new Map(
        credits
            .filter((c) => isString(c.package))
            .map((c) => [c.package as string, c])
    );
    for (const name of Object.keys(input.dependencies ?? {})) {
        const credit = libraries.get(name);
        if (!credit) {
            findings.push({
                code: "LIBRARY_UNCREDITED",
                message: `${name} is a dependency in package.json but has no credit with \`"package": "${name}"\``,
            });
            continue;
        }
        const declared = input.declaredLicenses?.[name];
        if (declared && credit.license && declared !== credit.license)
            findings.push({
                code: "LIBRARY_LICENSE_MISMATCH",
                message: `${name} declares ${declared} in its package.json; the credit says ${credit.license}`,
            });
    }
    for (const name of libraries.keys())
        if (input.dependencies && !Object.hasOwn(input.dependencies, name))
            warnings.push({
                code: "CREDIT_UNUSED",
                message: `${name} is credited as a bundled library but is not a dependency; remove it`,
            });

    published.sort(
        (a, b) =>
            CREDIT_KINDS.indexOf(a.kind) - CREDIT_KINDS.indexOf(b.kind) ||
            a.title.localeCompare(b.title)
    );
    return {
        findings,
        warnings,
        published: {
            version: 1,
            game,
            name: input.name ?? game,
            own,
            credits: published,
        },
    };
}

const cell = (value: string) =>
    value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** The games part of THIRD_PARTY_NOTICES.md, from each game's published credits. */
export function creditsNotices(games: PublishedCredits[]): string {
    const lines = [
        "## Games",
        "",
        "Generated from each game's `credits` in `games/<id>/game.json` by `pnpm games:credits`; edit the manifests, not this section. Files a game marks as made for it are Oncyber's own work and are not listed. Rules: [`docs/games/credits.md`](docs/games/credits.md).",
    ];
    for (const game of [...games].sort((a, b) =>
        a.game.localeCompare(b.game)
    )) {
        lines.push("", `### ${cell(game.name)} (\`games/${game.game}/\`)`, "");
        if (!game.credits.length) {
            lines.push("No third-party files.");
            continue;
        }
        lines.push(
            "| What | Kind | Author | Source | License |",
            "| --- | --- | --- | --- | --- |"
        );
        for (const credit of game.credits) {
            const license =
                (credit.licenseUrl
                    ? `[${cell(credit.licenseName)}](${credit.licenseUrl})`
                    : cell(credit.licenseName)) +
                (credit.licenseFile ? ` (\`${credit.licenseFile}\`)` : "") +
                (credit.confirmed
                    ? ""
                    : "; not an open licence, to be confirmed");
            lines.push(
                `| ${cell(credit.title)} | ${credit.kind} | ${cell(
                    credit.author
                )} | <${credit.source}> | ${license} |`
            );
        }
    }
    return lines.join("\n") + "\n";
}

export const NOTICES_START = "<!-- games-credits:start -->";
export const NOTICES_END = "<!-- games-credits:end -->";

/** Put the generated section into the notices file, between its markers (added at the end the first time). */
export function spliceNotices(document: string, section: string): string {
    // Tables here are generated, so Prettier must leave them as written.
    const block = `${NOTICES_START}\n\n<!-- prettier-ignore-start -->\n\n${section}\n<!-- prettier-ignore-end -->\n\n${NOTICES_END}`;
    const start = document.indexOf(NOTICES_START);
    const end = document.indexOf(NOTICES_END);
    if (start >= 0 && end > start)
        return (
            document.slice(0, start) +
            block +
            document.slice(end + NOTICES_END.length)
        );
    return `${document.replace(/\s*$/, "")}\n\n${block}\n`;
}
