import type { Object3D } from "three/webgpu";

/** What the space loader hands a world's mod once the world is set up. */
export type WorldModContext = {
    /** The world's slug (destination), lower case. */
    slug: string;
    /** What BackgroundFactory.get returned for the world's sky, if any. */
    background: Object3D | null;
    /** Phones and tablets: draw a lighter version. */
    mobile: boolean;
};

/**
 * Custom code for one world. Every hook is optional, runs after the engine
 * has done its own work, and must leave the world as it was if it fails.
 */
export type WorldMod = {
    /** Called with the world's sky once BackgroundFactory has made it. */
    onBackground?: (context: WorldModContext) => Promise<unknown> | unknown;
};
