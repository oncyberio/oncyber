// @ts-check

import PipeLineMesh from "@3gl/abstract/pipelinemesh";

import { toXYZ } from "@3utils/three";

import { BoxGeometry, MeshBasicMaterial, Box3, Quaternion, Vector3 } from "three";

import Emitter from "@3emitter"

import Events from "@3events"

import { SpaceComponent } from "../../abstract/spacecomponent";


const MULTI_OPTS = { isMulti: true };

export class MultiSelectMesh extends PipeLineMesh {

    constructor(opts) {

        super(
            new BoxGeometry(1, 1, 1),
            new MeshBasicMaterial({
                visible: false,
                transparent: true,
                color: 0xff0000,
                opacity: 0.2,
                depthTest: false,
                depthWrite: false,
            }),
        )

        this.isMultiSelectMesh = true

        this.isSelectable = true

        /** @type { SpaceComponent[] } */
        this.attachedObjects = []

        this._enabled = false

        this.visible = false
    }

    /**
     * @param { SpaceComponent[] } objects
     */
    setAttachedObjects(objects) {

        if (this.enabled) {

            this.removeEvents()
        }

        this.attachedObjects = objects.filter(object => object.prefTransformControls != null)

        this.attachedObjects.forEach(object => {

            if(object.isKitBash) {

                this.hasKitbash = true
            }
        })

        this.enabled = objects.length > 0

        if (this.enabled) {

            this.updateBoundingBox()
        }
    }

    onObjectChange = () => {
        //
        if(this.isDragging) return

        this.boxNeedsUpdate = true
    }

    onPreUpdate = () => {
        //
        if (this.boxNeedsUpdate) {

            this.updateBoundingBox()

            this.boxNeedsUpdate = false
        }
    }

    get enabled() {

        return this._enabled
    }

    set enabled(value) {

        if (this._enabled === value) return

        this._enabled = value

        if (this._enabled) {

            this.addEvents()
        }
        else {

            this.removeEvents()
        }
    }

    addEvents() {

        Emitter.on(Events.PRE_UPDATE, this.onPreUpdate)

        this.attachedObjects?.[0]?.onMatrixChanged(this.onObjectChange)
    }

    removeEvents() {
        //
        Emitter.off(Events.PRE_UPDATE, this.onPreUpdate)

        this.attachedObjects?.[0]?.offMatrixChanged(this.onObjectChange)
    }

    _box = new Box3()

    updateBoundingBox = () => {

        this._box.makeEmpty()

        this.attachedObjects.forEach(object => {

            this._box.expandByObject(object.raycastMesh)
        })

        this._box.min.addScalar(-0.01)
        this._box.max.addScalar(0.01)

        this._box.getCenter(this.position)

        this._box.getSize(this.scale)

        this.updateMatrixWorld()
    }


    _initPositionInv = new Vector3()
    _initQuaternionInv = new Quaternion()
    // _initScaleInv = new Vector3()

    _deltaPosition = new Vector3()
    _deltaQuaternion = new Quaternion()
    // _deltaScale = new Vector3()


    _initCoords = new WeakMap()

    _getObjectInitCoords(object) {
        //
        let coords = this._initCoords.get(object)

        if (!coords) {

            coords = {
                position: object.position.clone(),
                quaternion: object.quaternion.clone(),
                rotation: object.rotation.clone(),
                // scale: object.scale.clone(),
            }

            this._initCoords.set(object, coords)

            return coords
        }

        coords.position.copy(object.position)
        coords.quaternion.copy(object.quaternion)
        coords.rotation.copy(object.rotation)

        return coords
    }


    dragStart() {
        //
        // console.log('MultiSelectMesh dragStart')
        this.isDragging = true;

        this.getWorldPosition(this._initPositionInv).multiplyScalar(-1);

        this.getWorldQuaternion(this._initQuaternionInv).invert();

        // this.getWorldScale(this._initScaleInv).set(
        //     1 / this._initScaleInv.x,
        //     1 / this._initScaleInv.y,
        //     1 / this._initScaleInv.z,
        // )

        this._objectsInitCoords = [] 

        this.attachedObjects.forEach(object => {

            const startCoords = this._getObjectInitCoords(object);

            this._objectsInitCoords.push(startCoords)

            // @ts-ignore
            object.dragStart?.(MULTI_OPTS);
        });
    }

    updateCoords(opts) {

        // compute the delta of coords and apply it to all attached objects

        if (this.hasKitbash && this.position.y < 0) {

            this.position.y = 0
        }

        const deltaPosition = this._deltaPosition.copy(this.position).add(this._initPositionInv);

        const deltaQuaternion = this._deltaQuaternion.copy(this.quaternion).multiply(this._initQuaternionInv);

        // console.log('MultiSelectMesh updateCoords', deltaPosition)

        // const deltaScale = this._deltaScale.copy(this.scale).multiply(this._initScaleInv);

        this.attachedObjects.forEach((object, index) => {

            if(object.prefTransformControls == null) return

            const initCoords = this._objectsInitCoords[index];

            object.position.copy(initCoords.position).add(deltaPosition);

            object.quaternion.copy(initCoords.quaternion).multiply(deltaQuaternion);

            // object.scale.copy(initCoords.scale).multiply(deltaScale);

            object.updateMatrixWorld();

            // @ts-ignore
            object.updateCoords?.(opts);
        });
    }


    dragEnd() {
        //
        // console.log('MultiSelectMesh dragEnd')

        this.isDragging = false;

        this.attachedObjects.forEach(object => {

            // @ts-ignore
            object.dragEnd?.(MULTI_OPTS);
        });

        
        let payloads = []

        this.attachedObjects.forEach((object, index) => {
            //
            payloads.push({
                targetMesh: object,
                coords : {
                    position: toXYZ(object.position),
                    rotation: toXYZ(object.rotation),
                    // scale: toXYZ(object.scale)
                },
                undo: {
                    position: toXYZ(this._objectsInitCoords[index].position),
                    rotation: toXYZ(this._objectsInitCoords[index].rotation),
                    // scale: toXYZ(this._objectsInitCoords[index].scale)
                }
            })
        })
        
        let event = {

            type: Events.ARTWORK_COORDS_CHANGED,

            value: {

                payloads,
                
                source: "MultiSelectMesh"
            }
        }

        Emitter.emit(Events.CUSTOM, event)
    }

}