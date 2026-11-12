
// @ts-check

import { Box3, Line3, Mesh, Object3D, Plane, Ray, Sphere, Triangle, Vector3 } from "three";
import { Capsule } from "./capsule";
import { OctreeTriangle } from "./octreetriangle";
import { BaseOctree } from "./baseoctree";
import { DynCollider } from "./octreedyncollider";
import { genTriangles } from "./utils";
import { OctreeHelper } from "./octreehelper";
import Scene from "@3scene";

const _v1 = new Vector3();
const _v2 = new Vector3();
const _plane = new Plane();
const _line1 = new Line3();
const _line2 = new Line3();
const _sphere = new Sphere();
const _capsule = new Capsule();




const defaultOpts = {
    leadCapacity: 1024,
    maxDepth: 8
}


export class TopOctree  {

    constructor(opts = {}) {

        this.staticOctree = new BaseOctree(new Box3(), { ...defaultOpts, ...opts });

        this.dynOctree = new BaseOctree(new Box3(), { leafCapacity: 8, maxDepth: 1 });

        this.dynColliders = [];

        this.intersectedMeshes = [];

        if (process.env.NODE_ENV === "development") {

            // @ts-ignore
            window.$$oc = this
        }

        // this.helper = new OctreeHelper(this.dynOctree)
        // Scene.add(this.helper)

        this.stats = { tris: 0 }

    }

    /**
     *
     * @param { Object3D[] } groups
     */
    createStaticOcteee(groups) {

        let then = performance.now();

        const tris =  genTriangles(groups);

        this.stats.tris = tris.length

        let mid = performance.now();

        this.staticOctree.build(tris);

        let now = performance.now();

        // console.log("static octree genTris time: ", mid - then, "ms");
        // console.log("static octree build time: ", now - mid, "ms");

    }


    addCollider(mesh) {

        /** @type { DynCollider } */
        let collider = mesh.userData._collider;

        if (collider == null) {

            collider = new DynCollider(mesh);

            mesh.userData._collider = collider;

            collider.genTriangles();

            this.stats.tris += collider.triangles.length

            collider.build();

            this.dynColliders.push(collider);

        }

        return collider;
    }

    removeCollider(mesh) {

        let collider = mesh.userData._collider;

        if (collider != null) {

            mesh.userData._collider = null;

            this.stats.tris -= collider.triangles.length

            this.dynColliders.splice(this.dynColliders.indexOf(collider), 1);
        }
    }

    updateCollider(collider, genTris = false) {

        const then = performance.now();

        collider.update(genTris);

        this.updateDynOctree();        

        const now = performance.now();

        console.log("dyn octree update time: ", now - then, "ms");
    }

    updateDynOctree() {

        this.dynOctree.build(this.dynColliders);

        // this.helper.update();
    }

    getShapeTriangles(shape, triangles) {

        this.staticOctree.getShapeTriangles(shape, triangles);

        this.dynOctree.getShapeTriangles(shape, triangles);
    }

    /**
     * @param { Capsule } capsule
     * @returns { import("./baseoctree").CapsuleCollisionResult }
     */
    capsuleIntersect(capsule) {

        _capsule.copy(capsule);

        /** @type { OctreeTriangle[] } */
        const triangles = [];

        /** @type { import("./baseoctree").CapsuleCollisionResult } */
        let result = null;
        
        let hit = false;

        this.getShapeTriangles(_capsule, triangles);

        this.intersectedMeshes.length = 0

        for (let i = 0; i < triangles.length; i++) {

            let tri = triangles[i]

            result = tri.capsuleIntersect(_capsule);

            if (result != null) {

                hit = true;

                const meshName = tri.meshName

                if(meshName && this.intersectedMeshes.indexOf(meshName) < 0) {

                    this.intersectedMeshes.push(meshName)
                }

                _capsule.translate(result.normal.multiplyScalar(result.depth));
            }
        }

        if (hit) {

            const collisionVector = _capsule
                .getCenter(new Vector3())
                .sub(capsule.getCenter(_v1));
            
                const depth = collisionVector.length();

            return {
                normal: collisionVector.normalize(),
                depth: depth,
                intersectedMeshes: this.intersectedMeshes,
            };
        }

        return null;
    }

    rayIntersect(ray) {

        if (ray.direction.length() === 0) return;

        /** @type { OctreeTriangle[] } */
        const triangles = [];

        let triangle;
        let position;
        let distance = 1e100;

        this.getShapeTriangles(ray, triangles);

        for (let i = 0; i < triangles.length; i++) {

            const tri = triangles[i];

            const result = tri.rayIntersect(ray, _v1);

            if (result) {

                const newdistance = result.sub(ray.origin).length();

                if (distance > newdistance) {
                    position = result.clone().add(ray.origin);
                    distance = newdistance;
                    triangle = tri;
                }
            }
        }

        return distance < 1e100
            ? { distance: distance, triangle: triangle, position: position }
            : null;
    }


    dispose() {

        if (this.wasDisposed) return;

        this.wasDisposed = true;

        this.dynColliders.forEach(collider => {

            collider.mesh.userData._collider = null;
        });

        this.dynColliders.length = 0;
    }
}