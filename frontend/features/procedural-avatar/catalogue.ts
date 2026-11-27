/**
 * The procedural avatars a visitor can pick. Kept free of the generator's
 * code so menus can list them without loading it.
 *
 * These avatars have no model file. Each is known by a same-origin path
 * that nothing is ever fetched from; the lobby recognises the path and
 * builds the avatar instead.
 */
import { DEFAULT_HAIR, HAIR_FILES } from "./figure/hairFiles";
import { DEFAULT_OUTFIT, OUTFIT_FILES } from "./figure/outfitFiles";

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
            "The Stagehand: shirt and tie, wide trousers, headphones round the neck.",
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
 * The hair a figure wears when its URL names none: the style as drawn
 * wears the default cut, and its variations take the other cuts in turn,
 * so a crowd is mixed and the default stays its owner's.
 */
export function figureHairFor(look: number) {
    if (!look) return DEFAULT_HAIR;
    const others = Object.keys(HAIR_FILES).filter((id) => id !== DEFAULT_HAIR);
    return others.length ? others[look % others.length] : DEFAULT_HAIR;
}

/**
 * A figure avatar's URL, as a variation of its style: 0 is the style as
 * drawn, any other whole number a look a little different from it (see
 * `figure/vary.ts`). `hair` names a cut (`figure/hairFiles.ts`) and
 * `outfit` the clothes (`figure/outfitFiles.ts`), either "none"; left
 * out, the look's own hair and the default outfit. The URL is the whole
 * description, so everyone who sees the avatar builds the same one.
 */
export function figureAvatarUrl(
    id: string,
    look = 0,
    hair?: string,
    outfit?: string
) {
    const entry = PROCEDURAL_AVATARS.find((item) => item.id === id);
    if (!entry?.figure) return null;
    const n = Math.floor(look);
    const query = new URLSearchParams();
    if (n > 0 && n <= FIGURE_LOOKS) query.set("look", String(n));
    if (hair && (hair === "none" || HAIR_FILES[hair])) query.set("hair", hair);
    if (outfit && (outfit === "none" || OUTFIT_FILES[outfit]))
        query.set("outfit", outfit);
    const text = query.toString();
    return text ? `${entry.url}?${text}` : entry.url;
}

/**
 * What a URL says to build, if it stands for a figure avatar: the style,
 * the variation of it, the hair and the outfit (each null for none). Null
 * for any other URL.
 */
export function figureAvatarOf(url: string | undefined | null) {
    const id = proceduralAvatarId(url);
    const entry = id && PROCEDURAL_AVATARS.find((item) => item.id === id);
    if (!entry?.figure) return null;
    let look = 0;
    let named: string | null = null;
    let dressed: string | null = null;
    try {
        const query = new URL(url, "https://oncyber.invalid").searchParams;
        const n = Number(query.get("look"));
        if (Number.isInteger(n) && n > 0 && n <= FIGURE_LOOKS) look = n;
        named = query.get("hair");
        dressed = query.get("outfit");
    } catch {
        look = 0;
    }
    const hair =
        named === "none"
            ? null
            : named && HAIR_FILES[named]
            ? named
            : figureHairFor(look);
    const outfit =
        dressed === "none"
            ? null
            : dressed && OUTFIT_FILES[dressed]
            ? dressed
            : DEFAULT_OUTFIT;
    return { id: entry.id, style: entry.figure, look, hair, outfit };
}
