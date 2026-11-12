// @ts-check

import {
	Raycaster,
	Vector2,
    Matrix4,
    PerspectiveCamera,
    Frustum,
    BufferGeometry,
    Box3,
    Vector3,
    Sphere} from 'three'

import {
	IS_FIRST_PERSON,
	IS_TOUCH,
    IS_VR

} from '@3constants'

import Emitter from '@3emitter'

import Camera from 	'@3camera'

import Events from  '@3events'

import Players from "@3factory/player"

import { SpaceComponent } from './factory/abstract/spacecomponent'



const tempMatrix = new Matrix4()

const tmpVec3 = new Vector3()

const tmpBoxCorners = Array.from({length: 8}, () => new Vector3())

function getBox3Corners(box, corners) {

    corners[0].set(box.min.x, box.min.y, box.min.z)
    corners[1].set(box.min.x, box.min.y, box.max.z)
    corners[2].set(box.min.x, box.max.y, box.min.z)
    corners[3].set(box.min.x, box.max.y, box.max.z)
    corners[4].set(box.max.x, box.min.y, box.min.z)
    corners[5].set(box.max.x, box.min.y, box.max.z)
    corners[6].set(box.max.x, box.max.y, box.min.z)
    corners[7].set(box.max.x, box.max.y, box.max.z)

    return corners
}

function testFrustumBox(frustum, box, obj) {
    //
    const boxCenter = box.getCenter(tmpVec3)

    // if(obj._bh == null) {

    //     obj._bh = new Mesh(new SphereGeometry(1), new MeshBasicMaterial({color: new Color(0xff0000), depthTest: false, transparent: true}))

    //     Scene.add(obj._bh)
    // }

    // obj._bh.position.copy(boxCenter)
    


    if (!frustum.containsPoint(boxCenter))  return false

    const corners = getBox3Corners(box, tmpBoxCorners)

    // if (obj._bhs == null) {

    //     obj._bhs = corners.map(c => {

    //         const bh = new Mesh(new SphereGeometry(1), new MeshBasicMaterial({color: new Color(0x00ff00), depthTest: false, transparent: true}))

    //         bh.position.copy(c)

    //         Scene.add(bh)

    //         return bh
    //     })
    // }

    // frustum needs to contain at least one point of the box
    // prevent unwanted selection of large objects like terrain, water ...
    for (let j = 0; j < 8; j++) {

        if (frustum.containsPoint(corners[j])) {

            return true
        }
    }

    return false
}





// let objects = []

class Raycast {

	constructor(){

		this.TYPES = {

			COLLIDERS 	    : 'Colliders',

            PLACEHOLDERS    : 'Placeholders',

			ARTWORKS  	    : 'Artworks',

			PORTALS 	    : 'Portals',

            USER_RAYCAST    : 'User_raycast',

            CAMERA_RAYCAST  : 'Camera-raycast',

            FLOORS          : 'Floors',

            FUTURE_ITEMS    : 'FutureItems',

            COMPONENTS      : 'Components',

            STREAMS         : 'Streams',

            LABEL           : 'Label'
		}

        this.hasClicked = false

        this.fps = 0

		// this.registeredObject = {}

        /** @type { import('three').Intersection } */
        this.currentIntersect = null

        // User raycast
        /** @type { SpaceComponent } */
        this.currentSpaceItem = null

        // Camera raycast
        /** @type { SpaceComponent } */
        this.lookedAtItem = null

		this._active 	= false

		this.raycaster 	= new Raycaster()

		this.containerColliders = []

        this.containerPlaceholders = []

		this.containerArtworks = []

        this.containerPortals = []

        this.containerFloors = []

        this.containerFutureItems = []

        this.containerComponents = []

        this.containerStreams = []

        this.containerLabel = null

		//Scene.add(this.container)

		this.mousevec 	= new Vector2(0,0)

        this.vrcontrollermatrix = new Matrix4()

        // Arrow helper
        // const origin = new Vector3( 0, 0, 0 );
        // const length = 1;
        // const hex = 0xff00ff;

        // this.arrowHelper = new ArrowHelper(new Vector3( 1, 2, 0 ).normalize(), origin, length, hex);

        // scene.add(this.arrowHelper);

        if (process.env.NODE_ENV === 'development') {

            window["$$rayc"] = this
        }
	}

	getContainer(type){

		// console.log(type)

		// debugger

		let ct;

		switch(type){

            case this.TYPES.PLACEHOLDERS:

                ct = this.containerPlaceholders

                break

			case this.TYPES.ARTWORKS :

				ct = this.containerArtworks

			break;

            case this.TYPES.PORTALS :

				ct = this.containerPortals

			break;

            case this.TYPES.FLOORS:

                ct = this.containerFloors

                break

			case this.TYPES.COLLIDERS :

				ct = this.containerColliders

			break;

            case this.TYPES.FUTURE_ITEMS :

                ct = this.containerFutureItems

            case this.TYPES.COMPONENTS :

                ct = this.containerComponents

            break;

            case this.TYPES.STREAMS :

                ct = this.containerStreams
            break;

            case this.TYPES.LABEL:

                ct = this.containerLabel

            break;
		}

		return ct
	}

	register ( object, type ){

		this['container' + type] = object

        // console.log("raycaster.registerrrr", type, object)
	}

	unregister ( object, type ){

		const container = this.getContainer( type )

		if( container[ object.id ] ){

			container[ object.id ].remove( object )

			delete container[ object.id ]
		}
	}

    unregisterAll(type) {

        const container = this.getContainer( type )

        container.length = 0

        // console.log("raycaster.unregisterrrr", type, container)
    }

	update( type ){

        if(!this._active) {
            console.warn("raycaster: calling update while active = false")
        }

        if(type === this.TYPES.CAMERA_RAYCAST && Camera.current) {

            this.fps = (this.fps + 1) % 3

            if(this.fps === 0) {

                this.raycaster.set(

                    Camera.current.position,

                    Camera.worldDirection
                )

                this.doRaycastCamera()
            }

        }

        if(this.pointerHasMoved) {

            if(IS_VR) {

                tempMatrix.identity().extractRotation(this.vrcontrollermatrix);

                this.raycaster.ray.origin.setFromMatrixPosition(this.vrcontrollermatrix);

                this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

                this.pointerHasMoved = false

                this.doRaycastUser()
            }
            else {

                this.raycaster.setFromCamera(this.mousevec, Camera.current);

                this.pointerHasMoved = false

                this.doRaycastUser()
            }
        }

		// side walls collisions

		// let colliders = this.raycaster.intersectObjects( this.containerColliders, true)

		// raycast. mousevec scene, camera.current

		// hide the diffuse layer

		// active the collision layer

		// perform raycast

		// hide the collision layer

		// active the diffuse layer

	}


    /**
     *
     * @param { import('three').Intersection } intersection
     */
    checkIntersection(intersection) {

        if(!Camera.currentControls?.world) return true

        const result = Camera.currentControls.world.rayIntersect(this.raycaster.ray)

        if(result) {

            const diff = intersection.point.distanceTo(result.position)

            if(diff > 0.5) {

                return false
            }
        }

        return true;

    }

    doRaycastCamera() {

        // Filter out null/disposed entries — a stale null left in a container
        // array makes three's intersectObject throw "Cannot read properties of
        // null (reading 'layers')".
        let raycastMeshes = this.containerArtworks
            .concat(this.containerLabel)
            .concat(this.containerPortals)
            .filter(Boolean)

        // this.arrowHelper.setDirection(this.raycaster.ray.direction );
        // this.arrowHelper.position.copy(this.raycaster.ray.origin);
        // this.arrowHelper.setLength(5)

		let items = this.raycaster.intersectObjects(raycastMeshes , true )

        raycastMeshes = null

        let prevItem = this.lookedAtItem

        let intersect = null

        this.lookedAtItem = null

		if(  items.length > 0 ) {

            // if(items.length > 1) console.log("items", items)

            intersect = items[0]

            /** @type { SpaceComponent } */
            const spaceItem = intersect.object.userData.spaceItem

            let distance = spaceItem.maxLookatDistance() * 1.5

            if (!IS_FIRST_PERSON) {
                distance += Camera.current.position.distanceTo(Players.main.position);
            }

            if(spaceItem && spaceItem.raycastCallBack && intersect.distance <= distance) {

                this.lookedAtItem = spaceItem
            }

		}

        if(this.lookedAtItem != prevItem) {

            if(prevItem != null ){
                prevItem.raycastCallBack({
                    active: false,
                    type: this.TYPES.CAMERA_RAYCAST,
                    intersect: null
                })
            }

            if(this.lookedAtItem != null) {

                this.lookedAtItem.raycastCallBack({
                    active: true,
                    type: this.TYPES.CAMERA_RAYCAST,
                    intersect
                })
            }
        }
    }


    doRaycastUser() {

        let raycastMeshes =
            this.containerPlaceholders
                .concat(this.containerArtworks)
                .concat(this.containerPortals)
                .concat(this.containerLabel)
                // .concat(EEDIT_MODE ? [] : this.containerFloors)
                .concat(this.containerFutureItems)
                .concat(this.containerComponents)

        // let raycastMeshes = this.containerFutureItems

		let items = this.raycaster.intersectObjects(raycastMeshes , true )

        raycastMeshes = null

        // console.log("User raycasted", items[0]?.point);

		// we've got a space item
		if(  items.length > 0 ) {

            // console.log(this.containerFutureItems)

            const intersect = items[0]

            // console.log(intersect.object)

            /** @type { SpaceComponent } */
            const spaceItem = intersect.object.userData.spaceItem

            // console.log(spaceItem)
            // console.log(intersect.object.userData)

            if(spaceItem && spaceItem.raycastCallBack ) {

                if( this.currentSpaceItem != spaceItem || spaceItem.isLabel ) {

                    if ( this.currentSpaceItem != null ){

                        this.currentSpaceItem.raycastCallBack({

                            active: false,

                            type: this.TYPES.USER_RAYCAST,

                            intersect: null,

                        })
                    }

                    this.currentSpaceItem = spaceItem

                    spaceItem.raycastCallBack({
                        active: true,
                        type: this.TYPES.USER_RAYCAST,
                        intersect: intersect,
                        onClick : this.hasClicked
                    })
                }
                else if(!spaceItem.raycastOptions.notifyOnlyIfChanged) {

                    spaceItem.raycastCallBack({
                        active: true,
                        type: this.TYPES.USER_RAYCAST,
                        intersect,
                        onClick : this.hasClicked
                    })
                }
            }

		} else {
            // no space item anymore

            if(this.currentSpaceItem != null ){

                this.currentSpaceItem.raycastCallBack({
                    active: false,
                    type: this.TYPES.USER_RAYCAST,
                    intersect: null
                })

                this.currentSpaceItem = null
            }
        }

        this.hasClicked = false
    }


    _selectionCamera = new PerspectiveCamera()

    _selectionFrustum = new Frustum()

    _frustumProjMatrix = new Matrix4()

    // _helper = new CameraHelper(this._selectionCamera)

    _bbox = new Box3()


    intersectScreenRect(view, fullView) {

        // if(this._helper.parent == null) {

        //     Scene.add(this._helper)
        // }

        let meshes = this.containerArtworks
                        .concat(this.containerPortals)
                        .concat(this.containerFutureItems)
                        .concat(this.containerComponents)

        this._selectionCamera.copy(Camera.current);
    
        this._selectionCamera.setViewOffset(
            fullView.width, 
            fullView.height, 
            view.left, 
            view.top,
            view.width, 
            view.height
        )
        
        this._selectionCamera.updateProjectionMatrix();

        // this._helper.update();

        this._frustumProjMatrix.multiplyMatrices(
            this._selectionCamera.projectionMatrix,
            this._selectionCamera.matrixWorldInverse
        );
        
        this._selectionFrustum.setFromProjectionMatrix(this._frustumProjMatrix);

        const selectionFrustum = this._selectionFrustum
    
        var intersectedObjects = [];
    
        for (var i = 0; i < meshes.length; i++) {
            //
            const mesh = meshes[i]

            const item = mesh.userData.spaceItem

            if (item != null) {
                //             
                /** @type { BufferGeometry } */
                const geometry = mesh.geometry;

                if (geometry.boundingBox == null) {

                    geometry.computeBoundingBox();
                }

                const box = this._bbox.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
                
                if (testFrustumBox(selectionFrustum, box, mesh)) {

                    intersectedObjects.push(mesh.userData.spaceItem);
                }

            }
        }
        
        return intersectedObjects;
    }




	click(e){

        if(IS_TOUCH){

			this.mouse(e)

			this.pointerHasMoved = true

		}

        this.pointerHasMoved = true

        this.hasClicked = true

	}

    mouseDown(e) {

        // console.log("raycaster, mouse down")
        // Ignore annoyin mouse move in XR emulator
        if(!IS_VR || e.isVR) {

            this.mouse(e)

            this.pointerHasMoved = true
        }
    }

    mouseMove(e) {
        // Ignore annoyin mouse move in XR emulator
        if(!IS_VR || e.isVR) {

            this.mouse(e)

            this.pointerHasMoved = true
        }
    }

	mouse(e){

        if(e.isVR) {

            this.vrcontrollermatrix.copy(e.controller.matrixWorld)
        }
        else {

            this.mousevec.x     =    e.normalized.x

            this.mousevec.y     =   -e.normalized.y
        }

	}

	set active(val){

		if(val != this._active){

			if(val == true){

				this.addEvents()
			}

			else{

				this.removeEvents()

				this.defaultMouse()
			}

			this._active = val
		}
	}

	get active(){

		return this._active
	}

	addEvents(){

		if(this.updateEvent == null){

            // Make sure to call without args
			this.updateEvent = () => this.update(this.TYPES.CAMERA_RAYCAST)

			Emitter.on_prior(Events.PRE_UPDATE, this.updateEvent)
		}

		if(this.clickEvent == null){

			this.clickEvent   = this.click.bind(this)

			Emitter.on_prior(Events.CLICK, this.clickEvent)
		}

        if(this.mouseEvent == null) {

            this.mouseEvent   = this.mouseMove.bind(this)

            Emitter.on_prior(Events.MOUSE_MOVE, this.mouseEvent)
        }

        if(this.mouseDownEvent == null ) {

            this.mouseDownEvent   = this.mouseDown.bind(this)

            Emitter.on_prior(Events.MOUSE_DOWN, this.mouseDownEvent)
        }
	}


	removeEvents(){

		if(this.updateEvent){

			Emitter.off(Events.PRE_UPDATE, this.updateEvent)

			this.updateEvent = null

		}

		if(this.clickEvent){

			Emitter.off(Events.CLICK, this.clickEvent)

			this.clickEvent = null
		}

		if(this.mouseEvent){

			Emitter.off(Events.MOUSE_MOVE, this.mouseEvent)

			this.mouseEvent   = null

		}

		if(this.mouseDownEvent) {

			Emitter.off(Events.MOUSE_DOWN, this.mouseDownEvent)

            this.mouseDownEvent = null

		}

	}

	defaultMouse(){

		this.mousevec.set(-5000, -5000)
	}

}

export default new Raycast()
