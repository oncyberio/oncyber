import { Matrix3, Matrix4 } from "three";

const instanceMatrix = new Matrix4();
const worldMatrix = new Matrix4();
const normalMatrix = new Matrix3();

/**
 * Read an intersection's geometry-local face normal in world coordinates.
 * InstancedMesh raycasts retain the instance ID but report the container object.
 * @param {import("three").Intersection} hit
 * @param {import("three").Vector3} target
 * @returns {import("three").Vector3 | null}
 */
export function getSurfaceNormal(hit, target) {
    if (!hit?.face?.normal) return null;

    worldMatrix.copy(hit.object.matrixWorld);
    if (hit.object.isInstancedMesh && hit.instanceId != null) {
        hit.object.getMatrixAt(hit.instanceId, instanceMatrix);
        worldMatrix.multiply(instanceMatrix);
    }

    normalMatrix.getNormalMatrix(worldMatrix);
    return target.copy(hit.face.normal).applyNormalMatrix(normalMatrix);
}
