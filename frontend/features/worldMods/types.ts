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

/** What the space loader hands a world's mod before the world is shown. */
export type WorldSceneContext = {
    /** The world's slug (destination), lower case. */
    slug: string;
    /** The world's model as loaded, not yet on screen. */
    scene: Object3D;
    /**
     * What visitors walk on and into. The walking collision is built from
     * this list once the hook has returned, so a mod may add meshes to it
     * or give one of its meshes another geometry.
     */
    colliders: Object3D[];
    /** The portal placeholders this space has given a destination, by id. */
    portalIds: string[];
    /** Phones and tablets: draw a lighter version. */
    mobile: boolean;
    /** Registers what to undo when the space closes. */
    onDispose: (dispose: () => void) => void;
};

/**
 * Custom code for one world. Every hook is optional, runs after the engine
 * has done its own work, and must leave the world as it was if it fails.
 */
export type WorldMod = {
    /** Called with the world's sky once BackgroundFactory has made it. */
    onBackground?: (context: WorldModContext) => Promise<unknown> | unknown;
    /**
     * Called with the world's model and colliders before the world is shown.
     * The loader waits for it, so keep it short.
     */
    onScene?: (context: WorldSceneContext) => Promise<unknown> | unknown;
};
