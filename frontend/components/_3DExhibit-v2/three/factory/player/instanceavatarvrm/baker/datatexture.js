import {

    RGBAFormat,

    FloatType,

    NearestFilter,

    Mesh,

    PlaneGeometry,

    OrthographicCamera,

    MeshBasicMaterial,

    RenderTarget,

    Scene

} from 'three/webgpu'

import {

    DEBUG,

    FBO_DEBUG,

    IS_MAC_MOBILE

} from '@3constants'

import Renderer, { rendererReady } from '@3renderer'

import FBOHelper from '@3gl/globals/fbohelper.js'

import Material from './material/index.js'

const debug = false

import Root from '@3gl/root'


// Main thread fallback of the animation atlas ( the worker path composes a DataTexture on the CPU ):
// each baked clip is blitted into a float RenderTarget with an orthographic quad.
// Sampled later with integer loads, which three flips for render targets on WebGPU, so the
// atlas rows match the DataTexture path on both backends.

export default class DataBake extends RenderTarget {

    constructor( w, h ){
 
       
        super( w, h , {

            format: RGBAFormat,
            type: FloatType,
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            stencilBuffer: false,
            depthBuffer: false
        } )


        if( FBO_DEBUG ) {

            FBOHelper.attach(this, 'dataBake' + Math.random())
        }

        this.needsUpdate = true

        this.mesh = new Mesh( new PlaneGeometry(1,1), new Material())

        this.mesh.geometry.translate(0.5, 0.5, 0)

        this.mesh.frustumCulled = false

        this.camera = new OrthographicCamera(1, 1, 1, 1, 0.01, 500)

        // this.camera.position.z = -

        this.camera.left       = w / - 2
        this.camera.right      = w /   2
        this.camera.top        = h /   2
        this.camera.bottom     = h / - 2

        this.scene = new Scene()

        this.scene.add(this.mesh)

        this.mesh.position.z = -20

        this.camera.updateProjectionMatrix()

        this.camera.lookAt(this.mesh.position)

        if( debug ) {

            this.m = new Mesh( new PlaneGeometry(1,2), new MeshBasicMaterial({side: 2, map: this.texture}))

            this.m.scale.set( 5, 5, 5 )
            this.m.position.set( 0, 5, -5)
            Root.add( this.m )
        }
    }


    update(src, x, y) {

        if(x + src.image.width > this.width || y + src.image.height > this.height){
            console.log(src)
            console.log('bad dimensions')

            return
        }

        if( Renderer.hasInitialized() == false ) {

            rendererReady.then( () => this.blit( src, x, y ) )

            return
        }

        this.blit( src, x, y )
    }

    blit(src, x, y) {

        const oldTarget = Renderer.getRenderTarget()

        const oldAutoClear = Renderer.autoClear

        const oldAutoClearColor = Renderer.autoClearColor

        Renderer.setRenderTarget( this )

        // never clear: blits accumulate ( a fresh target starts zeroed )

        Renderer.autoClear = false

        Renderer.autoClearColor = false

        this.mesh.position.set(- this.width * 0.5 + x , -this.height * 0.5 + y  )

        this.mesh.material.uniforms.map.value = src

        this.mesh.material.uniforms.map.value.needsUpdate = true

        // this.mesh.scale.set(this.width,this.height, 1)
        this.mesh.scale.set(src.image.width, src.image.height, 1)

        this.mesh.updateMatrixWorld()

        Renderer.render( this.scene, this.camera)

        Renderer.setRenderTarget( oldTarget )

        Renderer.autoClear = oldAutoClear

        Renderer.autoClearColor = oldAutoClearColor

    }
}
