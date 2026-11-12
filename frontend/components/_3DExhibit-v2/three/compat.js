import { AudioListener, FramebufferTexture, InstancedBufferGeometry, Object3D, PositionalAudio, Quaternion, Texture, Vector2, Vector3 } from "three"

import { ViewportTextureNode, NodeUpdateType, AnalyticLightNode, HemisphereLightNode } from "three/webgpu"

/**
 * WebGL drew min(instanceCount, _maxInstanceCount) instances, where
 * `_maxInstanceCount` was either written by the engine or derived by the
 * renderer from the instanced attributes' sizes. WebGPU only reads
 * `instanceCount`, so reproduce that rule here: an unset (Infinity) count
 * falls back to what the instanced attributes can feed.
 */
function attributeLimit( geometry ) {

    let limit = Infinity

    for ( const name in geometry.attributes ) {

        const attribute = geometry.attributes[ name ]

        const source = attribute.isInterleavedBufferAttribute ? attribute.data : attribute

        if ( source.isInstancedBufferAttribute || source.isInstancedInterleavedBuffer ) {

            limit = Math.min( limit, attribute.count * ( source.meshPerAttribute ?? 1 ) )
        }
    }

    // No instanced attributes: a plain draw.
    return limit === Infinity ? 1 : limit
}

Object.defineProperties( InstancedBufferGeometry.prototype, {

    instanceCount: {

        configurable: true,

        get() {

            const count = Math.min( this._instanceCount ?? Infinity, this.__maxInstanceCount ?? Infinity )

            return count === Infinity ? attributeLimit( this ) : count
        },

        set( value ) {

            this._instanceCount = value
        },
    },

    _maxInstanceCount: {

        configurable: true,

        get() {

            return this.__maxInstanceCount
        },

        set( value ) {

            this.__maxInstanceCount = value
        },
    },
} )

/**
 * Transmission (and other viewport-sampling nodes) copy the framebuffer into a
 * texture. Our reflectors render a nested pass into a different-sized target
 * inside the main pass, and three resized one shared copy texture back and
 * forth, destroying a texture the outer pass still had bound. That voids the
 * whole frame ("Destroyed texture used in a submit"). Keep one copy texture per
 * (target, size) instead, so nothing is ever resized in place.
 */
const _size = new Vector2()

function viewportCopyFor( node, renderer ) {

    const owner = node.referenceNode ?? node

    const target = renderer.getRenderTarget()

    if ( target === null ) renderer.getDrawingBufferSize( _size )

    else _size.set( target.width, target.height )

    const key = `${ target ? target.id : "screen" }:${ _size.x }x${ _size.y }`

    const copies = owner.__copies ??= new Map()

    let texture = copies.get( key )

    if ( texture === undefined ) {

        // Not clone(): clones share one image, and each copy needs its own size.
        texture = new FramebufferTexture( _size.x, _size.y )

        texture.minFilter = owner.defaultFramebuffer.minFilter

        texture.magFilter = owner.defaultFramebuffer.magFilter

        copies.set( key, texture )

        // Canvas resizes leave old sizes behind; drop the oldest.
        if ( copies.size > 8 ) {

            const [ oldestKey, oldest ] = copies.entries().next().value

            copies.delete( oldestKey )

            oldest.dispose()
        }
    }

    return texture
}

ViewportTextureNode.prototype.updateReference = function ( frame ) {

    this.value = viewportCopyFor( this, frame.renderer )

    return this.value
}

ViewportTextureNode.prototype.updateBefore = function ( frame ) {

    const texture = viewportCopyFor( this, frame.renderer )

    const generateMipmaps = texture.generateMipmaps

    texture.generateMipmaps = this.generateMipmaps

    frame.renderer.copyFramebufferToTexture( texture )

    texture.generateMipmaps = generateMipmaps
}

ViewportTextureNode.prototype.getUpdateBeforeType = function () {

    return NodeUpdateType.RENDER
}

/**
 * The engine decodes images to ImageBitmaps that are already flipped
 * (`imageOrientation: "flipY"`), because WebGL ignored `texture.flipY` for
 * bitmaps. r180 honours it on both backends, which flipped every artwork and
 * font atlas a second time. Keep the WebGL rule: bitmaps are never re-flipped.
 */
Object.defineProperty( Texture.prototype, "flipY", {

    configurable: true,

    get() {

        if ( typeof ImageBitmap !== "undefined" && this.image instanceof ImageBitmap ) return false

        return this._flipY
    },

    set( value ) {

        this._flipY = value
    },
} )

/**
 * Spatial audio: three pushes Web Audio automation (linearRampToValueAtTime)
 * for every PositionalAudio and the listener on *every* matrix update. The
 * oncyber fork only updated moved objects, so this never showed; on vanilla
 * three it took most of the frame in spaces with many video/audio artworks.
 * Only send automation when the world transform actually changed.
 */
const _position = new Vector3()
const _quaternion = new Quaternion()
const _scale = new Vector3()
const _forward = new Vector3()
const _up = new Vector3()

function transformChanged( object ) {

    const elements = object.matrixWorld.elements

    const last = object.__audioMatrix ??= new Float64Array( 16 ).fill( NaN )

    let changed = false

    for ( let i = 0; i < 16; i ++ ) {

        if ( last[ i ] !== elements[ i ] ) { changed = true; last[ i ] = elements[ i ] }
    }

    return changed
}

PositionalAudio.prototype.updateMatrixWorld = function ( force ) {

    Object3D.prototype.updateMatrixWorld.call( this, force )

    if ( this.hasPlaybackControl === true && this.isPlaying === false ) return

    if ( ! transformChanged( this ) ) return

    this.matrixWorld.decompose( _position, _quaternion, _scale )

    _forward.set( 0, 0, 1 ).applyQuaternion( _quaternion )

    const panner = this.panner

    if ( panner.positionX ) {

        const endTime = this.context.currentTime + this.listener.timeDelta

        panner.positionX.linearRampToValueAtTime( _position.x, endTime )
        panner.positionY.linearRampToValueAtTime( _position.y, endTime )
        panner.positionZ.linearRampToValueAtTime( _position.z, endTime )
        panner.orientationX.linearRampToValueAtTime( _forward.x, endTime )
        panner.orientationY.linearRampToValueAtTime( _forward.y, endTime )
        panner.orientationZ.linearRampToValueAtTime( _forward.z, endTime )
    }
    else {

        panner.setPosition( _position.x, _position.y, _position.z )
        panner.setOrientation( _forward.x, _forward.y, _forward.z )
    }
}

AudioListener.prototype.updateMatrixWorld = function ( force ) {

    Object3D.prototype.updateMatrixWorld.call( this, force )

    this._timer.update()

    this.timeDelta = this._timer.getDelta()

    if ( ! transformChanged( this ) ) return

    const listener = this.context.listener

    this.matrixWorld.decompose( _position, _quaternion, _scale )

    _forward.set( 0, 0, - 1 ).applyQuaternion( _quaternion )

    _up.set( 0, 1, 0 ).applyQuaternion( _quaternion )

    if ( listener.positionX ) {

        const endTime = this.context.currentTime + this.timeDelta

        listener.positionX.linearRampToValueAtTime( _position.x, endTime )
        listener.positionY.linearRampToValueAtTime( _position.y, endTime )
        listener.positionZ.linearRampToValueAtTime( _position.z, endTime )
        listener.forwardX.linearRampToValueAtTime( _forward.x, endTime )
        listener.forwardY.linearRampToValueAtTime( _forward.y, endTime )
        listener.forwardZ.linearRampToValueAtTime( _forward.z, endTime )
        listener.upX.linearRampToValueAtTime( _up.x, endTime )
        listener.upY.linearRampToValueAtTime( _up.y, endTime )
        listener.upZ.linearRampToValueAtTime( _up.z, endTime )
    }
    else {

        listener.setPosition( _position.x, _position.y, _position.z )
        listener.setOrientation( _forward.x, _forward.y, _forward.z, _up.x, _up.y, _up.z )
    }
}

/**
 * Spaces were authored on three r153 with legacy lights, where every light's
 * colour was scaled by PI before the BRDF divided it back out. r180 is
 * physically based, so lit materials (artworks, models) came out at 1/PI.
 * Renderers that set `legacyLights` get the old scale back; the lobby keeps
 * its own `lightScale` and leaves the flag off.
 */
const analyticUpdate = AnalyticLightNode.prototype.update

AnalyticLightNode.prototype.update = function( frame ) {

    analyticUpdate.call( this, frame )

    if ( frame?.renderer?.legacyLights === true ) this.color.multiplyScalar( Math.PI )
}

const hemisphereUpdate = HemisphereLightNode.prototype.update

HemisphereLightNode.prototype.update = function( frame ) {

    hemisphereUpdate.call( this, frame )

    if ( frame?.renderer?.legacyLights === true ) this.groundColorNode.value.multiplyScalar( Math.PI )
}
