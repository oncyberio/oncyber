// @ts-check


import { Box3, Line3, Mesh, Object3D, Plane, Ray, Sphere, Triangle, Vector3 } from "three";

import { Capsule } from "./capsule";

import { isMesh } from "@3utils/three";

import { OctreeTriangle } from "./octreetriangle";
import { splitBox } from "./utils";

const _v1 = new Vector3();
const _v2 = new Vector3();
const _plane = new Plane();
const _line1 = new Line3();
const _line2 = new Line3();
const _sphere = new Sphere();
const _capsule = new Capsule();

/**
 * @typedef { object } CapsuleCollisionResult
 * @property { Vector3 } normal
 * @property { number } depth
 * @property { string[] } [intersectedMeshes]
 * 
 * @typedef { Ray | Capsule } CollisionShape 
 * 
 * @typedef { object } Collider
 * @property { (box: Box3) => void } expandBox
 * @property { (box: Box3) => boolean } intersectsBox
 * @property { (shape: CollisionShape, results: OctreeTriangle[]) => OctreeTriangle[] } getShapeTriangles
 * @property { (callback: (triangle: OctreeTriangle) => void) => void } traverseTriangles
 */



export class BaseOctree {

    constructor(box, opts = {}) {

        /** @type { Collider[] } */
        this.colliders = [];

        /** @type { BaseOctree[] } */
        this.subTrees = [];

        /** @type { Box3 } */
        this.box = box;

        this.leafCapacity = opts.leafCapacity || 1024;

        this.maxDepth = opts.maxDepth || 8;
    }

    traverseTriangles(callback) {

        for (let i = 0; i < this.colliders.length; i++) {

            this.colliders[i].traverseTriangles(callback);
        }

        for (let i = 0; i < this.subTrees.length; i++) {

            this.subTrees[i].traverseTriangles(callback);
        }
    }

    _calcBox() {
        this.box.copy(this.bounds);

        // offset small ammount to account for regular grid
        this.box.min.x -= 0.1;
        this.box.min.y -= 0.01;
        this.box.min.z -= 0.1;

        this.box.max.x += 0.1;
        this.box.max.y += 0.01;
        this.box.max.z += 0.1;

        return this;
    }

    _split(level) {
        //
        if (!this.box) return;

        if (this.colliders.length < this.leafCapacity && level >= this.maxDepth) {
            //
            return;
        }

        /** @type { BaseOctree[] } */
        const subTrees = splitBox(this.box, this.constructor);

        let colls = this.colliders;
        
        this.colliders = []

        const nofit = [];

        for (let len = colls.length, i = len - 1; i >= 0; i-- ) {

            let collider = colls[i]

            let fit = false;

            for (let i = 0, lensub = subTrees.length; i < lensub; i++) {

                if (collider.intersectsBox(subTrees[i].box)) {

                    fit = true;

                    subTrees[i].colliders.push(collider);
                }
            }

            if (!fit) {

                nofit.push(collider);

                console.error("no fit", collider)
            }
        }

        for (let i = 0; i < subTrees.length; i++) {

            const len = subTrees[i].colliders.length;

            if (len > 1024 && level < 8) {

                subTrees[i]._split(level + 1);
            }

            if (len !== 0) {

                this.subTrees.push(subTrees[i]);
            }
        }



        return this;
    }

    /**
     * @param { Collider[] } colliders
     */
    build(colliders) {
        //
        this.clear();

        this.colliders = colliders;

        for (let i = 0; i < this.colliders.length; i++) {

            this.colliders[i].expandBox(this.bounds)

        }

        this._calcBox();

        this._split(0);

        return this;
    }

    clear() {

        this.colliders.length = 0;

        this.subTrees.length = 0;

        this.box.makeEmpty();

        this.bounds = new Box3();
    }

    /**
     * @param { CollisionShape } shape
     * @param { OctreeTriangle[] } results
     */
    getShapeTriangles(shape, results) {

        if (!shape.intersectsBox(this.box)) return;

        for (let i = 0; i < this.colliders.length; i++) {

            this.colliders[i].getShapeTriangles(shape, results);
        }

        for (let i = 0; i < this.subTrees.length; i++) {

            this.subTrees[i].getShapeTriangles(shape, results);
        }

        return results;
    }
}

