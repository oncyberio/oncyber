// @ts-check

import { Camera, Color, DoubleSide, LinearFilter, Mesh, PlaneGeometry, RGBAFormat, Scene, Texture, UnsignedByteType } from 'three';
import { MeshBasicNodeMaterial, RenderTarget } from 'three/webgpu';
import { positionGeometry, texture, uv, vec4 } from 'three/tsl';
import renderer from "@3renderer"



var _mesh;
var _scene;
var _camera;

var _hasInitialized = false;

export const config = {
    /** @type { MeshBasicNodeMaterial } */
    copyMaterial: null,
}

/**
 * Full-screen quad material: the plane's positions are already clip space
 * (the old `quad.vert`), `colorNode` is written to the target unconverted.
 *
 * @param { (vUv: any) => any } colorNode builds the colour from the quad uv
 */
export function createQuadMaterial(colorNode) {

    const material = new MeshBasicNodeMaterial()

    material.vertexNode = vec4( positionGeometry, 1.0 )

    material.colorNode = colorNode( uv() )

    material.side = DoubleSide

    material.fog = false

    material.depthTest = false

    material.depthWrite = false

    return material
}

export function init() {

    if(_hasInitialized) return;

    _scene = new Scene()

    _camera = new Camera()

    _camera.position.z = 1

    const copyTexture = texture( new Texture() )

    config.copyMaterial = createQuadMaterial( ( vUv ) => copyTexture.sample( vUv ) )

    // @ts-ignore
    config.copyMaterial.uniforms = { u_texture: copyTexture }

    _mesh = new Mesh( new PlaneGeometry( 2, 2 ), config.copyMaterial )

    _mesh.frustumCulled = false

    _scene.add( _mesh )

    _hasInitialized = true;

}

export function renderIntoTarget(renderTarget, scene, camera, forceClear = false) {

    const prevTarget = renderer.getRenderTarget()

    renderer.setRenderTarget(renderTarget)

    if(forceClear) {

        renderer.clear(true, true, true)
    }

    renderer.render(scene, camera)

    renderer.setRenderTarget(prevTarget)
}

export function copy(inputTexture, renderTarget, forceClear) {

    _mesh.material = config.copyMaterial

    // @ts-ignore
    config.copyMaterial.uniforms.u_texture.value = inputTexture

    renderIntoTarget( renderTarget, _scene, _camera , forceClear );
}

export function render(material, renderTarget, forceClear) {

    _mesh.material = material

    renderIntoTarget( renderTarget, _scene, _camera, forceClear )
}

export function resizeRenderTarget(renderTarget, width, height) {

    width = (width | 0) || 1

    height = (height | 0) || 1

    if((width !== renderTarget.width) || (height !== renderTarget.height))  {

        renderTarget.setSize(width, height)
    }
}

export function createRenderTarget(width, height, format, type, minFilter, magFilter) {

    var renderTarget = new RenderTarget(width || 1, height || 1, {
        // RGB targets are not renderable on WebGPU
        format: format || RGBAFormat,
        type: type || UnsignedByteType,
        minFilter: minFilter || LinearFilter,
        magFilter: magFilter || LinearFilter,
        depthBuffer: false,
        stencilBuffer: false

    });

    renderTarget.texture.generateMipmaps = false;

    return renderTarget;

}


const _color = new Color()

export function getColorState() {
    return {
        autoClearColor : renderer.autoClearColor,
        clearColor : renderer.getClearColor(_color).getHex(),
        clearAlpha : renderer.getClearAlpha()
    };
}

export function setColorState(state) {
    renderer.setClearColor(state.clearColor, state.clearAlpha);
    renderer.autoClearColor = state.autoClearColor;
}
