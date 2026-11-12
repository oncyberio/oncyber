import {

	InstancedBufferGeometry,

	InstancedBufferAttribute,

	BufferAttribute,

    Vector3,

    Object3D,

    SphereGeometry,

    Sphere,

    DynamicDrawUsage,

    Mesh,

    MeshBasicMaterial

} from 'three'

import Camera from '@3camera'

import Emitter from '@3emitter'

import Events from '@3events'

let temp1                  = new Vector3()

import {

    AWAY

} from './constants.js'



// import Players from "@3factory/player"

export default class GeometryInstancer extends InstancedBufferGeometry {

    constructor( geometry, opts = {} ) {

        super()

        geometry.computeBoundingSphere()

        this.sphere             = geometry.boundingSphere

        this.sorting            = opts.sorting ? opts.sorting : true

        this.tempCenter         = this.sphere.center

        this.tempRadius         = this.sphere.radius

        this.max                = opts.max

        this.tempSphere         = new Sphere()

        this.INSTANCED = true

        if ( geometry.index ){

        	this.setIndex( new BufferAttribute( geometry.index.array, 1 ) )
        }

        if( geometry.attributes.position ){

        	this.setAttribute( 'position',  new BufferAttribute( geometry.attributes.position.array, 3))
        }

        if( geometry.attributes.normal ){

            this.setAttribute( 'normal',  new BufferAttribute( geometry.attributes.normal.array, 3))
        }

        if( geometry.attributes.uv ){

        	this.setAttribute( 'uv',  new BufferAttribute( geometry.attributes.uv.array, 2))
        }

        let i = 0

        let offsets    = []

        this.items     = {}

        if( opts.color ) {

            this.items.color = {
                name: 'color',
                array: [],
                length: 3
            }
        }


        if( opts.atlas ) {

            this.items.atlas = {
                name: 'atlas',
                array: [],
                length: 4
            }
        }


        if( opts.scale ) {

            this.items.scale = {
                name: 'scale',
                array: [],
                length: 3
            }
        }

        if( opts.speak ) {

            this.items.speak = {
                name: 'speak',
                array: [],
                length: 1
            }
        }

        //  if( opts.pause ) {

        //     this.items.pause = {
        //         name: 'pause',
        //         array: [],
        //         length: 1
        //     }
        // }

        if( opts.rotation ) {

            this.items.rotation = {
                name: 'rotation',
                array: [],
                length: 4
            }
        }

        if( opts.rotationY ) {

            this.items.rotationY = {
                name: 'rotationY',
                array: [],
                length: 1
            }
        }

        if( opts.border ) {

            this.items.border = {
                name: 'border',
                array: [],
                length: 1
            }
        }

         if( opts.opacity ) {

            this.items.opacity = {
                name: 'opacity',
                array: [],
                length: 1
            }
        }


        for (const item in this.items) {

            this.items[item].array = new Array( this.items[item].length * this.max )

        }

        this.setAttribute( 'offset',   new InstancedBufferAttribute(  new Float32Array( new Array( 3 * this.max ) ), 3, false, 1 ) )

        this.attributes.offset.setUsage(DynamicDrawUsage)

        for (const item in this.items) {

            this.setAttribute( item,   new InstancedBufferAttribute( new Float32Array( this.items[item].array ), this.items[item].length, false, 1 ) )

            this.attributes[item].needsUpdate = true

            this.attributes[item].setUsage(DynamicDrawUsage)

        }

        geometry.dispose()

        geometry = null

        this.caches = {

            offset : ''
        }

        for (const item in this.items) {

            this.caches[item] = ''
        }

    }

    sort( wrappers ){

        let i = 0

        let containerCount = 0

        var caches = {

            offset: ''

        }

        for (const item in this.items) {

            caches[item] = ''
        }


        while( i < Math.min( wrappers.length, this.max ) ) {

            const wrapper = wrappers[i]

            temp1.copy( wrapper.position )

            if ( wrapper.visible ) {

                    this.sphere.radius = this.tempRadius * 2

                    this.tempSphere.copy(this.sphere)

                    this.tempSphere.center.add(temp1)

                    let contains = Camera.frustum.intersectsSphere(this.tempSphere)

                    if( contains ) {

                        const c = containerCount

                        this.attributes.offset.array[c * 3]     = wrapper.position.x
                        this.attributes.offset.array[c * 3 + 1] = wrapper.position.y
                        this.attributes.offset.array[c * 3 + 2] = wrapper.position.z

                        caches['offset'] += wrapper.position.x
                        caches['offset'] += wrapper.position.y
                        caches['offset'] += wrapper.position.z

                        this.attributes.atlas.array[ c * 4 ]    = wrapper.atlas.x
                        this.attributes.atlas.array[ c * 4 + 1] = wrapper.atlas.y
                        this.attributes.atlas.array[ c * 4 + 2] = wrapper.atlas.z
                        this.attributes.atlas.array[ c * 4 + 3] = wrapper.atlas.w

                        caches['atlas'] += wrapper.atlas.x
                        caches['atlas'] += wrapper.atlas.y
                        caches['atlas'] += wrapper.atlas.z
                        caches['atlas'] += wrapper.atlas.w


                        // this.attributes.pause.array[c]   = wrapper.paused
                        this.attributes.opacity.array[c] = wrapper.opacity


                        caches['opacity'] += wrapper.opacity

                        containerCount++
                    }
            }

            i++
        }

        if(containerCount > 0){

            if( caches['offset'] != this.caches['offset'] ){

                this.attributes.offset.clearUpdateRanges()

                this.attributes.offset.addUpdateRange( 0, containerCount *  this.attributes.offset.itemSize )

                this.attributes.offset.needsUpdate             = true
            }

            for (const item in this.items) {

                if( caches[item]  != this.caches[item] ){

                    console.log('update', item)

                    this.attributes[item].clearUpdateRanges()

                    this.attributes[item].addUpdateRange( 0, containerCount *  this.attributes[item].itemSize )

                    this.attributes[item].needsUpdate    = true
                }

            }
        }


        this.caches = caches

        this._maxInstanceCount = containerCount

    }

}
