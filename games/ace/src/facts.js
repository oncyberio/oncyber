// What the bot and the process checks read about the game
// (docs/games/good-game.md): the lifecycle's inspect() with the three
// standard facts in it. Ace's own `screen`, `position` and `arrival` keys
// keep their meaning for its scenario and the other stages, under
// `aceScreen`, `court` and `cameFrom` here.
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
const round = (value) => Math.round(value * 100) / 100;

/** The standard facts, from what `inspect()` reports. Pure. */
export function standardFacts(inspect) {
    const { screen, position, arrival, handoff, ...rest } = inspect;
    return {
        ...rest,
        screen: SCREENS[screen] ?? "menu",
        position: Array.isArray(position)
            ? [round(position[0]), round(position[position.length - 1])]
            : [0, 0],
        // While arriving: the handoff as it is drawn (describeArrival).
        arrival: screen === "arrive" ? handoff ?? null : null,
        aceScreen: screen,
        court: position ?? null,
        cameFrom: arrival,
    };
}

/** Called once by the host with the session's inspect(). */
export const exposeFacts = (inspect) =>
    exposeInspect(() => standardFacts(inspect()));
