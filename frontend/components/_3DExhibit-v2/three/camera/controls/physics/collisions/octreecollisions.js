// @ts-check
import { Capsule } from "../lib/capsule";


import * as THREE from "three";

import { Ray, Vector3 } from "three";

import { AbstractCollisions } from "./abstract";

import { STATS } from "@3constants";

import { SpaceItem as SpaceComponent } from "@3factory/abstract/spaceitem";

import { TopOctree } from "../lib/topoctree";

const cache = {};

const TRESHOLD_OCTREE_BUILD_TIME = 100


// A contact whose push-out leans less than about 66 degrees is floor.
const FLOOR_NORMAL_Y = 0.4

// Halvings when settling onto a floor below: snap distance / 2^8 (about 1 mm).
const SNAP_STEPS = 8

export class OctreeCollisions extends AbstractCollisions {

    constructor(opts) {

        super(opts)


        this.space = opts.space

        this.collisionResult = {
            playerOnFloor: false,
            endPosition: null,
            startPosition: new Vector3(),
            intersectedMeshes: null
        };

        this.isFlymode = false


        this.capsuleStart = new THREE.Vector3(0,  (opts.position.y - this.collider_height) + this.capsuleRadius, 0);

        this.capsuleEnd = new THREE.Vector3(0, opts.position.y, 0);

        this.capsule = new Capsule(
            this.capsuleStart,
            this.capsuleEnd,
            this.capsuleRadius
        );


        this.stats = { ctime:0, cnb: 0, cmtime: "", genTrisTime: 0, buildTime: 0, tris: 0, subtrees: 0, parseTime: 0, serializeTime: 0 }

        // VISUALIZER FOR CAPSULE
        // const geometry = new THREE.CylinderGeometry( this.capsuleRadius, this.capsuleRadius, this.capsule.end.y - this.capsule.start.y, 32 );

        // const material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
        // this.helper = new THREE.Mesh( geometry, material );
        // this.helper.geometry.translate(0, 1, 0);

        // Scene.add(this.helper)
    }

    async init() {

        await this.setCollider(this.space)
    }

    /**
     *
     * @param {import("@gltypes").SpaceData} space
     * @returns
     */
    async setCollider(space)  {

        const isFuture = this.roomParameters?.isFuture

        // const key = this.roomParameters?.paths?.high

        // if(!isFuture) {

        //     this.worldOctree = await this.tryLoadOctreeFromCache(key)
        // }

        // if (this.worldOctree == null) {

        this.createOctree(space, isFuture)

        //     if (!isFuture) {

        //         let totalBuildTime = this.stats.buildTime + this.stats.genTrisTime

        //         if(totalBuildTime > TRESHOLD_OCTREE_BUILD_TIME) {

        //             // this.saveOctreeToCache(key, this.worldOctree)
        //         }
        //     }

        // }
    };

    // async tryLoadOctreeFromCache(key) {

    //     if (!key) return null;

    //     let octree = cache[key]

    //     if(octree == null) {

    //         const octreeResp = await cacheStorages.octrees.get(key)

    //         if(octreeResp?.ok) {

    //             const rawBuffer = await octreeResp.arrayBuffer()

    //             const then = performance.now()

    //             const buffer = new Float32Array(rawBuffer)

    //             octree = loadOctree(buffer)

    //             const now = performance.now()

    //             this.stats.parseTime = now - then

    //             cache[key] = octree
    //         }
    //     }

    //     return octree
    // }

    // /**
    //  * @param { string } key
    //  * @param { Octree } octree
    //  */
    // async saveOctreeToCache(key, octree) {

    //     if (!key) return;

    //     cache[key] = octree

    //     const then = performance.now()

    //     const buffer = saveOctree(octree)

    //     const now = performance.now()

    //     this.stats.serializeTime = now - then

    //     const r = await cacheStorages.octrees.put(
    //         key,
    //         new Response(buffer.buffer, {
    //             headers: {
    //                 "content-type": "application/octet-stream",
    //                 "content-length": String(buffer.byteLength)
    //             }
    //         })
    //     )

    //     return r

    // }

    /**
     *
     * @param {import("@gltypes").SpaceData} space
     * @param { boolean } isFuture
     * @returns
     */
    createOctree(space, isFuture) {

        this.worldOctree = new TopOctree()

        let then = performance.now()

        if (isFuture) {

            for(let i = 0; i < space.colliders.length; i++) {

                const collider = space.colliders[i]

                collider.updateWorldMatrix(true, true)

                if(collider.userData.component == null) {

                    this.worldOctree.addCollider(collider)
                }
                else {

                    this.addCollider(collider.userData.component, false)
                }
            }

            this.worldOctree.updateDynOctree()

            // this.worldOctree.helper?.update()
        }
        else {

            let colliders = space.colliders.length > 0 ? space.colliders : [space.scene.spaceScene]

            this.worldOctree.createStaticOcteee(colliders)
        }

        let now = performance.now()

        // this.stats.genTrisTime =  mid - then
        this.stats.buildTime = now - then

        // console.log("octree gen time: fromGraphnode", this.stats.genTrisTime, "millis")
        console.log("octree total gen time", this.stats.buildTime, "millis")

        if(STATS) {

            this.stats.tris = this.worldOctree.stats.tris
        }

        // this.worldOctree.helper?.update()
    }

    collisionCbs = new WeakMap()
    /**
     *
     * @param { SpaceComponent } component
     */
    addCollider(component, build = true) {

        const mesh = component.collisionMesh || component.raycastMesh

        const collider = this.worldOctree.addCollider(mesh)

        const matrixCb = () => {

            if (component.isScriptInteracting) return

            this.worldOctree.updateCollider(collider, false)
        }

        const collisionCb = () => {

            this.worldOctree.updateCollider(collider, true)
        }

        this.collisionCbs.set(component, { matrixCb, collisionCb })

        component.onMatrixChanged(matrixCb)

        component.on(component.EVENTS.COLLISON_CHANGED, collisionCb)

        if(build) {

            this.worldOctree.updateDynOctree()
        }
    }

    /**
     *
     * @param { SpaceComponent } component
     * @param { boolean } build
     */
    removeCollider(component, build = true) {

        const mesh = component.collisionMesh || component.raycastMesh

        this.worldOctree.removeCollider(mesh)

        const cbs = this.collisionCbs.get(component)

        if(cbs) {

            component.offMatrixChanged(cbs.matrixCb)

            component.off(component.EVENTS.COLLISON_CHANGED, cbs.collisionCb)
        }

        if(build) {

            this.worldOctree.updateDynOctree()
        }
    }

    // moveCapsule(position) {

    //     this.capsule.start
    //         .setX(position.x)
    //         .setY(position.y - this.collider_height + this.capsuleRadius)
    //         .setZ(position.z);

    //     this.capsule.end
    //         .setX(position.x)
    //         .setY(position.y)
    //         .setZ(position.z);
    // }


    tmpNormal = new Vector3()

    playerCollitions(position, deltaPosition, isThirdPerson, snapDistance = 0) {

        // if( isThirdPerson ) {


        // }

        // console.log( this.collider_height )

        // const exitedFly = !this.isFlymode && this.wasFlymode


        let then = 0

        if(STATS) {
            then = performance.now()
        }

        this.capsule.start
            .setX(position.x)
            // .setY(position.y - USER_HEIGHT)
            .setZ(position.z);

        this.capsule.end
            .setX(position.x)
            // .setY(this.world.capsule.end.y)
            .setZ(position.z);

        const flyHeight = this.capsuleRadius + 0.1

        // let adjutH = 0

        if (!isThirdPerson) {

            let y =   position.y //Math.round(position.y * 100) / 100

            const collider_height = this.isFlymode ? flyHeight : this.collider_height

            this.capsule.start.setY(y - collider_height + this.capsuleRadius)

            this.capsule.end.setY(y)

            // adjutH = collider_height - flyHeight

        } else {

            this.collider_height = this.isFlymode ? flyHeight :  this.getColliderHeight()

            if (deltaPosition) {

                this.capsuleStart.y = this.capsule.end.y - this.collider_height + this.capsuleRadius;

                this.capsuleEnd.y = this.capsule.end.y;

                this.capsule.start.setY(this.capsuleStart.y + deltaPosition.y);

                this.capsule.end.setY(this.capsuleEnd.y + deltaPosition.y);

                // adjutH = this.collider_height - flyHeight
            }

        }

        const result = this.worldOctree.capsuleIntersect(this.capsule);


        this.playerOnFloor = false;

        this.collisionResult.result = result

        // save same cpu
        // When the user is exactly standing on floor
        // Intersection dept will be 0

        var onFloor = false
        // console.log(res)
        if (result) {



            onFloor = result.normal.y > FLOOR_NORMAL_Y;


            //this.playerOnFloor = onFloor

            // console.log("intersectedMeshes", result.intersectedMeshes)
            // if (this.roomParameters.slug === "hub_v3") {
                // console.log("intersectedMeshes", result.intersectedMeshes);
                // console.log(result.intersectedMeshes)
                // if( result.intersectedMeshes && (result.intersectedMeshes[0].includes('platform0') || (result.intersectedMeshes[1] && result.intersectedMeshes[1].includes('platform0')))){

                //     console.log(result.intersectedMeshes, result.normal.y, result.depth)

                // }

            // }

            // console.log(result.normal)

            // if (exitedFly) debugger

            // if (exitedFly && result.normal.y < 0 && adjutH > 0) {

            //     result.depth = this.capsule.end.y - this.capsule.start.y + this.capsuleRadius * 2 - result.depth

            //     result.normal.y = -result.normal.y
            // }

            const adj = this.tmpNormal.copy(result.normal).multiplyScalar(result.depth)

            this.capsule.translate(adj);



            // this.capsule.translate(this.tmpNormal.copy(result.normal).multiplyScalar(result.depth));

        }

        if (!onFloor && snapDistance > 0) {

            // Probe below: if a floor is within reach, settle onto it.
            this.tmpNormal.set(0, -snapDistance, 0)
            this.capsule.translate(this.tmpNormal)
            const below = this.worldOctree.capsuleIntersect(this.capsule)
            if (below && below.normal.y > FLOOR_NORMAL_Y) {
                // Settle vertically only: a sideways push from an edge or lip
                // would stall the player mid-stride. The push out of a slope
                // (or a seam between two triangles) leans back up the slope,
                // so it can't give the height directly: search for the lowest
                // free height between the probe and where the player was.
                let low = 0, high = snapDistance
                for (let i = 0; i < SNAP_STEPS; i++) {
                    const mid = (low + high) / 2
                    // the capsule stays at the probe: test `mid` above it
                    this.capsule.translate(this.tmpNormal.set(0, mid, 0))
                    const hit = this.worldOctree.capsuleIntersect(this.capsule)
                    this.capsule.translate(this.tmpNormal.set(0, -mid, 0))
                    if (hit) low = mid
                    else high = mid
                }
                this.capsule.translate(this.tmpNormal.set(0, high, 0))
                onFloor = true
            }
            else {
                this.capsule.translate(this.tmpNormal.set(0, snapDistance, 0))
            }
        }

        this.playerOnFloor = onFloor

        this.collisionResult.playerOnFloor = onFloor


        // console.log(onFloor)

        this.collisionResult.endPosition = this.capsule.end


        this.collisionResult.startPosition.copy(this.capsule.start)
        this.collisionResult.startPosition.y -= this.capsuleRadius


        // if (this.helper) {
        //     this.helper.position.copy(this.collisionResult.startPosition)
        // }

        // @ts-ignore
        this.collisionResult.intersectedMeshes = result?.intersectedMeshes


        if(STATS) {
            this.stats.ctime += performance.now() - then
            this.stats.cnb++
            this.stats.cmtime = (this.stats.ctime / this.stats.cnb).toFixed(4)
        }

        this.wasFlymode = this.isFlymode

        return this.collisionResult
    }

     /** @param { Ray }  ray */
     rayIntersect(ray) {

        return this.worldOctree.rayIntersect(ray)

    }

    /**
     *
     * @param {Vector3} cameraPos
     */
    reset(cameraPos) {
        this.capsule.start.set(cameraPos.x, (cameraPos.y - this.collider_height)+ this.capsuleRadius, cameraPos.z);

        this.capsule.end.set(
            cameraPos.x,
            cameraPos.y,
            cameraPos.z
        );
    }
    setCapsule(capsule) {
        this.capsule.start.copy(capsule.start);

        this.capsule.end.copy(capsule.end);
    }

    dispose() {

        if(this.wasDiposed) return

        this.wasDiposed = true

        this.worldOctree?.dispose()
    }
}
