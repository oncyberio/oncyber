import type { LobbyPlay } from "./lobbyPlay";
import { createPlayScene } from "./scene";

type Three = typeof import("three/webgpu");

/**
 * Draws the room's play zone inside the lobby's own scene: the arena and
 * its things, at the zone's place in the room. The lobby keeps drawing its
 * avatars; this adds only what the game adds.
 */
export function createLobbyPlayLayer(
    THREE: Three,
    scene: InstanceType<Three["Scene"]>,
    play: LobbyPlay
) {
    const view = createPlayScene(THREE);
    const arena = view.arena;
    arena.visible = false;
    scene.add(arena);
    let drawn = -1;
    return {
        /** Call once a frame with the seconds since the last one. */
        update(seconds: number) {
            if (!play.place) {
                arena.visible = false;
                return;
            }
            if (drawn !== play.revision) {
                drawn = play.revision;
                arena.visible = !!play.recipe;
                // A little above the lobby's floor, so the court does not flicker against it.
                arena.position.set(
                    play.place.origin.x,
                    0.03,
                    play.place.origin.z
                );
                if (play.recipe) view.setRecipe(play.recipe);
            }
            if (!play.recipe) return;
            play.update(seconds);
            view.draw(play.poses.shown, play.poses.known);
        },
        dispose() {
            scene.remove(arena);
            arena.traverse((child: any) => {
                child.geometry?.dispose?.();
                child.material?.dispose?.();
            });
        },
    };
}
