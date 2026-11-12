// @ts-check

import { Color, Matrix3, Mesh, Object3D, Plane, Quaternion, Ray, Vector3 } from "three";


/**
 * @typedef { object } CPointerEvent
 * @property { import("three").Vector3 } intersect
 * @property { Ray } ray
 * @property { PointerEvent } raw
 */

/**
 * @typedef { (e: CPointerEvent) => void } PointerHandler
 *
 * @typedef {any} HanldeOptions
 *
 * @typedef { object } HandleOpts
 * @property {HanldeOptions} opts
 * @property {Mesh} raycastMesh
 * @property {() => string} [getCursor]
 * @property { () => Plane } getRaycastPlane()
 * @property {PointerHandler} onPointerDown
 * @property {PointerHandler} onPointerMove
 * @property {() => void} onPointerUp
 * @property {() => void} onPointerOut
 *
 * @typedef { Object3D & HandleOpts } Handle
 *
 */

/**
 * @typedef { "world" | "local" } PivotSpace
 */



 export const xDir = new Vector3(1, 0, 0)
 export const yDir = new Vector3(0, 1, 0)
 export const zDir = new Vector3(0, 0, 1)



 const tmpWPosition = new Vector3()
 const tmpWQuaternion = new Quaternion()
 const tmpNormal = new Vector3()

 const tmpNormalMatrix = new Matrix3()


/**
 *
 * @param { Handle } handle
 * @param { Plane } target
 */
export function getHandlePlane(handle, target) {

    const ctx = handle.opts.ctx

    const normal = handle.opts.normal

    tmpNormal.copy(normal)

    // tmpNormalMatrix.getNormalMatrix(ctx.matrixWorld)

    // tmpNormal.applyNormalMatrix(tmpNormalMatrix).normalize()

    if(ctx.space === "local") {

        tmpNormal.applyQuaternion(ctx.worldQuaternion)
    }

    target.setFromNormalAndCoplanarPoint(tmpNormal, ctx.worldPosition)

    return target

}

let c = new Color()

/**
 *
 * @param {number} color
 */
export function sRGBToLinear(color) {
    c.setHex(color)
    return c.convertSRGBToLinear().getHex()
}
