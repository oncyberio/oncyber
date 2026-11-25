import { getWorldScripts, resetWorldScripts, say, updateEntry } from "./store";

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
});
