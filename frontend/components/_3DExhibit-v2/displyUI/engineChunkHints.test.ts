import fs from "fs";
import path from "path";

/**
 * The engine arrives in three chunks: DisplayScene's (requested by the gate
 * after the WebGL probe), the renderer's (three/api.js) and the world's
 * (three/states.js). Webpack hints let the browser download them together
 * while the code still runs in the original order. These comments are easy
 * to lose in an edit, and nothing else would notice; this test does.
 */
const read = (file: string) =>
    fs.readFileSync(path.join(__dirname, file), "utf8");

test("the gate prefetches DisplayScene's chunk without running it", () => {
    const gate = read("Exhibit3DGate.tsx");
    expect(gate).toMatch(
        /import\(\/\* webpackPrefetch: true \*\/ "\.\/DisplayScene"\)/
    );
    // It is still evaluated only by next/dynamic, after the probe.
    expect(gate.match(/import\(/g)).toHaveLength(1);
});

test("the renderer and world chunks are preloaded with DisplayScene's", () => {
    expect(read("../three/api.js")).toMatch(
        /await import\(\/\* webpackPreload: true \*\/ "@3renderer"\)/
    );
    const states = read("../three/states.js");
    expect(states).toMatch(
        /import\(\/\* webpackPreload: true \*\/ "\.\/world3D\.js"\)/
    );
    // world3D still runs after the renderer: States.init is reached from
    // Api._initWorld only once rendererReady resolved.
    const api = read("../three/api.js");
    const init = api.slice(api.indexOf("static async _initWorld"));
    expect(init.indexOf("await rendererReady")).toBeLessThan(
        init.indexOf("await world.start()")
    );
});
