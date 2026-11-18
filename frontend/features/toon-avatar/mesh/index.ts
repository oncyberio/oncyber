import { normalizeRecipe, type ToonAvatarRecipe } from "../recipe";
import type { ToonLayout } from "../skeleton";
import { buildBody } from "./body";
import type { ToonGeometry } from "./builder";
import { createContext } from "./context";
import { buildHair } from "./hair";
import { createKit, type AvatarKit } from "./kit";
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
 * `extend` is an authored avatar's own geometry, added to the same mesh.
 */
export function buildToonMesh(
    input: unknown,
    extend?: (kit: AvatarKit) => void
): ToonMesh {
    const recipe = normalizeRecipe(input);
    const ctx = createContext(recipe);
    const head = createHeadShape(recipe, ctx.layout);
    const face = layoutFace(recipe, ctx.layout, head);
    buildBody(ctx);
    buildHead(ctx, head, face);
    buildHair(ctx, head);
    extend?.(createKit(ctx, head, face));
    return { geometry: ctx.builder.build(), layout: ctx.layout, face, recipe };
}

export type { ToonGeometry, FaceLayout, AvatarKit };
