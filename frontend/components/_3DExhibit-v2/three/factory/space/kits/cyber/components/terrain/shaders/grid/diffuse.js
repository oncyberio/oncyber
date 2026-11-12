import { MeshBasicNodeMaterial } from 'three/webgpu'

import { gridMaterial } from './grid.js'

export default class DiffuseMaterial extends gridMaterial( MeshBasicNodeMaterial ) {

    constructor( data ){

        super( data )

        this.name ='grid_shader_diffuse'
    }
}
