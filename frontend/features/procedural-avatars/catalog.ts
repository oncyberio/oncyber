import {
    cartoonLayout,
    type CartoonDesign,
    cartoonRecipe,
} from "./cartoonCast";
import { bodyPaint, studyRecipe, type AvatarRecipe } from "./recipes";
export const characters = [
    { id: "morty", name: "Morty" },
    { id: "summer", name: "Summer Smith" },
    { id: "rick", name: "Rick (illustration)" },
    { id: "rick-classic", name: "Rick (OBJ study)" },
    { id: "sunshine", name: "Summer (Sunshine)" },
    { id: "lux", name: "Lux" },
    { id: "remy", name: "Remy" },
    { id: "vale", name: "Vale" },
] as const;
export type Character = (typeof characters)[number]["id"];

/** Additional named recipes can reuse any registered rig, paint and shape vocabulary. */
export const namedRecipes: Readonly<Record<string, AvatarRecipe>> = {
    "rick-paint-study": { template: "rick-classic", inspectPaint: true },
};
const authoredRecipes = new Map<string, AvatarRecipe>();
/** A temporary local preview is scoped to its unique loader URL and its owner's lifetime. */
export function previewCartoon(design: CartoonDesign) {
    return previewRecipe({
        template: "morty",
        cartoon: design,
        layout: cartoonLayout(design),
    });
}
export function previewRecipe(recipe: AvatarRecipe) {
    const slug = "preview-" + crypto.randomUUID();
    authoredRecipes.set(slug, recipe);
    return {
        slug,
        recipe,
        release: () => {
            authoredRecipes.delete(slug);
        },
    };
}
/** Session storage expands local paths to absolute URLs. Never execute URL content. */
export function recipeForUrl(url: string) {
    const origin =
        typeof window === "undefined"
            ? "http://localhost"
            : window.location.origin;
    let source: URL;
    try {
        source = new URL(url, origin);
    } catch {
        return;
    }
    if (source.origin !== origin) return;
    const match =
        /^\/models\/procedural\/([a-z][a-z0-9-]*)(?:\/(0|[1-9]\d{0,5}))?$/.exec(
            source.pathname
        );
    if (match && match[2] === undefined && match[1].startsWith("preview-"))
        return authoredRecipes.get(match[1]);
    if (
        match &&
        match[2] === undefined &&
        Object.hasOwn(namedRecipes, match[1])
    )
        return namedRecipes[match[1]];
    if (match && match[1].startsWith("cast-")) {
        const base = cartoonRecipe(match[1].slice(5));
        if (!base || match[2] === undefined) return base;
        const variation = studyRecipe(base.template, Number(match[2]));
        const c = base.cartoon;
        if (!c) return variation;
        const swatches = [
            c.skin,
            c.hair.color,
            c.outfit.color,
            c.outfit.trousers,
        ];
        const palette = Object.fromEntries(
            swatches.map((paint, i) => [
                paint,
                variation.palette[bodyPaint[base.template][i]],
            ])
        );
        return { ...base, ...variation, palette };
    }
    const entry = match && characters.find((c) => c.id === match[1]);
    if (entry)
        return studyRecipe(
            entry.id,
            match[2] === undefined ? undefined : Number(match[2])
        );
}
function drawnId(url: string) {
    const origin =
        typeof window === "undefined"
            ? "http://localhost"
            : window.location.origin;
    try {
        const source = new URL(url, origin);
        if (source.origin === origin)
            return /^\/models\/procedural\/drawn-([a-z][a-z0-9-]{0,63})$/.exec(
                source.pathname
            )?.[1];
    } catch {}
}
const loaded = new Map<string, AvatarRecipe>();
const loading = new Map<string, Promise<AvatarRecipe>>();
/** Authored files load only when a character is selected. The browser caches the immutable recipe. */
export async function loadRecipeForUrl(
    url: string
): Promise<AvatarRecipe | undefined> {
    const id = drawnId(url);
    if (!id) return recipeForUrl(url);
    const cached = loaded.get(id);
    if (cached) return cached;
    let promise = loading.get(id);
    if (!promise) {
        promise = (async () => {
            const response = await fetch(
                "/lobby/procedural/recipes/" + id + ".json",
                { redirect: "error" }
            );
            if (!response.ok)
                throw Error("Could not load cartoon recipe " + id);
            const text = await response.text();
            if (text.length > 128 * 1024)
                throw Error("Cartoon recipe exceeds 128 KiB");
            const { readAvatarFile } = await import("./avatarFile");
            const { recipe } = readAvatarFile(JSON.parse(text));
            if (loaded.size >= 64) loaded.delete(loaded.keys().next().value);
            loaded.set(id, recipe);
            return recipe;
        })().finally(() => loading.delete(id));
        loading.set(id, promise);
    }
    return promise;
}
export function proceduralCharacter(url: string): Character | undefined {
    const drawn = drawnId(url);
    return drawn
        ? loaded.get(drawn)?.template ?? "morty"
        : recipeForUrl(url)?.template;
}
