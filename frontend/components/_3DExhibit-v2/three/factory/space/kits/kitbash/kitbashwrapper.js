// @ts-check

import Emitter from '@3emitter'

import Events from '@3events'

import Raycaster from '@3raycaster'

import {
	Group,
	Vector3,
	Scene as THREESCENE,
    Box3
    
} from 'three'

import Scene from '@3scene'

import Camera from '@3camera'

import StyleKit from './stylekit.js'

import { KitBashElement } from './kitbashelement.js'

import { removeItem } from '@utils/js'

import { snap } from '@3utils/three.js'

import {

    DEBUG_COLLISION

} from '@3constants'

import { nanoid } from 'nanoid'




const debug = false

let worldDirection = new Vector3()

let insertPosition = new Vector3()

let bbox = new Box3()

let size = new Vector3()

const defaultElementData = () => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { _x: 0, _y: 0, _z: 0 },
})


export class KitbashWrapper {

    /**
     * @typedef {import('./types.js').KitBashElementType} KitBashElementType
     * @typedef {import('@uitypes/experience.js').KitBashData} KitBashElementData
     *
     */
	constructor( opts ) {

        /** @type {Record<string, KitBashElementType>} */
        this.types = opts.types

        this.kit = opts.kit

		this.data = opts.data

        if( opts.isNewUpload ) {

            const data = this.getDefaultData()

            Object.assign(this.data, data)

            Emitter.emit(
                Events.CUSTOM,
                {
                    type: Events.KITBASH_DEFAULT_DATA,
                    value: this.data
                }
            )
        }

		this.space 	  = new THREESCENE()

		// this.space.fog = new Fog(  0x000000,  0, 49 )

        /** @type { KitBashElement[] } */
		this.elements = []

        this.raycastMeshes = []

        this.collisions = []

        this.elementsGroup = new Group()

        Scene.add(this.elementsGroup)

		// this.collisions = collisions
		this.elementsGroup.visible = debug

        Raycaster.register(

            this.raycastMeshes,

            Raycaster.TYPES.FUTURE_ITEMS

        );
	}

    getElementById(id) {

        return this.elements.find(it => it.data.id === id)
    }

    getElementsByType(type) {

        return this.elements.filter(it => it.data.type === type)
    }

	async build(opts) {

        // console.log("types", this.types)

        // console.log("datas", this.datas)

        await Promise.all(
            Object.values(this.data).map((data) => {
                if (this.types[data.type] != null) {
                    return this.addElement( data )
                }
            })
        )
	}

    getDefaultData() {

        return StyleKit.get(this.types)
    }

    getCurrentData() {

        const data = {}

        this.elements.forEach((element) => {

            data[element.data.id] = structuredClone(element.data)
        })

        return data
    }


    async createElement( data ) {

        const type = this.types[data.type]

        if(type == null) {

            throw new Error ("type does not exists : " + data.type)
        }

        data = {
            ...defaultElementData(),
            kit: this.kit,
            id: data.id ?? `${data.type}-${nanoid()}`,
            ... data
        }

        let kitbashElement = new KitBashElement({
            data,
            type,
            space: this.space,
        })

        await kitbashElement.init()

        return kitbashElement

    }

    /**
     *
     * @param {Promise<KitBashElementData>} data
     */
	async addElement( data ) {

        const kitbashElement = await this.createElement(data)


        if(kitbashElement.collisionMesh != null) {


            this.collisions.push(kitbashElement.collisionMesh)

            if( DEBUG_COLLISION ) {


                kitbashElement.collisionMesh.visible = true

                kitbashElement.collisionMesh.material.side = 2

                Scene.add( kitbashElement.collisionMesh )
            }
        }


        this.elementsGroup.add( kitbashElement )

        this.elements.push(kitbashElement)

        this.raycastMeshes.push(kitbashElement.selectionMesh)

        Emitter.emit(Events.COMPONENT_ADDED, kitbashElement)

        return kitbashElement
	}

    /**
     *
     * @param {KitBashElement} element
     * @returns
     */
    removeElement (element) {

        const index = removeItem(this.elements, element)

        if(index < 0) {

            throw new Error("Can't find element " + element.data.id)
        }

        this.elementsGroup.remove(element)

        Emitter.emit(Events.COMPONENT_REMOVED, element)

        removeItem(this.raycastMeshes, element.selectionMesh)

        element.dispose()

        return element
	}

	reset(){

		const elements = this.elements.slice()

        elements.forEach(el => {

            this.removeElement(el)
        })

        // this.types[ opts.currentType ]

		for (const key in this.types) {

			const currentType = this.types[key]

			currentType.accessors = []

			currentType.baseItems.forEach(item => {

				item.mesh.reset()
			})


		}

		console.log('reset performed')

	}


    /**
     * @typedef {{ kit: string, ctype: string, payload?: any, id: string, duplicate?: boolean }} AddTypeOpts
     *
     *
     * @param {AddTypeOpts} opts
     * @returns {Promise<any>}
     */
    async handleAddType(opts) {

        const { ctype: type, payload, id } = opts

        if(this.types[ type ] == null) {

            throw new Error("Unkown kitbash type " + type)
        }

        let newData = payload;

        let element = id == null ? null : this.elements.find(it => it.data.id === id)

        if(id != null && element == null) {

            throw new Error("Unkown kitbash element " + id)
        }

        if(newData == null) {

            if(element == null) {


                newData = {

                    id: `${type}-${nanoid()}`,

                    type,

                    position : { x: 0, y: 0, z: 0 },

                    rotation : { _x: 0, _y: 0, _z: 0 },

                }
            }
            else {

                let position = { ... element.data.position }

                let rotation = { ... element.data.rotation }

                newData = {

                    id: opts.duplicate ? `${type}-${nanoid()}` : element.data.id,

                    type,

                    position,

                    rotation
                }
            }
        }

        if(element != null && !opts.duplicate) {

            this.removeElement(element)
        }

        newData.kit = opts.kit || this.kit

        const newElement =  await this.addElement(newData)

        if(opts.duplicate) {

            snap(element, newElement, { horz: "left", offset: 0.2 })
        }
        else if(payload == null) {

            bbox.setFromObject(newElement)

            bbox.getSize(size)

            // places the element far enough from the camera



            const far = Math.max(10, Math.max(size.x, size.y, size.z))

            Camera.current.getWorldPosition(insertPosition)

            Camera.current.getWorldDirection(worldDirection)

            worldDirection.multiplyScalar(far)

            insertPosition.add(worldDirection)

            newElement.position.set(insertPosition.x, insertPosition.y, insertPosition.z)
        }

        newElement.updateCoords({ isProgress: true })


        this.data[ newElement.data.id ] = newElement.data

        return newElement
    }


     /**
     * @typedef {{ id: string }} RemoveElementOpts
     *
     *
     * @param {RemoveElementOpts} opts
     */
    handleRemoveElement({ id }) {

        let res;

        let el = this.elements.find(it => it.data.id === id)

        if(el == null) {

            throw new Error("Can't find element " + id)
        }

        res = this.removeElement(el)

        delete this.data[ id ]

        return res

    }


    /**
     * @typedef {{ id: string, payload: any }} UpdateElementOpts
     *
     *
     * @param {UpdateElementOpts} opts
     */
    handleUpdateElement({ id, payload }) {

        let el = this.elements.find(it => it.data.id === id)

        if(el == null) {

            throw new Error("Can't find element " + id)
        }

        el.onData(payload)

        this.data[ id ] = el.data

        return el.data
    }



    handleReset(data) {

        this.reset()

        this.elements = []

        this.data = data

        this.build()
    }

    dispose() {

        this.reset()

    }
}
