import { MathUtils } from '@gltf-transform/core'
import { EXTMeshGPUInstancing } from '@gltf-transform/extensions'
// import { createTransform } from '@gltf-transform/function/utils.js';
// import { createTransform } from './utils.js';
const NAME = 'instance';
const INSTANCE_DEFAULTS = {
    min: 2,
};
/**
 * Creates GPU instances (with `EXT_mesh_gpu_instancing`) for shared {@link Mesh} references. In
 * engines supporting the extension, reused Meshes will be drawn with GPU instancing, greatly
 * reducing draw calls and improving performance in many cases. If you're not sure that identical
 * Meshes share vertex data and materials ("linked duplicates"), run {@link dedup} first to link them.
 *
 * Example:
 *
 * ```javascript
 * import { dedup, instance } from '@gltf-transform/functions';
 *
 * await document.transform(
 *  dedup(),
 *  instance({min: 2}),
 * );
 * ```
 */

 export function createTransform(name, fn) {
    Object.defineProperty(fn, 'name', { value: name });
    return fn;
 }

export function instancetransform(_options = INSTANCE_DEFAULTS) {
    const options = Object.assign(Object.assign({}, INSTANCE_DEFAULTS), _options);
    return createTransform(NAME, (doc) => {
        const logger = doc.getLogger();
        const root = doc.getRoot();
        const batchExtension = doc.createExtension(EXTMeshGPUInstancing);

        // if (root.listAnimations().length) {
        //     logger.warn(`${NAME}: Instancing is not currently supported for animated models.`);
        //     logger.debug(`${NAME}: Complete.`);
        //     return;
        // }

        let numBatches = 0;
        let numInstances = 0;
        for (const scene of root.listScenes()) {
            // Gather a one-to-many Mesh/Node mapping, identifying what we can instance.
            const meshInstances = new Map();
            scene.traverse((node) => {
                const mesh = node.getMesh();
                if (!mesh)
                    return;
                meshInstances.set(mesh, (meshInstances.get(mesh) || new Set()).add(node));
                mesh.previousParent = node.getParentNode()
            });

            // For each Mesh, create an InstancedMesh and collect transforms.
            const modifiedNodes = [];
            for (const mesh of Array.from(meshInstances.keys())) {
                const nodes = Array.from(meshInstances.get(mesh));
                if (nodes.length < options.min)
                    continue;
                if (nodes.some((node) => node.getSkin()))
                    continue;

                const batch = createBatch(doc, batchExtension, mesh, nodes.length);
                const batchTranslation = batch.getAttribute('TRANSLATION');
                const batchRotation = batch.getAttribute('ROTATION');
                const batchScale = batch.getAttribute('SCALE');
                const batchNode = doc.createNode().setMesh(mesh).setExtension('EXT_mesh_gpu_instancing', batch);
                // mesh.previousParent.addChild(batchNode)
                scene.addChild(batchNode);
                let needsTranslation = false;
                let needsRotation = false;
                let needsScale = false;
                // For each Node, write TRS properties into instance attributes.
                for (let i = 0; i < nodes.length; i++) {
                    let t, r, s;
                    const node = nodes[i];
                    batchTranslation.setElement(i, (t = node.getWorldTranslation()));
                    batchRotation.setElement(i, (r = node.getWorldRotation()));
                    batchScale.setElement(i, (s = node.getWorldScale()));

                    if (!MathUtils.eq(t, [0, 0, 0]))
                        needsTranslation = true;
                    if (!MathUtils.eq(r, [0, 0, 0, 1]))
                        needsRotation = true;
                    if (!MathUtils.eq(s, [1, 1, 1]))
                        needsScale = true;
                    // Mark the node for cleanup.
                    node.setMesh(null);
                    modifiedNodes.push(node);
                }
                if (!needsTranslation)
                    batchTranslation.dispose();
                if (!needsRotation)
                    batchRotation.dispose();
                if (!needsScale)
                    batchScale.dispose();
                pruneUnusedNodes(modifiedNodes, logger);
                numBatches++;
                numInstances += nodes.length;
            }
        }
        if (numBatches > 0) {
            logger.info(`${NAME}: Created ${numBatches} batches, with ${numInstances} total instances.`);
        }
        else {
            logger.info(`${NAME}: No meshes with ≥${options.min} parent nodes were found.`);
        }
        if (batchExtension.listProperties().length === 0) {
            batchExtension.dispose();
        }
        logger.debug(`${NAME}: Complete.`);
    });
}
function pruneUnusedNodes(nodes, logger) {
    let node;
    let unusedNodes = 0;
    while ((node = nodes.pop())) {
        if (node.listChildren().length ||
            node.getCamera() ||
            node.getMesh() ||
            node.getSkin() ||
            node.listExtensions().length) {
            continue;
        }
        const nodeParent = node.getParentNode();

        if (nodeParent) {

            nodes.push(nodeParent);
            nodeParent.removeChild(node)
        }
            
        // node.dispose();
        unusedNodes++;
    }
    logger.debug(`${NAME}: Removed ${unusedNodes} unused nodes.`);
}
function createBatch(doc, batchExtension, mesh, count) {
    const buffer = mesh.listPrimitives()[0].getAttribute('POSITION').getBuffer();
    const batchTranslation = doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array(3 * count))
        .setBuffer(buffer);
    const batchRotation = doc
        .createAccessor()
        .setType('VEC4')
        .setArray(new Float32Array(4 * count))
        .setBuffer(buffer);
    const batchScale = doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array(3 * count))
        .setBuffer(buffer);
    return batchExtension
        .createInstancedMesh()
        .setAttribute('TRANSLATION', batchTranslation)
        .setAttribute('ROTATION', batchRotation)
        .setAttribute('SCALE', batchScale);
}