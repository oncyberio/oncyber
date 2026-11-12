import { MeshStandardNodeMaterial } from 'three/webgpu'

import { gridMaterial } from './grid.js'

export default class LightingDiffuseMaterial extends gridMaterial( MeshStandardNodeMaterial ) {

    constructor( data ){

        super( data )

        this.name ='grid_shader_lighting'

        this.needsEnvMap = false
    }
}
