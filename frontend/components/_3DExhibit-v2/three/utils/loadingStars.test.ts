import fs from "fs";
import path from "path";
import { loadCovered, setLoadCovered } from "./loadingStars";

test("nothing covers a load until something says so", () => {
    expect(loadCovered()).toBe(false);
    setLoadCovered(true);
    expect(loadCovered()).toBe(true);
    setLoadCovered(false);
    expect(loadCovered()).toBe(false);
});

// The engine's star field cannot be loaded in a test (it needs a renderer),
// so its use of this is held by reading it.
test("the engine's star field asks once a load, and draws nothing when covered", () => {
    const source = fs.readFileSync(
        path.join(__dirname, "../modules/starfield/index.js"),
        "utf-8"
    );
    const tight = source.replace(/\s+/g, " ");
    // Asked when a load begins: the answer holds for that load and its fade.
    expect(tight).toContain(
        "case APP_STATES.INTRO: this.covered = loadCovered()"
    );
    // And nothing of the stars is worked out or drawn while it holds: the
    // check comes before the stars are moved.
    const check = tight.indexOf(
        "if( this.covered && ( this.currentState == APP_STATES.INTRO || this.renderOnTop ) )"
    );
    const update = tight.indexOf("update( delta, total ){");
    const moved = tight.indexOf("this.updateStars( delta )", update);
    expect(update).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(update);
    expect(check).toBeLessThan(moved);
});
