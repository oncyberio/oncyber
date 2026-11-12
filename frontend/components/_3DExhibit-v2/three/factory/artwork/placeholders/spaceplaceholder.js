// @ts-check


import { SpaceArtwork } from '@3artwork/abstract'

import Loader from "@3artwork/loader"

import Camera from '@3camera'

import { Vector3 } from 'three'



const SUSPENSE_TIME = 500

export class SpacePlaceholder extends SpaceArtwork {

    /**
     *
     * @param { import("./spaceplaceholderoptions").SpacePlaceholderOptions } opts
     */
    constructor(opts) {

        super(opts)

        this.isPlaceholder = true

        this.placeholderMesh = opts.mesh

        this.previewMesh = null

        this.placeholderId = opts.placeholderId

        this.isDropPlaceholder = false

        this.face = 0

    }

    addEvents() {

        super.addEvents()

        this.onSelect(e => {

            if (e.isSelected) {

                const front = new Vector3(0, 0, 1).applyEuler(this.rotation)

                const dot = new Vector3().subVectors(this.position, Camera.current.position).dot(front);

                this.face = dot > 0 ? 1 : 0

                this.addEmissive()
            }
            else {

                this.face = 0

                this.removeEmissive()
            }
        })
    }

    updateLoadingState = () => {
        //
        if(this.loading) {

            this.setPreviewMesh(this.getLoaderMesh())
        }
        else {
            //
            this.setPreviewMesh()

        }
    }

    setError(val) {

        const isError = !!val

        if(this.isError === isError) return

        this.isError = isError
    }

    setLoading(val) {
        //
        if(val === this.loading) return

        this.loading = val

        if(!val) {
            //
            clearTimeout(this.loaderTimeout)

            this.updateLoadingState()
        }
        else {
            //
            this.loaderTimeout = setTimeout(this.updateLoadingState, SUSPENSE_TIME)
        }


    }



    getLoaderMesh() {
        //
        if(this.loaderMesh == null) {

            this.loaderMesh = Loader.get({
                ...this.opts,
                maxTentatives: 1,
                item: {
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { _x: 0, _y: 0, _z: 0 },
                    // @ts-ignore
                    data: { mime_type: "image/jpg" }
                },
            })

            // hack: should fix loader instead

            const loaderParams = this.loaderMesh.geometry.parameters
            const params = this.placeholderMesh.geometry.parameters

            this.loaderMesh.scale.set(
                params.width / loaderParams.width,
                params.height / loaderParams.height,
                1
            )

        }

        return this.loaderMesh
    }

    setPreviewMesh(preview) {

        if(preview == this.previewMesh) return

        if(preview != null) {

            this.placeholderMesh.visible = false

            this.add(preview)

            this.previewMesh = preview
        }
        else {

            this.placeholderMesh.visible = true

            this.remove(this.previewMesh)

            this.previewMesh = null
        }

    }

    removeEmissive() {

        // @ts-ignore
        if(this.mesh){
            this.mesh.material.uniforms.selected.value = 0
        }
    }

    addEmissive() {

        // @ts-ignore
        if(this.mesh){
            this.mesh.material.uniforms.selected.value = 1
        }
    }

    showSelected(selected) {

        if(this.loading) return

        if(selected) {

            this.addEmissive()
        }
        else {

            this.removeEmissive()
        }
    }
}
