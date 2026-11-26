/**
 * The bridge between WorldScriptHost and the native 3D engine: draws the
 * objects a script asks for in the real scene (so they sit behind walls and
 * work on WebGPU and WebGL alike), reads the player and camera, changes
 * artworks for as long as the script runs, and forwards keys and clicks.
 *
 * This file only puts the parts together; each has a file of its own in
 * ./engine: the script's things (things.ts, with how they are drawn in
 * thingLooks.ts, text.ts and geometry.ts, what is more than a shape in
 * specials.ts, and glides.ts), the space's artworks (artworks.ts), the
 * world's collision, openings and doors, and keys and clicks (input.ts).
 * All of them reach the engine through one file, ./engine/facade.ts.
 *
 * Loaded only when a space has scripts and the feature is on.
 */
import { Group } from "three";
import type { WorldScriptSink } from "./host";
import type { HudCorner, SoundName } from "./protocol";
import { playSound } from "./sounds";
import { createLookCache } from "./looks";
import { NEUTRAL_STYLE, WorldStyle } from "./style";
import { createArtworks } from "./engine/artworks";
import { createCollisionHoles, createSolids } from "./engine/collision";
import { createDoors } from "./engine/doors";
import {
    addToScene,
    drawEveryFrame,
    onUpdate,
    sceneColors,
    teleport,
} from "./engine/facade";
import { createGlides } from "./engine/glides";
import { createInput, type ClickHit } from "./engine/input";
import { createOpenings } from "./engine/openings";
import { createSpecials } from "./engine/specials";
import { createThingLooks } from "./engine/thingLooks";
import { createThings } from "./engine/things";
import { readView } from "./engine/view";

export { engineReady } from "./engine/facade";

export interface InterfaceSink {
    hud(key: string, text: string | null, corner: HudCorner): void;
    clearHud(): void;
    toast(text: string, seconds: number): void;
    banner(text: string | null, seconds: number): void;
}

const RENDER_SOURCE = "world-scripts";

/** Runs `work`; a failure is logged once and answered with `fallback`. */
let warned = false;
function guarded<T>(work: () => T, fallback: T): T {
    try {
        return work();
    } catch (error) {
        if (!warned) console.warn("World scripts: engine bridge", error);
        warned = true;
        return fallback;
    }
}

export function createEngineSink(
    ui: InterfaceSink,
    initialStyle: WorldStyle = NEUTRAL_STYLE
) {
    let style = initialStyle;
    const looks = createLookCache();
    const group = new Group();
    group.name = "world-scripts";
    addToScene(group);
    const solids = createSolids();
    const holes = createCollisionHoles();
    const openings = createOpenings(holes);
    const doors = createDoors();
    const glides = createGlides();
    const thingLooks = createThingLooks(looks);
    const things = createThings({
        group,
        solids,
        glides,
        draw: (thing) => thingLooks.apply(thing, style),
        releaseLook: (key) => looks.release(key),
        special: createSpecials({
            looks,
            solids,
            openings,
            style: () => style,
        }),
    });
    const artworks = createArtworks();

    const sink: WorldScriptSink = {
        view: readView,
        artworks: artworks.list,
        addThing: things.add,
        setThing: things.set,
        removeThing: things.remove,
        setArtwork: artworks.set,
        resetArtworks: artworks.reset,
        // Reading a world's doors must never keep a script from starting.
        doors: () => guarded(() => doors.list(), []),
        setDoor: (id, open) => guarded(() => doors.set(id, open), undefined),
        resetDoors: () => guarded(() => doors.reset(), undefined),
        movePlayer: teleport,
        hud: ui.hud,
        clearHud: ui.clearHud,
        toast: ui.toast,
        banner: ui.banner,
        sound(name: SoundName, volume: number) {
            playSound(name, volume);
        },
    };

    // Frames, keys and clicks.
    let onFrame: ((dt: number) => void) | null = null;
    const stopUpdates = onUpdate((delta) => {
        glides.update(delta);
        // the collision world is built after the model and again on travel
        guarded(() => {
            solids.sync();
            openings.sync();
            things.frame();
        }, undefined);
        onFrame?.(delta);
    });
    const input = createInput({ group, thingOf: things.idOf });

    return {
        sink,
        /** The world's sky and fog colours, for writing its style. */
        colors: sceneColors,
        /** A new creative direction: every thing drawn in "style" follows it. */
        setStyle(next: WorldStyle) {
            style = next;
            things.redraw();
        },
        /**
         * A script is running: the picture changes every frame. Off, the
         * world goes back to drawing only when something changed.
         */
        setActive(active: boolean) {
            drawEveryFrame(RENDER_SOURCE, active);
        },
        bind(handlers: {
            frame: (dt: number) => void;
            key: (down: boolean, key: string, code: string) => void;
            click: (hit: ClickHit) => void;
        }) {
            onFrame = handlers.frame;
            input.bind({ key: handlers.key, click: handlers.click });
        },
        dispose() {
            stopUpdates();
            drawEveryFrame(RENDER_SOURCE, false);
            input.dispose();
            things.dispose();
            openings.dispose();
            holes.dispose();
            solids.dispose();
            doors.reset();
            looks.dispose();
            thingLooks.dispose();
            artworks.reset();
            group.removeFromParent();
        },
    };
}
