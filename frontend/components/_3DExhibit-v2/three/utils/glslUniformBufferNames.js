// @ts-check

/**
 * Gives uniform-array blocks on the WebGL backend a name that is the same in
 * every shader program.
 *
 * three's GLSL builder names an array block after the uniform's per-program
 * name ("NodeBuffer_nodeUniform8" in one program, "NodeBuffer_nodeUniform30"
 * in the next), but caches the buffer binding, and the name it looks the
 * block up by, once per node for all programs. Every program after the first
 * that shares the node (the per-eye camera matrices in VR, for instance)
 * then can't find its block, leaves it on binding 0, and the driver drops
 * the draw ("uniform buffer that is too small"): in a headset most of a
 * world simply isn't drawn.
 *
 * Naming the block after the node and the shader stage keeps the GLSL and
 * the cached binding in step. The name only has to be unique per node and
 * stage, which the node id and stage give.
 *
 * @param {any} builderPrototype - GLSLNodeBuilder.prototype
 * @returns {boolean} whether the prototype was patched
 */
export function patchUniformBufferNames(builderPrototype) {
    const proto = builderPrototype;
    if (!proto || proto.__stableUniformBufferNames) return false;
    const { getUniformFromNode, getUniforms, getUniformBufferName } = proto;
    if (
        typeof getUniformFromNode !== "function" ||
        typeof getUniforms !== "function" ||
        typeof getUniformBufferName !== "function"
    )
        return false;

    proto.getUniformFromNode = function (node, type, shaderStage, name) {
        const previous = this.__bufferStage;
        this.__bufferStage = shaderStage;
        try {
            return getUniformFromNode.call(this, node, type, shaderStage, name);
        } finally {
            this.__bufferStage = previous;
        }
    };

    proto.getUniforms = function (shaderStage) {
        const previous = this.__bufferStage;
        this.__bufferStage = shaderStage;
        try {
            return getUniforms.call(this, shaderStage);
        } finally {
            this.__bufferStage = previous;
        }
    };

    proto.getUniformBufferName = function (uniform) {
        const id = uniform?.node?.id;
        const stage = this.__bufferStage;
        if (id === undefined || !stage)
            return getUniformBufferName.call(this, uniform);
        return `NodeBuffer_${id}_${stage}`;
    };

    proto.__stableUniformBufferNames = true;
    return true;
}

/**
 * Applies {@link patchUniformBufferNames} to a renderer's WebGL backend.
 * Does nothing on WebGPU.
 *
 * @param {any} renderer - an initialised WebGPURenderer
 * @param {any} probeObject - any Object3D, only used to reach the builder class
 * @returns {boolean}
 */
export function stabiliseWebGLUniformBufferNames(renderer, probeObject) {
    const backend = renderer?.backend;
    if (!backend?.isWebGLBackend || typeof backend.createNodeBuilder !== "function")
        return false;
    const builder = backend.createNodeBuilder(probeObject, renderer);
    return patchUniformBufferNames(Object.getPrototypeOf(builder));
}
