import {

    Vector3,

    Mesh

} from 'three'

import {

    PIPE_LINE_STATE

} from '@3constants'


import Emitter from '@3emitter'

import Events from  '@3events'

import Camera from '@3camera'

import { SCENE_RENDER_ORDER } from '../utils/sceneRenderOrder'

import InstancedMeshWrapper from './instancemeshwrapper.js'

import PipelineMesh from './pipelinemesh.js'

export default class InstancedPipelineMesh extends PipelineMesh {

    constructor(geometry, material, opts){

        super(geometry, material, opts)

        this.baseGeometry = geometry

        if( opts.type ) {

            this.instanceType = opts.type
        }

        else {

            // No instance type given; instanceType stays unset.
        }

        // console.trace()

        // 

        this.matrixAutoUpdate = false

        this.matrixWorldAutoUpdate = false

        this.frustumCulled = false

        this.count = -1

        this.instances = []

        this.addEvents()

        // this.onBeforeRender = (renderer, scene, camera, geometry, material, group )=>{

            // if( PIPE_LINE_STATE.OCCLUSION == false && PIPE_LINE_STATE.MIRROR == false ) {

            //     this.refresh( camera )
            // }

            
        // }

    }

    // _stencil(e, scene, camera ){

    //     if( e == true ) {

    //         this.stencilScene = scene

    //         this.stencilCamera = camera

    //         //this.refresh( camera )

    //     }
    // }
    
  
    // refresh( camera ){

    //     if( PIPE_LINE_STATE.STENCIL == false ) {

    //         this.sort()
    //     }

    //     else {

    //         let inTheStencilScene = false

    //         this.stencilScene.traverse((child)=>{

    //             if(child == this){

    //                 inTheStencilScene = true 

    //                 return
    //             }
    //         })

    //         if( inTheStencilScene ) {

    //             this.sort( this.stencilCamera )
    //         }
    //     }
        
    // }

    sort( camera ){

       

        if ( this.instances.length == 0 ){

            this.geometry._maxInstanceCount = 0

            this.visible = false

            return;
        }

        // copy data from the copy buffer 
        
        if( this.geometry.copyBuffer ) {

            if( this.geometry.bufferVersion != this.geometry.copyBuffer.bufferVersion ){

                this.geometry.updateCopyBuffers( this.geometry.copyBuffer )
            }

            this.geometry._maxInstanceCount = this.geometry.copyBuffer._maxInstanceCount
            this.geometry._closestDistance  = this.geometry.copyBuffer._closestDistance
        }

        else {

            this.geometry.sort( this.instances, camera )
        }

        if ( this.geometry._maxInstanceCount == 0 ){

            this.visible = false
        }
        else {
            
            this.visible = true

            if(this.geometry.transparencySorting ) {

                this.renderOrder = SCENE_RENDER_ORDER.transparentWorld - this.geometry._closestDistance * 0.1
            }
        }
    }

    add( opts ){

        this.count ++

        const instance = new InstancedMeshWrapper(this, this.geometry, this.count, opts )

        this.instances.push( instance )

        return instance
    }

    remove( instance ){

        const index = this.instances.indexOf(instance)

        if( index == -1 ) {

            return
        }

        this.instances.splice(index, 1)
    }



    _update( scene, camera ) {

        let parent = this

        while ( parent.parent !== null ) {

            parent = parent.parent
        }

        if( parent != null && parent == scene ) {

            this.sort( camera )

        }
    }

    addEvents(){

        if( this.updateEvent == null ){

            this.updateEvent        = this._update.bind( this )

            Emitter.on(Events.PRE_RENDER, this.updateEvent )

            // this.stencilEvent       = this._stencil.bind( this )

            // Emitter.on(Events.STENCIL, this.stencilEvent )

        }
    }

    dispose(){

        this.removeEvents()

        super.dispose()
        
    }

    removeEvents(){

        if( this.updateEvent != null ){

            Emitter.off(Events.PRE_RENDER, this.updateEvent )

            this.updateEvent        = null

            // Emitter.off(Events.STENCIL, this.stencilEvent )

            // this.stencilEvent       = null

        }
    }

    reset(){

        this.dispose()
    }
}