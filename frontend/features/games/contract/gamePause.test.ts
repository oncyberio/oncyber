import {
    gamePauseHeld,
    gamePauseMessage,
    holdGamePause,
    subscribeGamePause,
} from "./gamePause";

test("the first hold pauses and the last release resumes", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeGamePause((held) => seen.push(held));
    const menu = holdGamePause();
    const dialog = holdGamePause();
    expect(gamePauseHeld()).toBe(true);
    menu();
    menu(); // released twice: counted once
    expect(gamePauseHeld()).toBe(true);
    dialog();
    expect(gamePauseHeld()).toBe(false);
    expect(seen).toEqual([true, false]);
    unsubscribe();
    holdGamePause()();
    expect(seen).toEqual([true, false]);
});

test("the game is told a menu is the reason", () => {
    expect(gamePauseMessage("ace", true)).toEqual({
        type: "ace:pause",
        reason: "menu",
    });
    expect(gamePauseMessage("ace", false)).toEqual({
        type: "ace:resume",
        reason: "menu",
    });
});
