/**
 * The open and close clips a portal placeholder's door was authored with.
 *
 * A placeholder `Portal_Preview_<n>` owns the clips `Portal_Open_<n>` and
 * `Portal_Close_<n>`. A model does not always pad the number the same way in
 * both places (`Portal_Preview_073` with `Portal_Open_0073`), so the numbers
 * are compared, not the strings: door 73 takes `Portal_Open_0073`, and never
 * the clips of door 173 or door 730.
 */

type NamedClip = { name: string };

export type DoorClips<T extends NamedClip> = { open: T[]; close: T[] };

// The door number is the whole run of digits after the prefix, so a longer
// number never counts as a shorter one. Anything after it (the ".001" a
// duplicated action gets, for instance) is ignored, as it always was.
const RE_DOOR_CLIP = /portal_(open|close)_(\d+)/i;

/** "0073" and "073" are both door "73". Kept as text: no number is too long. */
function doorNumber(digits: string) {
    return digits.replace(/^0+(?=\d)/, "");
}

/**
 * @param clips  every clip of the model
 * @param digits the placeholder's number as written in its name ("073"), or
 *               nothing when its name carries none in that place
 */
export function findDoorClips<T extends NamedClip>(
    clips: T[],
    digits: string | null | undefined
): DoorClips<T> {
    const found: DoorClips<T> = { open: [], close: [] };

    if (!digits || !/^\d+$/.test(digits)) return found;

    const door = doorNumber(digits);
    // A clip padded exactly like the placeholder comes first: the portal
    // plays the first clip of each list.
    const exact: DoorClips<T> = { open: [], close: [] };

    for (const clip of clips || []) {
        const match = RE_DOOR_CLIP.exec(clip?.name ?? "");

        if (match == null || doorNumber(match[2]) !== door) continue;

        const kind = match[1].toLowerCase() as "open" | "close";

        (match[2] === digits ? exact : found)[kind].push(clip);
    }

    return {
        open: [...exact.open, ...found.open],
        close: [...exact.close, ...found.close],
    };
}
