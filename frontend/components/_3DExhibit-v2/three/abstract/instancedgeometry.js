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

let temp1 = new Vector3()

const AWAY = 1000

const MAX_INSTANCE = 600

import Scene from '@3scene'

import Renderer from '@3renderer'

// var debugFrame = 0

const START_LEVEL = 1

const MULTIPLE = 25


// const levels = [2, 10, 50, 200, 300]


export default class GeometryInstancer extends InstancedBufferGeometry {

    constructor(geometry, opts = {}) {

        super()

        if (opts.boundingSphere == null) {

            geometry.computeBoundingSphere()

        }

        if( opts.name ){

            this.name = opts.name
        }

        this.sphere = opts.boundingSphere ? opts.boundingSphere : geometry.boundingSphere

        this.transparencySorting = opts.transparencySorting == true

        this.tempCenter = this.sphere.center

        this.tempRadius = this.sphere.radius

        this.useNormal = opts.useNormal ? opts.useNormal : false

        this.max = opts.max?? START_LEVEL

        this.tempSphere = new Sphere()

        this.INSTANCED = true

        this.copyBuffer = opts.copyBuffer != null ? opts.copyBuffer : null

        if (geometry.index) {

            this.setIndex(new BufferAttribute(geometry.index.array, 1))
        }

        if (geometry.attributes.position) {

            this.setAttribute('position', new BufferAttribute(geometry.attributes.position.array, 3))
        }

        if (geometry.attributes.normal && this.useNormal) {

            this.setAttribute('normal', new BufferAttribute(geometry.attributes.normal.array, 3))
        }

        if (geometry.attributes.uv) {

            this.setAttribute('uv', new BufferAttribute(geometry.attributes.uv.array, 2))
        }

        this.items = {}

        if (opts.color) {

         
            this.items.color = {
                name: 'color',
                array: [],
                length: 3
                // type: Int16Array
            }
        }

        if (opts.scale) {

            this.items.scale = {
                name: 'scale',
                array: [],
                length: 3
            }
        }

        if (opts.rotation) {

            this.items.rotation = {
                name: 'rotation',
                array: [],
                length: 4
            }
        }

        if (opts.rotationY) {

            this.items.rotationY = {
                name: 'rotationY',
                array: [],
                length: 1
            }
        }

        if (opts.border) {

            this.items.border = {
                name: 'border',
                array: [],
                length: 1
                // Float, like the other attributes: the WebGL backend wrote an
                // Int16 attribute as "nt border" and the shader failed to
                // compile, so instanced frames vanished on WebGL (and VR).
            }
        }

        if (this.copyBuffer != null) {

            this.attributes.offset = this.copyBuffer.attributes.offset

            for (const item in this.items) {

                this.attributes[item] = this.copyBuffer.attributes[item]
            }
        } else {

            this.setAttribute('offset', new InstancedBufferAttribute(new Float32Array(new Array(3 * this.max)), 3, false, 1))

            this.attributes.offset.setUsage(DynamicDrawUsage)

            for (const item in this.items) {

                var type = this.items[item].type

                if (type == null) {

                    type = Float32Array
                }

                this.setAttribute(item, new InstancedBufferAttribute(new type(new Array(this.items[item].length * this.max)), this.items[item].length, false, 1))

                this.attributes[item].setUsage(DynamicDrawUsage)
            }
        }

        this.opts = opts

        this._closestDistance = AWAY

        this.cacheKey = ""

        geometry.dispose()

        geometry = null

    }

    sort(wrappers, camera = null ) {

        let currentCackeKey = ''

        this.grow(wrappers.length)

        let i = 0

        let containerCount = 0

        let closestDistance = AWAY

        this.visibleWrappers = []

        const cam = camera ? camera : Camera.current

        let frustum = Camera.frustum

        if (camera && camera.frustum) {

            frustum = camera.frustum
        }

        let camPosition = Camera.current.position

         // Camera.current.updateProjectionMatrix()

        if (camera) {

            camPosition = camera.position

        }


        while (i < wrappers.length) {

            const wrapper = wrappers[i]

            if (wrapper.visible) {

                let contains

                // Distances and the frustum test read the wrapper's position.
                temp1.copy(wrapper.position)

                if (Renderer.shadowMap.autoUpdate == true) {

                    // The shadow pass sees every instance, so none is culled.
                    contains = true

                } else {

                    const maxScale = Math.max(wrapper.scale.x, wrapper.scale.y, wrapper.scale.z)

                    this.sphere.radius = this.tempRadius * maxScale

                    this.tempSphere.copy(this.sphere)

                    this.tempSphere.center.add(temp1)

                    contains = frustum.intersectsSphere(this.tempSphere)
                }


                if (contains ) {

                    wrapper._distance = temp1.distanceTo(camPosition)

                    closestDistance = Math.min(closestDistance, wrapper._distance)

                    this.visibleWrappers.push(wrapper)


                    if (this.transparencySorting == false) {

                        const c = containerCount

                        this.attributes.offset.array[c * 3]     = wrapper.position.x
                        this.attributes.offset.array[c * 3 + 1] = wrapper.position.y
                        this.attributes.offset.array[c * 3 + 2] = wrapper.position.z

                        this.attributes.scale.array[c * 3]     = wrapper.scale.x
                        this.attributes.scale.array[c * 3 + 1] = wrapper.scale.y
                        this.attributes.scale.array[c * 3 + 2] = wrapper.scale.z

                        if (this.opts.rotationY) {

                            this.attributes.rotationY.array[c] = wrapper.rotationY
                        }

                        if (this.opts.rotation) {

                            this.attributes.rotation.array[c * 4]     = wrapper.rotation[0]
                            this.attributes.rotation.array[c * 4 + 1] = wrapper.rotation[1]
                            this.attributes.rotation.array[c * 4 + 2] = wrapper.rotation[2]
                            this.attributes.rotation.array[c * 4 + 3] = wrapper.rotation[3]
                        }

                        if (this.opts.border) {

                            this.attributes.border.array[c] = wrapper.border
                        }


                        if (this.opts.color) {

                            this.attributes.color.array[c * 3] = wrapper.color.r
                            this.attributes.color.array[c * 3 + 1] = wrapper.color.g
                            this.attributes.color.array[c * 3 + 2] = wrapper.color.b
                        }
                    }

                    containerCount++
                }

            }

            i++
        }

        if (this.transparencySorting && this.visibleWrappers.length > 0) {


            this.visibleWrappers.sort((a, b) => {

                if (a._distance > b._distance) {
                    return -1
                }
                if (a._distance < b._distance) {
                    return 1
                }

                return 0
            })

            var c = 0

            while (c < this.visibleWrappers.length) {

                const wrapper = this.visibleWrappers[c]

                this.attributes.offset.array[c * 3] = wrapper.position.x
                this.attributes.offset.array[c * 3 + 1] = wrapper.position.y
                this.attributes.offset.array[c * 3 + 2] = wrapper.position.z

                this.attributes.scale.array[c * 3] = wrapper.scale.x
                this.attributes.scale.array[c * 3 + 1] = wrapper.scale.y
                this.attributes.scale.array[c * 3 + 2] = wrapper.scale.z

                if (this.opts.rotationY) {

                    this.attributes.rotationY.array[c] = wrapper.rotationY
                }

                if (this.opts.rotation) {

                    this.attributes.rotation.array[c * 4] = wrapper.rotation[0]
                    this.attributes.rotation.array[c * 4 + 1] = wrapper.rotation[1]
                    this.attributes.rotation.array[c * 4 + 2] = wrapper.rotation[2]
                    this.attributes.rotation.array[c * 4 + 3] = wrapper.rotation[3]
                }

                if (this.opts.border) {

                    this.attributes.border.array[c] = wrapper.border
                }


                if (this.opts.color) {

                    this.attributes.color.array[c * 3] = wrapper.color.r
                    this.attributes.color.array[c * 3 + 1] = wrapper.color.g
                    this.attributes.color.array[c * 3 + 2] = wrapper.color.b
                }

                c++
            }

        }

        this._maxInstanceCount = this.visibleWrappers.length

        // The key is the buffers' content in the order it was written (after
        // any transparency sort), so the GPU copy is refreshed only when it
        // differs. It used to be random while shadows auto-update, which
        // re-uploaded every instanced buffer on every frame.
        currentCackeKey = this.contentKey(Renderer.shadowMap.autoUpdate == true)

        if ( this._maxInstanceCount > 0 && currentCackeKey != this.cacheKey ) {

            const offset = this.attributes.offset

            offset.clearUpdateRanges()

            offset.addUpdateRange( 0, this.visibleWrappers.length * offset.itemSize )

            offset.needsUpdate = true

            for (const item in this.items) {

                const attribute = this.attributes[item]

                attribute.clearUpdateRanges()

                attribute.addUpdateRange( 0, this.visibleWrappers.length * attribute.itemSize )

                attribute.needsUpdate = true
            }

            this.cacheKey = currentCackeKey
        }


        this._closestDistance = closestDistance

        // if( window.renderCube ) {

        //     console.log( this._maxInstanceCount )

        // }

    }

    contentKey(unculled) {

        let key = unculled ? 'all' : 'frustum'

        for (const wrapper of this.visibleWrappers) {

            key += '|' + wrapper.position.x + ',' + wrapper.position.y + ',' + wrapper.position.z
            key += ',' + wrapper.scale.x + ',' + wrapper.scale.y + ',' + wrapper.scale.z

            if (this.opts.rotationY) key += ',' + wrapper.rotationY

            if (this.opts.rotation) {

                key += ',' + wrapper.rotation[0] + ',' + wrapper.rotation[1]
                key += ',' + wrapper.rotation[2] + ',' + wrapper.rotation[3]
            }

            if (this.opts.border) key += ',' + wrapper.border

            if (this.opts.color) {

                key += ',' + wrapper.color.r + ',' + wrapper.color.g + ',' + wrapper.color.b
            }
        }

        return key
    }

    closestMultiple(number) {
        // Calculate the remainder when dividing the number by 50
        const remainder = number % MULTIPLE;

        // Calculate the difference between the number and the next multiple of 50
        const difference = MULTIPLE - remainder;

        // Return the closest higher multiple of 50
        return number + difference;
    }

    updateCopyBuffers(){

        if (this.copyBuffer != null && this.bufferVersion != this.copyBuffer.bufferVersion ) {

           this.attributes.offset = this.copyBuffer.attributes.offset

           for (const item in this.items) {

               this.attributes[item] = this.copyBuffer.attributes[item]
           }

           this.bufferVersion = this.copyBuffer.bufferVersion
        }
    }

    grow(count) {


        if( this.copyBuffer != null ) {

        }

        else {

            if (count > this.max) {

                this.max = this.closestMultiple(count)
                // Update InstancedBufferAttributes to have the new max instance count

                for (const attributeName in this.attributes) {

                    var attribute = this.attributes[attributeName];

                    if (attribute instanceof InstancedBufferAttribute) {

                        const newArray = new attribute.array.constructor(this.max * attribute.itemSize);

                        newArray.set(attribute.array);

                        const newAttribute = new InstancedBufferAttribute(newArray, attribute.itemSize, attribute.normalized);

                        newAttribute.setUsage(DynamicDrawUsage)

                        this.attributes[ attributeName ] = newAttribute;

                        attribute = null

                    }
                }

                // console.log('current count : ' , count,  'grow to ', this.max)

                // versionning geomtry for copy buffers to copy the right buffers

                if( this.bufferVersion == null ) {

                    this.bufferVersion = 0
                }

                this.bufferVersion++
            }
        }  
    }
}