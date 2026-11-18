import { normalizeRecipe, type ToonAvatarRecipe } from "../recipe";
import type { ToonLayout } from "../skeleton";
import { buildBody } from "./body";
import type { ToonGeometry } from "./builder";
import { createContext } from "./context";
import { buildHair } from "./hair";
import {
    buildHead,
    createHeadShape,
    layoutFace,
    type FaceLayout,
} from "./head";

export type ToonMesh = {
    geometry: ToonGeometry;
    layout: ToonLayout;
    face: FaceLayout;
    recipe: ToonAvatarRecipe;
};

/**
 * Builds the whole avatar as one skinned, vertex-coloured mesh. Pure data in,
 * typed arrays out: no three.js, so it also runs in a worker or a test.
 */
export function buildToonMesh(input: unknown): ToonMesh {
    const recipe = normalizeRecipe(input);
    const ctx = createContext(recipe);
    const head = createHeadShape(recipe, ctx.layout);
    const face = layoutFace(recipe, ctx.layout, head);
    buildBody(ctx);
    buildHead(ctx, head, face);
    buildHair(ctx, head);
    return { geometry: ctx.builder.build(), layout: ctx.layout, face, recipe };
}

export type { ToonGeometry, FaceLayout };
