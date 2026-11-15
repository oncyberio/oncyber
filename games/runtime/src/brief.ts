/**
 * The brief an agent fills in before building (`games/<id>/BRIEF.md`, from
 * the template `games/BRIEF.md`) and the party offer in `game.json`. Both
 * are checked by `pnpm games:check`. Rules: docs/games/good-game.md.
 *
 * No imports: the check script loads this file directly.
 */

export interface BriefFinding {
    code: string;
    message: string;
}

/** Sections a brief must fill in, in the template's order. */
export const BRIEF_SECTIONS = [
    "Game",
    "Players",
    "Formats",
    "Arrival",
    "Devices",
    "Kits",
    "Sound and pausing",
    "Leaving and results",
    "Saved data",
    "Inspect",
    "Bot",
] as const;

/** Every party size a game must speak to. */
export const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
/** What a game says about the members a format doesn't seat. */
export const PARTY_STATEMENTS = ["late", "dropped", "extra"] as const;

/** Text under each `## Heading`, with HTML comments (the guidance) removed. */
export function briefSections(markdown: string): Record<string, string> {
    const sections: Record<string, string> = {};
    let current: string | null = null;
    for (const line of markdown.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
        const heading = line.match(/^##\s+(.+?)\s*$/);
        if (heading) {
            current = heading[1];
            sections[current] = "";
        } else if (current) sections[current] += line + "\n";
    }
    for (const key of Object.keys(sections))
        sections[key] = sections[key].trim();
    return sections;
}

/** The `inspect()` keys a brief promises: backticked names under Inspect. */
export function briefInspectKeys(markdown: string): string[] {
    const text = briefSections(markdown).Inspect ?? "";
    return [
        ...new Set(
            [...text.matchAll(/`([A-Za-z_][\w.]*)`/g)].map(
                (match) => match[1].split(".")[0]
            )
        ),
    ];
}

/** What is missing from a brief. `null` text means the file doesn't exist. */
export function briefFindings(markdown: string | null): BriefFinding[] {
    if (markdown === null)
        return [
            {
                code: "BRIEF_MISSING",
                message:
                    "no BRIEF.md; copy games/BRIEF.md and fill it in before building",
            },
        ];
    const sections = briefSections(markdown);
    const empty = BRIEF_SECTIONS.filter(
        (name) => !sections[name] || /\bTODO\b/.test(sections[name])
    );
    const findings: BriefFinding[] = [];
    if (empty.length)
        findings.push({
            code: "BRIEF_INCOMPLETE",
            message: `fill in: ${empty.join(", ")}`,
        });
    if (!empty.includes("Inspect")) {
        const keys = briefInspectKeys(markdown);
        for (const key of ["screen", "position", "arrival"])
            if (!keys.includes(key))
                findings.push({
                    code: "BRIEF_INCOMPLETE",
                    message: `Inspect must list \`${key}\``,
                });
    }
    return findings;
}

/**
 * `game.json` `party` is the contract's declaration (docs/games/party.md):
 * `formats: [{ id, label, sizes }]` are the options a party of each size is
 * offered, `solo` names the one that needs nobody else, and `late`,
 * `dropped` and `extra` say in a sentence what those players get. Every
 * size from 1 to 8 needs an option, and the solo option at every size is
 * the solo path. The party stage of the check (scripts/games/party-check.mjs)
 * then holds the running game to the same block.
 */
export function partyFindings(party: unknown): BriefFinding[] {
    const undeclared = (message: string): BriefFinding => ({
        code: "PARTY_UNDECLARED",
        message,
    });
    if (!party || typeof party !== "object" || Array.isArray(party))
        return [
            undeclared(
                'game.json needs "party": formats for parties of 1 to 8, the solo option, and what late, dropped and extra players get (docs/games/party.md)'
            ),
        ];
    const block = party as Record<string, unknown>;
    const formats = (Array.isArray(block.formats) ? block.formats : []).filter(
        (f): f is { id: string; sizes: unknown[] } =>
            Boolean(f) &&
            typeof f === "object" &&
            typeof (f as { id?: unknown }).id === "string" &&
            Array.isArray((f as { sizes?: unknown }).sizes)
    );
    const offered = (size: number) =>
        formats.filter((f) => f.sizes.includes(size)).map((f) => f.id);
    const findings: BriefFinding[] = [];
    const none = PARTY_SIZES.filter((size) => !offered(size).length);
    if (none.length)
        findings.push(
            undeclared(
                `game.json "party".formats offers nothing to a party of ${none.join(
                    ", "
                )}`
            )
        );
    const solo = typeof block.solo === "string" ? block.solo : "";
    const alone = PARTY_SIZES.filter(
        (size) => !solo || !offered(size).includes(solo)
    );
    if (alone.length)
        findings.push({
            code: "SOLO_PATH",
            message: solo
                ? `game.json "party".solo is "${solo}", which a party of ${alone.join(
                      ", "
                  )} is not offered: one player alone can always play`
                : 'game.json "party".solo is missing: name the format one player alone can always play',
        });
    const unsaid = PARTY_STATEMENTS.filter(
        (key) =>
            typeof block[key] !== "string" ||
            !(block[key] as string).trim() ||
            /\bTODO\b/.test(block[key] as string)
    );
    if (unsaid.length)
        findings.push(
            undeclared(
                `game.json "party" does not say what ${unsaid.join(
                    ", "
                )} players get`
            )
        );
    return findings;
}
