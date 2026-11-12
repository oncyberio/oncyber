// @ts-check

import { Box3, Matrix4, Object3D, Ray } from "three";
import { BaseOctree } from "./baseoctree";
import { genTrianglesFromObject } from "./utils";

export class DynCollider {

    /**
     *
     * @param {Object} mesh
     */
    constructor(mesh) {

        /** @type { Object3D } */
        this.mesh = mesh

        this.box = new Box3()

        this.octree = new BaseOctree(this.box)

        this.triangles = []

        this.prevMatrix = mesh.matrixWorld.clone()

        this.prevMatrixInverse = this.prevMatrix.clone().invert()

        this.multMatrix = new Matrix4()
    }

    traverseTriangles(callback) {

        this.octree.traverseTriangles(callback)
    }

    genTriangles() {

        return genTrianglesFromObject(this.mesh, this.triangles)
    }

    build() {

        this.octree.build(this.triangles)
    }

    
    update(genTris = false) {

        if (genTris) {

            this.triangles.length = 0

            this.triangles = this.genTriangles()
        }
        else {

            this.multMatrix.multiplyMatrices(this.mesh.matrixWorld, this.prevMatrixInverse)

            this.prevMatrix.copy(this.mesh.matrixWorld)

            this.prevMatrixInverse.copy(this.prevMatrix).invert()

            for (let i = 0; i < this.triangles.length; i++) {

                this.triangles[i].applyMatrix4(this.multMatrix)
            }
        }

        this.build()

    }

    /**
     * @param { Box3 } box
     */
    expandBox(box) {

        box.union(this.box)
    }

    /**
     * @param { Box3 } box
     * @returns { boolean }
     */
    intersectsBox(box) {

        return box.intersectsBox(this.box)
    }

    getShapeTriangles(shape, results) {

        if (this.mesh.userData._disabled) return results

        return this.octree.getShapeTriangles(shape, results)
    }
}