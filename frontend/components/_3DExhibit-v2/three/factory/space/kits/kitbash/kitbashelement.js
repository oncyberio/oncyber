// @ts-check

import { Box3, Mesh, MeshBasicMaterial, Object3D } from "three";
import InstancedMeshWrapper from "@3abstract/instancemeshwrapper";
import { CURRENT_SPACE, EDIT_MODE, UPLOADER_MODE } from "@3constants";
import { SpaceItem } from "@3factory/abstract/spaceitem";
import { disposeObject3D, fromXYZ_, toXYZ_ } from "@3utils/three";
import Emitter from "@3emitter";
import Events from "@3events"
import { deepEqual } from "@utils/js";
import { Component3D } from "@3factory/space/kits/abstract";

import {

    DEBUG_COLLISION

} from '@3constants'
// import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils'


const wf = new MeshBasicMaterial({color:0xff0000,wireframe:true, transparent: false, opacity: 0.1, side: 2})


/** @type {{ x: number, y: number, z: number }} */
// const scale =  [0.1 , 0.1 , 0.1]
const scale =  {
    x: 1,
    y: 1,
    z: 1
}

function stripNumSuffix(str) {
    // replace all numbers at the end of the string with empty string
    return str.replace(/[_-]?\d+$/, "")
}

export class KitBashElement extends Component3D {


    static getInfo() {
        return {
            type: "KitBashElement",
            title: "KitBashElement",
            image: "",
        }
    }

    /**
     * @typedef { object } KitBashElementOpts
     * @property { import("./types").KitBashElementType } type
     * @property { import("@uitypes/experience").KitBashData } data
     * @property { Object3D } space
     *
     *
     * @param {KitBashElementOpts} opts
     */
    constructor(opts) {

        super(opts)

        this.opts = opts

        this.isKitBash = true

        this.kitBashType = opts.type

		this.data = this.userData = opts.data

        this.rotation.order = "YXZ"

        const meta = {
            position: {
                type: "xyz",
                value: [this.data, "position"],
                min: { y: 0 },
            },
            rotation: {
                type: "xyz",
                value: [this.data, "rotation"],
                step: 0.1,
            }
        }

        this.setProps(meta)

        this.raycastOptions = {

            notifyOnlyIfChanged: false
        }

        this._title = stripNumSuffix(this.data.type)
    }

    get title() {
        //
        return this._title
    }

    get componentType() {
        //
        return this.data.type
    }

    async init() {

        const type = this.kitBashType

        const { position, rotation } = this.data

		if ( type.accessors == null ){

			type.accessors = []
		}

        /** @type { InstancedMeshWrapper[] } */
		this.instances = []

		type.baseItems.forEach( ( instanceWrapper ) => {

			instanceWrapper.mesh.name = this.data.type

			// console.log( data )

			const instance = instanceWrapper.mesh.add({

				position  : [position.x, position.y, position.z],

                rotation: [rotation._x, rotation._y, rotation._z],

				scale 	  : scale
			})

			this.instances.push( instance )

			type.accessors.push( instance )

            // @ts-ignore
			this.opts.space.add( instanceWrapper.mesh )

		})

        // if it has collisions
        if( type.collision ) {

            let collisionmesh = type.collision.clone()

            collisionmesh.name = this.data.id

            collisionmesh.rotation.order = "YXZ"

            this.setCollisionMesh(collisionmesh)
        }

        // @ts-ignore
        this.selectionMesh = new Mesh(type.raycastGeometry, wf)

        this.add(this.selectionMesh)


        this.update3D(true)
    }

    update3D(init) {

        const { position, rotation } = this.data

        this.rotation.set( rotation._x, rotation._y, rotation._z )

        this.position.set( position.x, position.y, position.z )

        this.scale.set( scale.x, scale.y, scale.z )

        this.instances.forEach(instance => {

            instance.updateCoords(this.position, this.quaternion, this.scale)
        })

        

        if ( this.collisionMesh ) {

            this.collisionMesh.position.set(position.x, position.y, position.z)

            // this.collisionMesh.rotation.y = rotation._y

            this.collisionMesh.rotation.set(
                rotation._x,

                rotation._y,

                rotation._z
            )

            this.collisionMesh.scale.set(scale.x, scale.y, scale.z)

            this.collisionMesh.updateMatrixWorld(true)
        }

        if (this.selectionBox) {

            this.selectionBox.position.copy(this.position)

            this.selectionBox.quaternion.copy(this.quaternion)
        }


    }

    getBBox(box) {

        this.instances.forEach(instance => {

            const ibox = instance.getBBox()

            box.union(ibox)
        })

        return box

    }

    toolbarActions = [
        {
            icon: "rotate-left-90",
            onAction: () => {
                //
                const prevRot = { ...this.data.rotation }

                let rotation = {
                    ...prevRot,
                    _y: (prevRot._y + Math.PI / 2) % (2 * Math.PI),
                }

                this.props.update({ rotation })

                const getEl = this.elLocator()

                return {
                    undo: () => {
                        //
                        getEl().props.update({ rotation: prevRot })
                    },
                    redo: () => {
                        //
                        getEl().props.update({ rotation })
                    },
                    info: "Flip left",
                }
            },
            
        },
        {
            icon: "flip-left",
            disabled: true,
            onAction: () => {
                console.log("rotateHorz")
            },
        },
        {
            icon: "flip-down",
            disabled: true,
            onAction: () => {
                console.log("flipVert")
            }
        },
        {
            icon: "copy",
            onAction: () => {
                //
                // console.log("duplicate")
                Emitter.emit(

                    Events.CUSTOM,

                    {
                        type: Events.KITBASH_DUPLICATE,

                        value: this
                    }
                )
            },
        },
    ]

    getGUI() {
        //
        return {
            type: "group",
            label: "Transform",
            style: { gap: 4 },
            children: {
                quickedit: {
                    type: "toolbar",
                    label: "Quick Edit Controls",
                    actions: this.toolbarActions,
                },
                ...this.props.meta,
            }
        }
    }

    raycastCallBack ( e ) {

        if ( e.onClick == true ) {

            this.emit("select", e)
        }
	}

    showSelected(val) {
        //
        super.showSelected(val)

        if (this.selectionBox) {

            if (!this.selectionBox.userData._reparented) {

                this.opts.space.add(this.selectionBox)

                this.selectionBox.position.copy(this.position)

                this.selectionBox.quaternion.copy(this.quaternion)

                this.selectionBox.userData._reparented = true
            }
        }
    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.kitBashType.accessors = this.kitBashType.accessors.filter(it => {
            //
            return this.instances.includes(it)
        })

        this.instances.forEach(instance => {

            instance.mesh.remove( instance )

            // console.log( instance )

            // instance.remove()
        })

        this.selectionMesh.geometry.dispose()

        this.collisionMesh?.geometry.dispose()

        if (this.selectionBox) {

            this.opts.space.remove(this.selectionBox)

            disposeObject3D(this.selectionBox)
        }
    }

}
