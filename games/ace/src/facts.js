// What the checks can read about the game (docs/games/good-game.md): the
// standard facts every game reports, plus the match score.
import { describeArrival } from "@oncyber/game-runtime/arrival";
import { exposeInspect } from "@oncyber/game-runtime/bot";

const SCREENS = {
    title: "title",
    arrive: "arrival",
    party: "menu",
    setup: "menu",
    howto: "menu",
    vs: "match",
    intro: "match",
    playing: "match",
    pause: "match",
    results: "results",
};

/** `scene()` returns what is being drawn this frame. */
export function exposeFacts(scene) {
    exposeInspect(() => {
        const { state, arrive, camera, player, avatarHeight } = scene();
        const me = state.engine?.athletes[0];
        const screen = SCREENS[state.screen] ?? "menu";
        const facts = {
            screen,
            position: me ? [round(me.x), round(me.z)] : [0, 0],
            phase: state.engine?.phase ?? "",
            games: state.engine?.match?.games ?? [0, 0],
            winner: state.engine?.match?.winner ?? null,
        };
        if (screen === "arrival" && me)
            facts.arrival = describeArrival({
                camera: camera.position,
                fov: camera.fov,
                avatar: { x: me.x, y: 0, z: me.z },
                // Forward is -z at yaw 0.
                avatarForward: {
                    x: -Math.sin(player.yaw),
                    z: -Math.cos(player.yaw),
                },
                avatarHeight,
                crouched: arrive.sink > 0,
                handsEmpty: !player.racket.visible,
            });
        return facts;
    });
}
const round = (value) => Math.round(value * 100) / 100;
