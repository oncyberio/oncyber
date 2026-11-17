import {
    patchUniformBufferNames,
    stabiliseWebGLUniformBufferNames,
} from "./glslUniformBufferNames";

function makeBuilderClass() {
    let counter = 0;
    class Builder {
        constructor() {
            this.cache = new Map();
        }
        getUniformBufferName(uniform) {
            return "NodeBuffer_" + uniform.name;
        }
        getUniformFromNode(node, type, shaderStage) {
            // per-program uniform name, like three's nodeUniformN
            const uniform = { name: "nodeUniform" + counter++, node };
            return { uniform, bindingName: this.getUniformBufferName(uniform) };
        }
        getUniforms(shaderStage) {
            const node = { id: 42 };
            return this.getUniformBufferName({ name: "nodeUniform" + counter++, node });
        }
    }
    return Builder;
}

describe("patchUniformBufferNames", () => {
    it("names a buffer block after its node and stage in every program", () => {
        const Builder = makeBuilderClass();
        expect(patchUniformBufferNames(Builder.prototype)).toBe(true);
        const node = { id: 42 };
        const a = new Builder().getUniformFromNode(node, "buffer", "vertex");
        const b = new Builder().getUniformFromNode(node, "buffer", "vertex");
        expect(a.bindingName).toBe("NodeBuffer_42_vertex");
        expect(b.bindingName).toBe(a.bindingName);
        expect(new Builder().getUniforms("vertex")).toBe("NodeBuffer_42_vertex");
        expect(new Builder().getUniforms("fragment")).toBe("NodeBuffer_42_fragment");
    });

    it("patches once", () => {
        const Builder = makeBuilderClass();
        expect(patchUniformBufferNames(Builder.prototype)).toBe(true);
        expect(patchUniformBufferNames(Builder.prototype)).toBe(false);
    });

    it("falls back to three's name outside a stage", () => {
        const Builder = makeBuilderClass();
        patchUniformBufferNames(Builder.prototype);
        expect(new Builder().getUniformBufferName({ name: "x", node: { id: 1 } })).toBe(
            "NodeBuffer_x",
        );
    });

    it("leaves unknown shapes alone", () => {
        expect(patchUniformBufferNames({})).toBe(false);
        expect(patchUniformBufferNames(null)).toBe(false);
    });
});

describe("stabiliseWebGLUniformBufferNames", () => {
    it("does nothing on WebGPU", () => {
        const renderer = { backend: { isWebGLBackend: false } };
        expect(stabiliseWebGLUniformBufferNames(renderer, {})).toBe(false);
    });

    it("patches the WebGL backend's builder class", () => {
        const Builder = makeBuilderClass();
        const renderer = {
            backend: { isWebGLBackend: true, createNodeBuilder: () => new Builder() },
        };
        expect(stabiliseWebGLUniformBufferNames(renderer, {})).toBe(true);
        expect(Builder.prototype.__stableUniformBufferNames).toBe(true);
    });
});
