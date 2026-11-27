/**
 * The procedural avatars a visitor can pick. Kept free of the generator's
 * code so menus can list them without loading it.
 *
 * These avatars have no model file. Each is known by a same-origin path
 * that nothing is ever fetched from; the lobby recognises the path and
 * builds the avatar instead.
 */
export interface ProceduralAvatarEntry {
    id: string;
    name: string;
    url: string;
    image: string;
    description: string;
    /**
     * Set for an avatar made from a figure and a style (`figure/`) rather
     * than generated whole: the style's id.
     */
    figure?: string;
}

const PATH = "/avatars/procedural/";

export const PROCEDURAL_AVATARS: ProceduralAvatarEntry[] = [
    {
        id: "figure",
        name: "Figure",
        url: `${PATH}figure`,
        image: "/lobby/avatars/figure.png",
        description:
            "The Stagehand's face on a bare figure. No hair or clothes yet.",
        figure: "stagehand",
    },
    {
        id: "runner",
        name: "Runner",
        url: `${PATH}runner`,
        image: "/lobby/avatars/runner.png",
        description:
            "A set runner with a radio on her belt. Generated in code: no model file.",
    },
    {
        id: "stagehand",
        name: "Stagehand",
        url: `${PATH}stagehand`,
        image: "/lobby/avatars/stagehand.png",
        description:
            "A stagehand with headphones round his neck. Generated in code: no model file.",
    },
];

/** The procedural avatar a URL stands for, or null for any other URL. */
export function proceduralAvatarId(url: string | undefined | null) {
    if (!url) return null;
    let path = url;
    try {
        path = new URL(url, "https://oncyber.invalid").pathname;
    } catch {
        return null;
    }
    if (!path.startsWith(PATH)) return null;
    const id = path.slice(PATH.length);
    return PROCEDURAL_AVATARS.some((entry) => entry.id === id) ? id : null;
}

/** The largest variation number a figure avatar's URL may carry. */
export const FIGURE_LOOKS = 9999;

/**
 * A figure avatar's URL, as a variation of its style: 0 is the style as
 * drawn, any other whole number a look a little different from it (see
 * `figure/vary.ts`). The URL is the whole description, so everyone who
 * sees the avatar builds the same one.
 */
export function figureAvatarUrl(id: string, look = 0) {
    const entry = PROCEDURAL_AVATARS.find((item) => item.id === id);
    if (!entry?.figure) return null;
    const n = Math.floor(look);
    return n > 0 && n <= FIGURE_LOOKS ? `${entry.url}?look=${n}` : entry.url;
}

/**
 * What a URL says to build, if it stands for a figure avatar: the style
 * and the variation of it. Null for any other URL.
 */
export function figureAvatarOf(url: string | undefined | null) {
    const id = proceduralAvatarId(url);
    const entry = id && PROCEDURAL_AVATARS.find((item) => item.id === id);
    if (!entry?.figure) return null;
    let look = 0;
    try {
        const n = Number(
            new URL(url, "https://oncyber.invalid").searchParams.get("look")
        );
        if (Number.isInteger(n) && n > 0 && n <= FIGURE_LOOKS) look = n;
    } catch {
        look = 0;
    }
    return { id: entry.id, style: entry.figure, look };
}
