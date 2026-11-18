import { seededRandom } from "./mesh/vec";
import { CLOTH_COLORS, HAIR_COLORS, SKIN_TONES } from "./palette";
import {
    TOON_AVATAR_FIELDS,
    TOON_AVATAR_SCHEMA,
    normalizeRecipe,
    type ToonAvatarGroup,
    type ToonAvatarRecipe,
} from "./recipe";

/**
 * A plausible stranger from a seed. Sliders cluster around the middle (the sum
 * of two rolls), common choices are favoured over rare ones, and colours come
 * from the maker's palettes so nobody arrives beige on beige.
 */
export function randomRecipe(
    seed: number,
    base?: ToonAvatarRecipe,
    only?: ToonAvatarGroup[]
): ToonAvatarRecipe {
    const random = seededRandom(seed);
    const pick = <T>(items: readonly T[]) =>
        items[Math.floor(random() * items.length)];
    const chance = (p: number) => random() < p;
    const out = normalizeRecipe(base) as Record<
        string,
        Record<string, unknown>
    >;
    const groups = new Set<string>(only ?? Object.keys(TOON_AVATAR_SCHEMA));

    for (const { group, key, field } of TOON_AVATAR_FIELDS) {
        // Always roll, so one group's result doesn't depend on which others are locked.
        const bell = (random() + random()) / 2;
        const choiceRoll = random();
        if (!groups.has(group)) continue;
        if (field.kind === "unit") out[group][key] = bell;
        else if (field.kind === "choice")
            out[group][key] =
                field.options[Math.floor(choiceRoll * field.options.length)];
    }

    if (groups.has("look")) {
        out.look.skin = chance(0.9)
            ? pick(SKIN_TONES.slice(0, 11))
            : pick(SKIN_TONES.slice(11));
        out.look.ink = "#241a17";
        out.look.line = 0.5;
        out.look.shade = 0;
    }
    if (groups.has("hair")) {
        const hair = chance(0.8)
            ? pick(HAIR_COLORS.slice(0, 10))
            : pick(HAIR_COLORS.slice(10));
        out.hair.color = hair;
        out.hair.facialColor = hair;
        if (chance(0.7)) out.hair.facial = "none";
        if (groups.has("eyes")) out.eyes.browColor = hair;
    }
    if (groups.has("eyes")) {
        out.eyes.lids = chance(0.7) ? 0 : random() * 0.6;
        out.eyes.bags = chance(0.75) ? 0 : random();
        if (chance(0.6)) out.eyes.pupil = "dot";
        if (chance(0.7)) out.eyes.lashes = "none";
        out.eyes.spacing = random() * 0.5;
        out.eyes.size = 0.35 + random() * 0.55;
    }
    if (groups.has("mouth")) {
        out.mouth.lips = chance(0.75) ? 0 : 0.5 + random() * 0.5;
    }
    if (groups.has("marks")) {
        for (const key of Object.keys(out.marks))
            out.marks[key] = chance(0.8) ? 0 : random();
    }
    if (groups.has("outfit")) {
        out.outfit.topColor = pick(CLOTH_COLORS);
        out.outfit.accentColor = pick(CLOTH_COLORS);
        out.outfit.bottomColor = pick(CLOTH_COLORS);
        out.outfit.outerColor = pick(CLOTH_COLORS);
        out.outfit.shoeColor = pick(CLOTH_COLORS);
        if (chance(0.7)) out.outfit.outer = "none";
        if (chance(0.6)) out.outfit.pattern = "plain";
    }
    if (groups.has("extras")) {
        if (chance(0.7)) out.extras.glasses = "none";
        if (chance(0.8)) out.extras.hat = "none";
        if (chance(0.8)) out.extras.earrings = "none";
        if (chance(0.8)) out.extras.wrist = "none";
        out.extras.hatColor = pick(CLOTH_COLORS);
    }
    if (groups.has("body")) {
        out.body.belly = chance(0.6) ? random() * 0.3 : random();
        out.body.slouch = random() * 0.6;
    }
    return normalizeRecipe(out);
}
