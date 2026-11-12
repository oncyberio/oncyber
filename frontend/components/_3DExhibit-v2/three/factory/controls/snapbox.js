// @ts-check

import Camera from "@3camera"

import { CANVAS, CURRENT_SPACE } from "@3constants";

import { Group, Raycaster as ThreeRaycaster, Vector3, Matrix3, Plane, Mesh, Object3D, Box3 } from "three";

import { SpaceComponent } from "../abstract/spacecomponent";



const tmpDir = new Vector3()



export class SnapBox  {

    constructor(opts) {

        /** @type { SpaceComponent } */
        this.currentObject = null

        this.hitMeshes = []

        this.mouseOffset = new Vector3()

        this.spaceMeshes = []

        if(!CURRENT_SPACE.roomParameters.isFuture)  {

            CURRENT_SPACE.space.scene.spaceScene.traverse(obj => {

                if(this.isValidDropSceneMesh(obj)) {

                    this.spaceMeshes.push(obj)
                }
            })
        }
    }


    isValidDropSceneMesh(obj) {

        return obj.visible &&
                // @ts-ignore
                obj.isMesh &&
                obj !== CURRENT_SPACE.space.scene.background
    }

    /**
     * 
     * @param {SpaceComponent} object 
     * @returns 
     */
    setCurrentObject(object) {

        if (this.currentObject === object) return

        this.currentObject = object

        if (this.currentObject == null) {

            this.hitMeshes = []
        }
        else if (CURRENT_SPACE.roomParameters.isFuture) {

            this.hitMeshes = CURRENT_SPACE.space.kitbash.raycastMeshes.filter(
                mesh => object.raycastMesh !== mesh
            )
        }
        else {

            this.hitMeshes = this.spaceMeshes.filter(
                mesh => object.raycastMesh !== mesh
            )
        }
    }

    raycaster = new ThreeRaycaster()

    mousevec = { x: 0, y: 0 }

    hitNormal = new Vector3()

    getNDC(e) {

        const rect = CANVAS.getBoundingClientRect();

        this.mousevec.x =  ((e.clientX - rect.left) / rect.width) * 2 - 1

        this.mousevec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        return this.mousevec
    }

    /**
     * @param { MouseEvent } e
     * @returns { import('three').Intersection & { spaceItem?: any } }
     */
    hitTest(e) {

        const mousevec = this.getNDC(e)

        this.raycaster.setFromCamera(mousevec, Camera.current)

        this.raycaster.ray.direction.add(this.mouseOffset).normalize()

        let intersections = this.raycaster.intersectObjects(this.hitMeshes, false)

        if(intersections.length) return intersections[0]

        return null
    }


    tmpNormal = new Vector3()

    tmpMat3 = new Matrix3()

    tmpIntersect = new Vector3()

    _dragPlane = new Plane()


    /**
     * @param { MouseEvent } e
     */
    onMouseDown(e) {

        const mousevec = this.getNDC(e)

        this.raycaster.setFromCamera(mousevec, Camera.current)

        const dir1 = this.raycaster.ray.direction
        
        const dir2 = tmpDir.copy(this.currentObject.position)

        dir2.y -= this.getYOffset()
        
        dir2.sub(this.raycaster.ray.origin).normalize()

        this.mouseOffset.subVectors(dir2, dir1)
    }

    // planHelper = new PlaneHelper(this._dragPlane, 100, 0xff0000)

    /**
     * @param { MouseEvent } e
     */
    onMouseMove(e) {

        this.lastDragX = e.clientX

        this.lastDragY = e.clientY

        let then = performance.now()

        let result = this.hitTest(e)

        // console.log("hit test", result?.object?.parent?.data?.id)

        if(result == null) {

            // console.log("no hit")

            this._dragPlane.setFromNormalAndCoplanarPoint(
                this.currentObject.getWorldDirection(this.tmpNormal),
                this.currentObject.position
            )


            // test intersection of line from camera with the drag plane
            let hit = this.raycaster.ray.intersectPlane(this._dragPlane, this.tmpIntersect)

            if(hit == null) {
                //
                hit = this.tmpNormal.copy(this.raycaster.ray.direction)
                        .setLength(10)
                        .add(this.raycaster.ray.origin)
            }

            this.currentObject.position.copy(hit)

            return
        }

        this.currentObject.position.copy(result.point)

        this.currentObject.translateY(this.getYOffset())
    }


    getYOffset() {

        if (this.currentObject.isKitBash) return 0

        let size = this.currentObject.userData._size

        if (size == null) {

            let box = new Box3()

            box.setFromObject(this.currentObject)

            size = box.getSize(new Vector3())

            this.currentObject.userData._size = size
        } 

        // translates the 3D mesh so that the front face is at the hit point
        
        return size.y / 2
    }
}