import fs from "fs";
import path from "path";

/**
 * world3D.js wires render on demand into the frame (utils/renderDemand*.js
 * hold the logic and their own tests). World3D cannot be built in jsdom,
 * so this pins the wiring an edit could quietly break: which worlds may
 * skip frames, and the order inside update().
 */
const source = fs.readFileSync(path.join(__dirname, "world3D.js"), "utf8");
const body = (name) => {
    const start = source.indexOf(`\n    ${name}(`);
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf("\n    }\n", start);
    return source.slice(start, next);
};

test("the editor, uploader, XR, recordings and transitions never skip", () => {
    const skip = body("canSkipFrame");
    for (const condition of [
        "!EDIT_MODE",
        "!UPLOADER_MODE",
        "!IS_VR",
        "!Renderer.xr?.enabled",
        "!IS_RECORDING",
        "!STATS",
        "!CINEMATIC",
        "!Dynamicportal.active",
        "SKIPPABLE_STATES.has(CURRENT_STATE)",
    ])
        expect(skip).toContain(condition);
    expect(source).toMatch(
        /SKIPPABLE_STATES = new Set\(\[ APP_STATES\.IDLE, APP_STATES\.SPACE, APP_STATES\.EXPOSITION \]\)/
    );
});

test("a frame decides, updates matrices, looks, draws, then reports", () => {
    const update = body("update");
    const at = (text) => {
        const index = update.indexOf(text);
        expect(index).toBeGreaterThan(-1);
        return index;
    };
    const begin = at("this.renderGate.begin(this.canSkipFrame())");
    const matrices = at("Scene.updateMatrixWorld()");
    const confirm = at("this.renderGate.confirm(Scene, Camera.current)");
    const css = at("CSS3DRenderer.update()");
    const draw = at("if(draw) {\n\n            PostProcessing.render(");
    const end = at("this.renderGate?.end()");
    expect(begin).toBeLessThan(matrices);
    expect(matrices).toBeLessThan(confirm);
    expect(confirm).toBeLessThan(css);
    expect(css).toBeLessThan(draw);
    expect(draw).toBeLessThan(end);
});

test("frame timing only counts two drawn frames in a row", () => {
    expect(body("duskupdate")).toMatch(
        /if\( RenderDemand\.frame\.drawn && RenderDemand\.frame\.previousDrawn \) \{\s*FPSCalc\.addFrame\( t \)/
    );
    const api = fs.readFileSync(path.join(__dirname, "api.js"), "utf8");
    const dusk = api.slice(api.indexOf("Emitter.on( Events.DUSK_UPDATE"));
    expect(dusk.indexOf("if( !RenderDemand.frame.drawn )")).toBeLessThan(
        dusk.indexOf("this._frameConsumers.forEach")
    );
});
