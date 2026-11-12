import {

    InstancedBufferGeometry,

    InstancedBufferAttribute,

    InterleavedBuffer,

    InterleavedBufferAttribute,

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

let temp1 = new Vector3()

import {

    MAX_INSTANCES,

    MINIMUM_VRM_BOX,

    MAXIMUM_VRM_BOX,

    MINIMUM_MIX_RATIO

} from '@3constants'

import {

    AWAY

} from './constants.js'

import Mix from '@3utils/math/mix'

const levels = [1, 5, 16, 35, 80, 200, MAX_INSTANCES + 8]

var tempArray = new Float32Array([0])

// const MAX_INSTANCE = 600

export default class GeometryInstancer extends InstancedBufferGeometry {

    constructor(geometry, opts = {}) {

        super()

        this.vrmName = opts.vrmName

        this.sphere = opts.boundingSphere ? opts.boundingSphere : geometry.computeBoundingSphere()

        this.sorting = opts.sorting ? opts.sorting : true

        this.tempCenter = this.sphere.center

        this.tempRadius = this.sphere.radius

        this.max = opts.max || MAX_INSTANCES

        this.tempSphere = new Sphere()

        this.INSTANCED = true

        this.opts = opts

        if (geometry.index) {

            this.setIndex(new BufferAttribute(geometry.index.array, 1))
        }

        // WebGPU pipelines take at most 8 vertex buffers, and an invalid
        // pipeline voids the whole frame. The instanced fields already use 6,
        // so the static float attributes share one interleaved buffer.
        // (skinIndex is integer and keeps its own buffer.)
        const floatAttributes = [ 'position', 'normal', 'uv', 'skinWeight' ]
            .filter( ( name ) => geometry.attributes[ name ] )

        const stride = floatAttributes.reduce( ( sum, name ) => sum + geometry.attributes[ name ].itemSize, 0 )

        if ( stride > 0 ) {

            const count = geometry.attributes[ floatAttributes[ 0 ] ].count

            const data = new Float32Array( count * stride )

            let offset = 0

            for ( const name of floatAttributes ) {

                const source = geometry.attributes[ name ]

                for ( let i = 0; i < count; i ++ ) {

                    for ( let k = 0; k < source.itemSize; k ++ ) {

                        data[ i * stride + offset + k ] = source.getComponent( i, k )
                    }
                }

                offset += source.itemSize
            }

            const interleaved = new InterleavedBuffer( data, stride )

            offset = 0

            for ( const name of floatAttributes ) {

                const itemSize = geometry.attributes[ name ].itemSize

                this.setAttribute( name, new InterleavedBufferAttribute( interleaved, itemSize, offset ) )

                offset += itemSize
            }
        }

        if (geometry.attributes.skinIndex) {

            this.attributes.skinIndex = geometry.attributes.skinIndex
        }


        let offsets = []

        this.items = {}

        // if (opts.color) {

        //     this.items.color = {
        //         name: 'color',
        //         length: 3
        //     }
        // }


        if (opts.atlas) {

            this.items.atlas = {
                name: 'atlas',
                length: 4
            }

            this.textureID = opts.textureID
        }


        if (opts.scale) {

            this.items.scale = {
                name: 'scale',
                length: 1
            }
        }

        if (opts.speak) {

            this.items.speak = {
                name: 'speak',
                length: 1
            }
        }

        //  if( opts.pause ) {

        // 	this.items.pause = {
        // 		name: 'pause',
        // 		array: [],
        // 		length: 1
        // 	}
        // }

        if (opts.rotation) {

            this.items.rotation = {
                name: 'rotation',
                length: 4
            }
        }

        if (opts.rotationY) {

            this.items.rotationY = {
                name: 'rotationY',
                length: 1
            }
        }

        if (opts.opacity) {

            this.items.opacity = {
                name: 'opacity',
                length: 1,
                initialize: 1
            }
        }

        if (opts.animations) {

            this.items.animations = {
                name: 'animations',
                length: 4
                // type: Int16Array
            }
        }


        let i = 0

        this.cacheKeys = {

            offset : ''

        }

        // in case a previous mesh has been created, meshes shares attributes

        if (opts.copyBuffer == null) {

            for (const item in this.items) {

                this.items[item].array = new Array(this.items[item].length * this.max)

            }

            this.setAttribute('offset', new InstancedBufferAttribute(new Float32Array(new Array(3 * this.max)), 3, false, 1))

            // this.attributes.offset.setUsage(DynamicDrawUsage)

            for (const item in this.items) {

                var type = this.items[item].type

                if (type == null) {

                    type = Float32Array
                }

                this.setAttribute(item, new InstancedBufferAttribute(new type(this.items[item].array), this.items[item].length, false, 1))

                this.cacheKeys[item] = ''

                // this.attributes[item].setUsage(DynamicDrawUsage)
            }
        } else {

            this.attributes['offset'] = opts.copyBuffer.attributes['offset']

            for (const item in this.items) {

                this.attributes[item] = opts.copyBuffer.attributes[item]
            }

            this.copyBuffer = opts.copyBuffer
        }

        this._closestDistance = AWAY

        geometry.dispose()

        geometry = null

      


    }



    sort(wrappers) {

        let cacheKeys = {
            offset: false
        }

        for (const item in this.items) {

            cacheKeys[item] = false
        }

        this.grow(wrappers.length)

        let m = 0

        let currentIndex = null

        let containerCount = 0

        while (m < wrappers.length) {

            var wrapper = wrappers[m]

            if (wrapper.vrmName == this.vrmName && wrapper.visible && wrapper.opacity > 0) {

                tempArray[0] =  Mix(MINIMUM_MIX_RATIO, 1, wrapper.scale) * wrapper.baseScaleRatio

                const scale =  tempArray[0]

                temp1.copy(wrapper.position)

                this.sphere.radius = this.tempRadius * 2 * scale

                this.tempSphere.copy(this.sphere)

                this.tempSphere.center.add(temp1)

                let contains = Camera.frustum.intersectsSphere(this.tempSphere)

                if (contains) {

                    const c = containerCount

                    // offset caching
                  
                    tempArray[0]     = wrapper.position.x
                    cacheKeys.offset = cacheKeys.offset ||  tempArray[0]  != this.attributes.offset.array[c * 3]

                    tempArray[0]     = wrapper.position.y
                    cacheKeys.offset = cacheKeys.offset ||  tempArray[0]  != this.attributes.offset.array[c * 3 + 1]

                    tempArray[0]     = wrapper.position.z
                    cacheKeys.offset = cacheKeys.offset ||  tempArray[0]  != this.attributes.offset.array[c * 3 + 2]



                    this.attributes.offset.array[c * 3]     = wrapper.position.x
                    this.attributes.offset.array[c * 3 + 1] = wrapper.position.y
                    this.attributes.offset.array[c * 3 + 2] = wrapper.position.z



                    tempArray[0]         = wrapper.animations[0]
                    cacheKeys.animations = cacheKeys.animations ||   tempArray[0] != this.attributes.animations.array[c * 4]


                    tempArray[0]         = wrapper.animations[1]
                    cacheKeys.animations = cacheKeys.animations ||   tempArray[0] != this.attributes.animations.array[c * 4 + 1]

                    tempArray[0]         = wrapper.animations[2]
                    cacheKeys.animations = cacheKeys.animations ||   tempArray[0] != this.attributes.animations.array[c * 4 + 2]

                    tempArray[0]         = wrapper.animations[3]
                    cacheKeys.animations = cacheKeys.animations ||   tempArray[0] != this.attributes.animations.array[c * 4 + 3]


                    this.attributes.animations.array[c * 4]     = wrapper.animations[0]
                    this.attributes.animations.array[c * 4 + 1] = wrapper.animations[1]
                    this.attributes.animations.array[c * 4 + 2] = wrapper.animations[2]
                    this.attributes.animations.array[c * 4 + 3] = wrapper.animations[3]



                    tempArray[0] = wrapper.rotation
                    cacheKeys.rotationY = cacheKeys.rotationY || tempArray[0] !=  this.attributes.rotationY.array[c]


                    this.attributes.rotationY.array[c] = wrapper.rotation





                    tempArray[0] = scale
                    cacheKeys.scale = cacheKeys.scale || tempArray[0] !=  this.attributes.scale.array[c]


                    this.attributes.scale.array[c] = scale

                   

                    tempArray[0] = wrapper.opacity
                    cacheKeys.opacity = cacheKeys.opacity || tempArray[0] !=  this.attributes.opacity.array[c]


                    this.attributes.opacity.array[c] = wrapper.opacity

                    if (this.opts.atlas) {


                        tempArray[0]         = wrapper.atlas.x
                        cacheKeys.atlas = cacheKeys.atlas ||   tempArray[0] != this.attributes.atlas.array[c * 4]


                        tempArray[0]         = wrapper.atlas.y
                        cacheKeys.atlas = cacheKeys.atlas ||   tempArray[0] != this.attributes.atlas.array[c * 4 + 1]

                        tempArray[0]         = wrapper.atlas.z
                        cacheKeys.atlas = cacheKeys.atlas ||   tempArray[0] != this.attributes.atlas.array[c * 4 + 2]

                        tempArray[0]         = wrapper.atlas.w
                        cacheKeys.atlas = cacheKeys.atlas ||   tempArray[0] != this.attributes.atlas.array[c * 4 + 3]


                        this.attributes.atlas.array[c * 4]     = wrapper.atlas.x
                        this.attributes.atlas.array[c * 4 + 1] = wrapper.atlas.y
                        this.attributes.atlas.array[c * 4 + 2] = wrapper.atlas.z
                        this.attributes.atlas.array[c * 4 + 3] = wrapper.atlas.w
                    }

                    containerCount++


                }
            }

            m++
        }

        this._maxInstanceCount = containerCount

        if (this._maxInstanceCount > 0) {

            if( cacheKeys.offset == true  ) {

                this.attributes.offset.clearUpdateRanges()

                this.attributes.offset.addUpdateRange( 0, containerCount * this.attributes.offset.itemSize )

                this.attributes.offset.needsUpdate = true

            }
          
            for (const item in this.items) {

                if(  cacheKeys[item] == true ) {

                    this.attributes[item].clearUpdateRanges()

                    this.attributes[item].addUpdateRange( 0, containerCount * this.attributes[item].itemSize )

                    this.attributes[item].needsUpdate = true
                }
            }
        }



    }

    updateCopyBuffers() {

        if (this.copyBuffer != null && this.bufferVersion != this.copyBuffer.bufferVersion) {

            this.attributes.offset = this.copyBuffer.attributes.offset

            for (const item in this.items) {

                this.attributes[item] = this.copyBuffer.attributes[item]
            }

            this.bufferVersion = this.copyBuffer.bufferVersion
        }
    }

    grow(newMaxInstanceCount) {

        if (this.copyBuffer != null) {

        } else if (newMaxInstanceCount > this.max) {

            this.max = this.findClosestCeilingLevel(newMaxInstanceCount)

            for (const attributeName in this.attributes) {

                var attribute = this.attributes[attributeName];

                if (attribute instanceof InstancedBufferAttribute) {

                    const newArray = new attribute.array.constructor(this.max * attribute.itemSize);

                    newArray.set(attribute.array);

                    const newAttribute = new InstancedBufferAttribute(newArray, attribute.itemSize, attribute.normalized);

                    // newAttribute.setUsage(DynamicDrawUsage)

                    this.attributes[attributeName] = newAttribute;

                    newAttribute.needsUpdate = true

                    attribute = null

                }
            }

            console.log('grow :  ', newMaxInstanceCount, ' count into : ', this.max)

            // versionning geomtry for copy buffers to copy the right buffers

            if (this.bufferVersion == null) {

                this.bufferVersion = 0
            }


            this.bufferVersion++
        }
    }

    findClosestCeilingLevel(number) {
        let closestCeiling = Infinity;
        let highestLevel = levels[levels.length - 1];

        for (let i = 0; i < levels.length; i++) {
            if (levels[i] >= number && levels[i] < closestCeiling) {
                closestCeiling = levels[i];
            }
        }

        if (number > highestLevel) {
            return highestLevel;
        }

        return closestCeiling;
    }
}
