// @ts-check

import { Material, PlaneGeometry, MeshBasicMaterial } from "three"

import { disposeObject3D } from "@3utils/three"

import { init } from "@components/_3DExhibit-v2/three/utils/capturer/helpers/fboHelper"

import PipelineMesh from '@3abstract/pipelinemesh'

/**
 * @typedef {object} ArtworkMeshSpecOpts
 * @property {PlaneGeometry} geometry
 * @property {Material} material
 *
 * @typedef { ArtworkMeshSpecOpts & import("@gltypes").ArtworkOptions } ArtworkMeshOpts
 *
 **/


/**
 * @extends { PipelineMesh<PlaneGeometry, Material> }
 */

const occlusionMaterial = new MeshBasicMaterial({color: 0x000000, fog: false})

export class ArtworkMesh extends PipelineMesh {

    /**
     *
     * @param { ArtworkMeshOpts } opts
     */
    constructor(opts) {


        super(opts.geometry, opts.material, {

            occlusionMaterial: occlusionMaterial
        } )

        this.isLODMesh = false

        this.castShadow = true

        this.receiveShadow = true

    }

    async init() {}

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        disposeObject3D(this)

        super.dispose()
    }
}
