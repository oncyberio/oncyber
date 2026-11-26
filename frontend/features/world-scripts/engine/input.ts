/**
 * Keys and clicks, for the script: every key that is not typed into a
 * field, and a click (a press released where it began) on one of the
 * script's things or on an artwork, with the point that was hit.
 */
import { Raycaster, Vector2, type Object3D } from "three";
import type { Vec3 } from "../protocol";
import { artworkId, currentCamera, liveArtworks, worldCanvas } from "./facade";

export interface ClickHit {
    thing?: string;
    artwork?: string;
    point?: Vec3;
}

export interface InputHandlers {
    key(down: boolean, key: string, code: string): void;
    click(hit: ClickHit): void;
}

/** A press that moved further than this was a drag, not a click. */
const CLICK_SLOP_PX = 6;

const typing = (target: EventTarget | null) => {
    const element = target as HTMLElement;
    return (
        !!element &&
        (element.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
    );
};

export function createInput(world: {
    /** The scripts' group: what in it can be clicked. */
    group: Object3D;
    /** The id of the thing a scene object is, if it is one. */
    thingOf(object: Object3D): string | undefined;
}) {
    let handlers: InputHandlers | null = null;

    const keydown = (event: KeyboardEvent) => {
        if (event.repeat || typing(event.target)) return;
        handlers?.key(true, event.key, event.code);
    };
    const keyup = (event: KeyboardEvent) => {
        if (typing(event.target)) return;
        handlers?.key(false, event.key, event.code);
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);

    const raycaster = new Raycaster();
    let pressed: { x: number; y: number } | null = null;
    const pointerdown = (event: PointerEvent) => {
        pressed = { x: event.clientX, y: event.clientY };
    };
    const pointerup = (event: PointerEvent) => {
        if (!pressed) return;
        const moved = Math.hypot(
            event.clientX - pressed.x,
            event.clientY - pressed.y
        );
        pressed = null;
        const camera = currentCamera();
        if (moved > CLICK_SLOP_PX || !handlers || !camera) return;
        const rect = worldCanvas()?.getBoundingClientRect();
        // With the pointer locked, what is clicked is what is looked at.
        const ndc = new Vector2(0, 0);
        if (!document.pointerLockElement && rect?.width) {
            ndc.set(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
        }
        raycaster.setFromCamera(ndc, camera);
        const artworks = liveArtworks();
        const targets: Object3D[] = [...world.group.children, ...artworks];
        const hit = raycaster.intersectObjects(targets, true)[0];
        if (!hit) return;
        const point: Vec3 = [hit.point.x, hit.point.y, hit.point.z];
        let node: Object3D | null = hit.object;
        const artworkSet = new Set<Object3D>(artworks);
        while (node) {
            const thing = world.thingOf(node);
            if (thing) return handlers.click({ thing, point });
            if (artworkSet.has(node))
                return handlers.click({ artwork: artworkId(node), point });
            node = node.parent;
        }
    };
    const canvas = worldCanvas();
    canvas?.addEventListener("pointerdown", pointerdown);
    canvas?.addEventListener("pointerup", pointerup);

    return {
        bind(next: InputHandlers) {
            handlers = next;
        },
        dispose() {
            window.removeEventListener("keydown", keydown);
            window.removeEventListener("keyup", keyup);
            canvas?.removeEventListener("pointerdown", pointerdown);
            canvas?.removeEventListener("pointerup", pointerup);
        },
    };
}
