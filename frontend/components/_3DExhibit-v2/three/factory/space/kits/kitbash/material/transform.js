import {

    attribute,
    clamp,
    cos,
    float as tslFloat,
    normalLocal,
    positionLocal,
    rangeFogFactor,
    reference,
    renderGroup,
    sin,
    uniform,
    vec3,

} from 'three/tsl'

import Shared from '@3shared'

/**
 * Kit instancing, shared by every kitbash material (was transformPosition.glsl).
 *
 * Each kit element is one instance of an InstancedGeometry carrying
 * `offset` (vec3), `rotation` (quaternion) and `scale` (vec3) attributes.
 */

// Shared.timer / Shared.timer_d2 are plain { value } objects advanced every frame.

export const timer = uniform( 0 ).onRenderUpdate( () => Shared.timer.value )

export const timerD2 = uniform( 0 ).onRenderUpdate( () => Shared.timer_d2.value )

export function applyQuat( q, v ) {

    return v.add( q.xyz.cross( q.xyz.cross( v ).add( v.mul( q.w ) ) ).mul( 2.0 ) )
}

// GLSL mat3( c, 0, -s,  0, 1, 0,  s, 0, c ) * v

export function rotateY( rad, v ) {

    const c = cos( rad )

    const s = sin( rad )

    return vec3( v.x.mul( c ).add( v.z.mul( s ) ), v.y, v.z.mul( c ).sub( v.x.mul( s ) ) )
}

/**
 * getPosition(): local position of the vertex once placed in its instance.
 *
 * @param {{ instance?: boolean, rotateTimer?: any }} opts
 */
export function kitPosition( { instance = true, rotateTimer = null } = {} ) {

    if( !instance ) return positionLocal

    let pos = positionLocal

    if( rotateTimer ) pos = rotateY( rotateTimer, pos )

    return applyQuat( attribute( 'rotation', 'vec4' ), pos.mul( attribute( 'scale', 'vec3' ) ) ).add( attribute( 'offset', 'vec3' ) )
}

/**
 * getNormal(): the instance's normal. Like the GLSL it is scaled, not
 * inverse-scaled, and is renormalised later by the lighting.
 *
 * @param {{ instance?: boolean, rotateTimer?: any }} opts
 */
export function kitNormal( { instance = true, rotateTimer = null } = {} ) {

    if( !instance ) return normalLocal

    let n = normalLocal

    if( rotateTimer ) n = rotateY( rotateTimer, n )

    return applyQuat( attribute( 'rotation', 'vec4' ), n.mul( attribute( 'scale', 'vec3' ) ) )
}

/**
 * The scene fog factor (`fogFactor` in the GLSL), or null when the material
 * renders without fog. The fog colour itself is applied by the global fog node.
 */
export function fogFactor( material, builder ) {

    const fog = builder.scene?.fog

    if( material.fog !== true || !builder.fogNode || !fog || fog.isFogExp2 ) return null

    const near = reference( 'near', 'float', fog ).setGroup( renderGroup )

    const far = reference( 'far', 'float', fog ).setGroup( renderGroup )

    return rangeFogFactor( near, far )
}

// GLSL smoothstep, also defined when edge0 > edge1.

export function smoothstepAny( edge0, edge1, x ) {

    const t = clamp( tslFloat( x ).sub( edge0 ).div( tslFloat( edge1 ).sub( edge0 ) ), 0.0, 1.0 )

    return t.mul( t ).mul( tslFloat( 3.0 ).sub( t.mul( 2.0 ) ) )
}

// GLSL when_gt(x, y) = max(sign(x - y), 0.0)

export function whenGt( x, y ) {

    return tslFloat( x ).sub( y ).sign().max( 0.0 )
}
