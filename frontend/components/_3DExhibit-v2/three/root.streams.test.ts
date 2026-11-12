import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "@babel/parser";

// Exercise the real root method without booting the WebGL renderer or media devices.
const source = readFileSync(join(__dirname, "root.js"), "utf8");
const ast = parse(source, { sourceType: "module" });
const rootClass: any = ast.program.body.find(
    (node: any) => node.type === "ClassDeclaration" && node.id.name === "Root"
);
const method = rootClass.body.body.find(
    (node: any) => node.key.name === "updateVideoStream"
);
const updateVideoStream = new Function("opts", source.slice(method.body.start + 1, method.body.end - 1));

test.each(["UPDATE", "REMOVE"])("late %s callbacks are safe before setup and after teardown", (type) => {
    const root: any = {};
    const packet = { type, data: "remote-player" };
    expect(() => updateVideoStream.call(root, packet)).not.toThrow();
    const oldContainer = { update: jest.fn() };
    root.currentStreams = oldContainer;
    updateVideoStream.call(root, packet);
    expect(oldContainer.update).toHaveBeenCalledWith(packet);
    root.currentStreams = null;
    expect(() => updateVideoStream.call(root, packet)).not.toThrow();
    expect(oldContainer.update).toHaveBeenCalledTimes(1);
    const result = Promise.resolve("updated");
    const nextContainer = { update: jest.fn().mockReturnValue(result) };
    root.currentStreams = nextContainer;
    expect(updateVideoStream.call(root, packet)).toBe(result);
    expect(nextContainer.update).toHaveBeenCalledTimes(1);
    expect(nextContainer.update).toHaveBeenCalledWith(packet);
});
