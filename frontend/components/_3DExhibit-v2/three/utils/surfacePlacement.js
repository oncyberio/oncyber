import { Vector3 } from "three";
import { getSurfaceNormal } from "./surfaceNormal";

const normal = new Vector3();
const lookTarget = new Vector3();
const worldGrabPoint = new Vector3();
const worldPosition = new Vector3();

/**
 * Place a planar object's grabbed point on the visible side of a surface.
 * The grab point is in object-local coordinates, before its scale is applied.
 * @param {import("three").Object3D} object
 * @param {import("three").Intersection} hit
 * @param {import("three").Vector3} localGrabPoint
 * @param {import("three").Vector3} rayDirection
 * @returns {boolean}
 */
export function placeOnSurface(object, hit, localGrabPoint, rayDirection) {
    if (!getSurfaceNormal(hit, normal) || normal.lengthSq() === 0) return false;

    // Imported double-sided surfaces may have normals facing away from us.
    if (normal.dot(rayDirection) > 0) normal.negate();

    // Orient at the hit before restoring the grabbed-point offset. Object3D's
    // lookAt accounts for rotated parents with uniform scale.
    worldPosition.copy(hit.point);
    if (object.parent) object.parent.worldToLocal(worldPosition);
    object.position.copy(worldPosition);
    object.lookAt(lookTarget.copy(hit.point).add(normal));
    object.updateWorldMatrix(true, false);

    worldGrabPoint.copy(localGrabPoint).applyMatrix4(object.matrixWorld);
    worldPosition
        .setFromMatrixPosition(object.matrixWorld)
        .add(hit.point)
        .sub(worldGrabPoint);
    if (object.parent) object.parent.worldToLocal(worldPosition);
    object.position.copy(worldPosition);
    object.updateWorldMatrix(true, false);
    return true;
}
