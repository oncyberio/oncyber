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
}

const PATH = "/avatars/procedural/";

export const PROCEDURAL_AVATARS: ProceduralAvatarEntry[] = [
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
