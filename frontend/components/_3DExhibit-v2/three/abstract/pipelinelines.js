import {

    Mesh,

    MeshBasicMaterial,

    MeshLambertMaterial

} from 'three'



import emitter from '@3emitter'

import Events from  '@3events'

import {

    DEFAULT_PIPELINE_OPTIONS,

    DEFAULT_STATE

} from './constants'


import { Line2 } from 'three/examples/jsm/lines/webgpu/Line2.js';

import { LineMaterial } from '@3utils/lines/linematerial2.js';

let defaultOcclusionMaterial      = new LineMaterial({color: 0x000000})

let defaultMirrorMaterial         = new LineMaterial({color: 0x00ff00})

let defaultMaterialLight          = new LineMaterial({color: 0x0000ff})


let state = Object.assign( {}, DEFAULT_STATE)


export default class PipeLineLines extends Line2 {

    constructor(geometry, material, rule = {} ) {


        // debugger

        let pipelineOptions    = Object.assign( {}, DEFAULT_PIPELINE_OPTIONS)

            pipelineOptions    = Object.assign( pipelineOptions, rule)

        super( geometry, material )

        this.isPipeLineMesh = true

        this.useLighting = false

        this._material = material

        this.pipeLineSwitch = false

        this.pipelineOptions = pipelineOptions


        // =====+> DIFFUSE MATERIALS

            // DIFFUSE

            const diffuseMaterial = material


            // OCCLUSION

            var occlusionMaterial = this.pipelineOptions.occlusionMaterial || diffuseMaterial.occlusionMaterial

            if( occlusionMaterial ) {

                if( occlusionMaterial != diffuseMaterial ) {

                    occlusionMaterial.defines = Object.assign( {}, diffuseMaterial.defines )

                    occlusionMaterial.defines['OCCLUSION'] = ''
                }
                
            }
            else {

                occlusionMaterial = diffuseMaterial
            }


            // MIRROR 

            var mirrorMaterial   = this.pipelineOptions.mirrorMaterial || diffuseMaterial.mirrorMaterial

            if( mirrorMaterial ) {

                if( mirrorMaterial !=  diffuseMaterial ) {

                    mirrorMaterial.defines = Object.assign( {}, diffuseMaterial.defines )

                    mirrorMaterial.defines['MIRROR'] = ''
                }
            }

            else {

                mirrorMaterial = diffuseMaterial
            }


            // RECAP


            this.diffuseMaterials = {

                material            : diffuseMaterial,

                occlusionMaterial   : occlusionMaterial,

                mirrorMaterial      : mirrorMaterial
            }

        // <+======

        // =====+> LIGHTING MATERIALS

            // LIGHTING

            const lightingMaterial = this.pipelineOptions.lightingMaterial || diffuseMaterial

            // IF DIFFERENT FROM DIFFUSE MATERIAL 

            if( lightingMaterial != diffuseMaterial ) {


                // GOT USE OF LIGHTING CAUSE IT GOT A DIFFERENT MATERIAL AS LIGHTINGMATERIAL

                this.useLighting = true

                var lightingOcclusionMaterial =  this.pipelineOptions.lightingOcclusionMaterial || lightingMaterial.occlusionMaterial


                // LIGHTING OCCLUSION

                if( lightingOcclusionMaterial ) {

                    if( lightingOcclusionMaterial != lightingMaterial ) {

                        lightingOcclusionMaterial.defines = Object.assign( {}, lightingMaterial.defines )

                        lightingOcclusionMaterial.defines['OCCLUSION'] = ''
                    }
                    
                }

                else {

                    lightingOcclusionMaterial = lightingMaterial
                }


                // LIGHTING MIRROR

                var lightingMirrorMaterial =  this.pipelineOptions.lightingMirrorMaterial || lightingMaterial.mirrorMaterial

                if( lightingMirrorMaterial ) {

                    if( lightingMirrorMaterial !=  lightingMaterial ) {

                        lightingMirrorMaterial.defines = Object.assign( {}, lightingMaterial.defines )

                        lightingMirrorMaterial.defines['MIRROR'] = ''
                    }
                }

                else {

                    lightingMirrorMaterial = lightingMaterial
                }


                // RECAP 

                this.lightingMaterials = {

                    material            : lightingMaterial,

                    occlusionMaterial   : lightingOcclusionMaterial,

                    mirrorMaterial      : lightingMirrorMaterial
                }


            }







        //

        this.occlusionEvent = this._onOcclusion.bind(this)

        this.mirrorEvent = this._onMirror.bind(this)

        this.lightingEvent = this._onLighting.bind(this)

        this._addEvents()


        this.material = diffuseMaterial


        this._mirrorPreviousVisibility = null

        this._diffusePreviousVisibility   = null

        this._occlusionPreviousVisibility = null


        this.currentMode = this.diffuseMaterials


    }

    overrideOcclusionMaterial( val ){

        this.diffuseMaterials.occlusionMaterial  = val

        if( this.lightingMaterials ){

            this.lightingMaterials.occlusionMaterial = val

        }

    }

    set material(val){

        this._material = val

        if( this.pipeLineSwitch == false ) {

            if( this.currentMode ) {

                this.currentMode.material          = val

                if( val ) {

                    // this.currentMode.occlusionMaterial = val.occlusionMaterial  ? val.occlusionMaterial  : val 

                    // this.currentMode.mirrorMaterial    = val.mirrorMaterial     ? val.mirrorMaterial     : val 
                }
            }
        }
    }

    get material(){
        
        return this._material
    }

    set diffuseMaterial( val ){

        this.diffuseMaterials.material = val

        this.material = val
    }

    get diffuseMaterial(){

        return this.diffuseMaterials.material
    }

    set mirrorMaterial( val ){

        this.diffuseMaterials.mirrorMaterial = val
    }

    get mirrorMaterial(){

        return  this.diffuseMaterials.mirrorMaterial
    }

    set occlusionMaterial( val ){

      this.diffuseMaterials.occlusionMaterial = val
    }

    get occlusionMaterial(){

        return this.diffuseMaterials.occlusionMaterial
    }
   
    clone(){

        return this
    }

    _onOcclusion( val ){

        this.pipeLineSwitch = val

        
        if(this.geometry.isInstancedBufferGeometry == true && this.geometry._maxInstanceCount == 0 ){

            return
        }

        // if( this.visible == false ){

        //     return
        // }

        if( this.pipelineOptions.visibleOnOcclusion == false ){

            if( val == true ){

                this._occlusionPreviousVisibility = this.visible

                this.visible = false
            }

            else{

                this.visible = this._occlusionPreviousVisibility || this.visible
            }

        }

        // if should not visible on diffuse

        if ( this.pipelineOptions.visibleOnDiffuse == false ){

            // on diffuse pas

            if( val == true ){

                this._diffusePreviousVisibility = this.visible

                this.visible = this._diffusePreviousVisibility == true ? true : this.visible
            }

            else {

                this._diffusePreviousVisibility = this.visible

                this.visible = false
            }
        }

        this.material = val ?
            ((this.currentMode.occlusionMaterial) ? this.currentMode.occlusionMaterial : defaultOcclusionMaterial) : this.currentMode.material
        

        if( val == true && this.pipelineOptions.overrideOcclusionMaterial != null ) {

            this.material  = this.pipelineOptions.overrideOcclusionMaterial

        }

        state.occlusion = val

    }

    _onMirror(val){

        this.pipeLineSwitch = val

        if(this.geometry.isInstancedBufferGeometry == true && this.geometry._maxInstanceCount == 0 ){

            return
        }

        // if( this.visible == false ){

        //     return
        // }

        if( this.pipelineOptions.visibleOnMirror == false ){

            if( val == true ){

                this._mirrorPreviousVisibility = this.visible

                this.visible = false
            }

            else{

                this.visible = this._mirrorPreviousVisibility
            }

        }

        if( this.pipelineOptions.visibleOnMirror == true ){

            if( val == true ){

                this._mirrorPreviousVisibility = this.visible

                this.visible = true
            }

            else{

                this.visible = this._mirrorPreviousVisibility != null ? this._mirrorPreviousVisibility : this.visible

                this._mirrorPreviousVisibility = null
            }
        }

        this.material = val ?
            ( this.currentMode.mirrorMaterial ? this.currentMode.mirrorMaterial : defaultMirrorMaterial ) : this.currentMode.material

        state.mirror = val
    }

    _onLighting( val ){

        this.currentMode = val ? this.lightingMaterials : this.diffuseMaterials

        state.lighting = val

        // console.log( state.mirror )
        // console.log( state.occlusion )

        this._onMirror( state.mirror )

        this._onOcclusion( state.occlusion )

    }

    _addEvents(){

        emitter.on(Events.OCCLUSION, this.occlusionEvent )

        emitter.on(Events.MIRROR, this.mirrorEvent )

        if( this.useLighting ) {

            emitter.on(Events.LIGHTING, this.lightingEvent )

        }

    }

    _removeEvents(){

        if(this.occlusionEvent){

            emitter.off(Events.OCCLUSION, this.occlusionEvent )
        }

        if(this.occlusionEvent){

            emitter.off(Events.MIRROR, this.mirrorEvent )
        }

        if(this.lightingEvent){

            emitter.off(Events.LIGHTING, this.lightingEvent )
        }
    }

    destroy() {

        this._removeEvents()
    }

    dispose(){

        this.destroy()
    }
}
