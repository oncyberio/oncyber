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
    "Inspect",
    "Bot",
] as const;

/** Party sizes a game must speak to, as `game.json` `party` keys. */
export const PARTY_SIZES = ["1", "2", "3", "4", "5-8"] as const;

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
 * `game.json` `party` says, in a sentence each, what the game offers one
 * player, two, three, four, and five to eight. The solo line is the solo
 * path: it can't be empty or send the visitor away.
 */
export function partyFindings(party: unknown): BriefFinding[] {
    if (!party || typeof party !== "object" || Array.isArray(party))
        return [
            {
                code: "PARTY_UNDECLARED",
                message: `game.json needs "party": what you offer for ${PARTY_SIZES.join(
                    ", "
                )} players`,
            },
        ];
    const offer = party as Record<string, unknown>;
    const missing = PARTY_SIZES.filter(
        (size) =>
            typeof offer[size] !== "string" ||
            !(offer[size] as string).trim() ||
            /\bTODO\b/.test(offer[size] as string)
    );
    const findings: BriefFinding[] = [];
    if (missing.includes("1"))
        findings.push({
            code: "SOLO_PATH",
            message:
                'game.json "party"."1" is empty: say what one player alone can play',
        });
    const others = missing.filter((size) => size !== "1");
    if (others.length)
        findings.push({
            code: "PARTY_UNDECLARED",
            message: `game.json "party" says nothing for ${others.join(
                ", "
            )} players`,
        });
    const extra = Object.keys(offer).filter(
        (key) => !(PARTY_SIZES as readonly string[]).includes(key)
    );
    if (extra.length)
        findings.push({
            code: "PARTY_UNDECLARED",
            message: `game.json "party" keys are ${PARTY_SIZES.join(
                ", "
            )}; found ${extra.join(", ")}`,
        });
    return findings;
}
