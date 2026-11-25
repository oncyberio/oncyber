import {
    addLog,
    forgetLogs,
    getWorldScripts,
    getWorldScriptScreen,
    resetWorldScripts,
    say,
    setWorldScripts,
    setWorldScriptScreen,
    updateEntry,
} from "./store";

describe("the AI sidebar's conversation", () => {
    beforeEach(resetWorldScripts);

    it("adds lines in order and updates a step in place", () => {
        say("you", "add coins");
        const step = say("step", "Writing the script", "running");
        say("say", "Added 12 coins.");
        updateEntry(step, { state: "done" });
        expect(
            getWorldScripts().transcript.map((entry) => [
                entry.kind,
                entry.state,
            ])
        ).toEqual([
            ["you", undefined],
            ["step", "done"],
            ["say", undefined],
        ]);
    });

    it("says a script's warning or error once, and only a few of them", () => {
        const told = () =>
            getWorldScripts().transcript.map(
                (entry) => `${entry.kind}: ${entry.text}`
            );
        addLog("log", "tick");
        addLog("warn", "A script can have 300 objects at once.");
        addLog("warn", "A script can have 300 objects at once.");
        addLog("error", "TypeError: x is not a function\n    at update");
        expect(told()).toEqual([
            "say: A script can have 300 objects at once.",
            "error: TypeError: x is not a function",
        ]);
        // A script failing a different way every frame does not fill it.
        for (let i = 0; i < 100; i++) addLog("error", `Error ${i}`);
        expect(told().length).toBeLessThan(15);
        // A new request starts the count again.
        forgetLogs();
        addLog("warn", "A script can have 300 objects at once.");
        expect(told()[told().length - 1]).toBe(
            "say: A script can have 300 objects at once."
        );
    });
});

describe("what a script shows on screen", () => {
    beforeEach(resetWorldScripts);

    it("is kept apart, so a HUD that changes every frame redraws nothing else", () => {
        const page = getWorldScripts();
        setWorldScriptScreen({ hud: { score: { text: "1", corner: "top" } } });
        setWorldScriptScreen({ hud: { score: { text: "2", corner: "top" } } });
        // The same object: nobody subscribed to the page's state is told.
        expect(getWorldScripts()).toBe(page);
        expect(getWorldScriptScreen().hud.score.text).toBe("2");
    });

    it("goes when the space does", () => {
        setWorldScripts({ panelOpen: true });
        setWorldScriptScreen({ banner: { text: "You win!", until: 1 } });
        resetWorldScripts();
        expect(getWorldScriptScreen()).toEqual({
            hud: {},
            toasts: [],
            banner: null,
        });
        expect(getWorldScripts().panelOpen).toBe(false);
    });
});
