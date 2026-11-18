import type { ToonFaceParams } from "../face";
import type { AvatarKit } from "../mesh/kit";
import type { ToonAvatarRecipeInput } from "../recipe";

/**
 * An avatar written as code. The recipe sets everything the standard parts
 * can do (proportions, colours, face, basic clothes); `build` then adds
 * whatever is particular to this character, with the same kit the standard
 * parts are made from. This is the file that is generated from a picture.
 */
export type AuthoredAvatar = {
    /** Lower-case letters, digits and dashes. Also the avatar's address. */
    id: string;
    name: string;
    recipe: ToonAvatarRecipeInput;
    /** Runs after the standard parts. Turn a standard part off in the recipe to replace it. */
    build?(kit: AvatarKit): void;
    /** Last word on the painted face: mouth, brows, lids and marks. */
    face?(params: ToonFaceParams): ToonFaceParams;
};
