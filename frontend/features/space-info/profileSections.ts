/** The parts of a profile, shown one at a time behind a section switch. */
export type ProfileSectionId = "spaces" | "featured" | "owned" | "created";

export interface ProfileSection {
    id: ProfileSectionId;
    label: string;
    /** How many it holds, when that is known before it is opened. */
    count?: number;
}

/**
 * The sections a profile has, in order. Spaces always; "Featured in" only
 * when someone shows their work; the two NFT sections only for a wallet
 * that can hold them.
 */
export function profileSections(profile: {
    spaces: unknown[];
    featured: unknown[];
    hasNfts: boolean;
}): ProfileSection[] {
    return [
        { id: "spaces", label: "Spaces", count: profile.spaces.length },
        ...(profile.featured.length
            ? [
                  {
                      id: "featured" as const,
                      label: "Featured in",
                      count: profile.featured.length,
                  },
              ]
            : []),
        ...(profile.hasNfts
            ? [
                  { id: "owned" as const, label: "Collected" },
                  { id: "created" as const, label: "Created" },
              ]
            : []),
    ];
}

/**
 * The section to open on: their spaces, or the first section that has
 * something when they have deployed none.
 */
export function openingSection(sections: ProfileSection[]): ProfileSectionId {
    return (
        sections.find((section) => section.count > 0)?.id ??
        sections.find((section) => section.count === undefined)?.id ??
        "spaces"
    );
}

/** The section an arrow key moves to; the ends wrap, Home and End jump. */
export function nextSection(
    sections: ProfileSection[],
    current: ProfileSectionId,
    key: string
): ProfileSectionId | null {
    const index = sections.findIndex((section) => section.id === current);
    if (index < 0 || !sections.length) return null;
    const last = sections.length - 1;
    const to =
        key === "ArrowRight"
            ? index === last
                ? 0
                : index + 1
            : key === "ArrowLeft"
            ? index === 0
                ? last
                : index - 1
            : key === "Home"
            ? 0
            : key === "End"
            ? last
            : -1;
    return to < 0 || to === index ? null : sections[to].id;
}

const compact = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
});

/** "140.8K visits", as on the landing's cards; nothing for a space nobody has visited. */
export function visitsLabel(visits: unknown): string {
    const count = Number(visits);
    if (!Number.isFinite(count) || count < 1) return "";
    return `${compact.format(count)} ${count === 1 ? "visit" : "visits"}`;
}
