// @ts-check

import {

    BoxGeometry,
    Color,
    Vector3,

} from "three"

import InstancedGeometry from "@3abstract/instancedgeometry"

import InstancedPipelineMesh from "@3abstract/instancedpipelinemesh.js"

import PipeLineMesh from "@3abstract/pipelinemesh"

import Emitter from "@3emitter"

import Events from "@3events"

import { GalleryLabelBatch } from "./galleryLabelBatch"


import { artworkDepth } from "@3utils/spaceutils"

import GalleryFrameMaterial from "./galleryframematerial"

import {

    galleryFrameLayout,
    galleryLabelText,
    galleryMouldingColor,

} from "./galleryFrame"

const _v = new Vector3()

/**
 * Every gallery frame in a space, drawn as one instanced mesh of boxes
 * (moulding, mat and backing of every framed artwork), so a
 * room of framed art uses one box batch and shared SDF label batches.
 */
export class GalleryFrames {

    constructor() {

        /** @type { any } InstancedPipelineMesh: its `add` takes instances, not children */
        this.mesh = null

        /** @type { Map<any, { wrappers: any[], visible: boolean }> } */
        this.entries = new Map()

        /** @type { GalleryLabelBatch | null } */
        this.labels = null

        this.flushLabels = () => {
            for(const [artwork, entry] of this.entries) {
                if(entry.visible === artwork.visible) continue
                entry.visible = artwork.visible
                for(const wrapper of entry.wrappers) wrapper.visible = entry.visible
                this.labels?.setVisible(artwork, entry.visible)
            }
            this.labels?.flush()
        }

        Emitter.on(Events.PRE_RENDER, this.flushLabels)

        /** @type { import("three").Object3D | null } */
        this.parent = null
    }

    /**
     * @param { import("three").Object3D } parent
     */
    attachTo(parent) {

        this.parent = parent

        if(this.mesh) parent.add(this.mesh)
    }

    getMesh() {

        if(this.mesh == null) {

            this.mesh = new InstancedPipelineMesh(

                new InstancedGeometry(new BoxGeometry(1, 1, 1), {
                    max: 16,
                    color: true,
                    scale: true,
                    rotation: true,
                    useNormal: true,
                    border: true,
                }),

                new GalleryFrameMaterial(),

                {
                    type: "INSTANCED_GALLERY_FRAME",

                    occlusionMaterial: new GalleryFrameMaterial(),
                }
            )

            this.mesh.name = "galleryFrames"

            this.parent?.add(this.mesh)
        }

        return this.mesh
    }

    /**
     * Lays out (or removes) the frame of `artwork` from its current size,
     * transform and `galleryFrame` settings.
     *
     * @param { any } artwork a SpaceArtwork
     */
    set(artwork) {

        const frame = artwork.galleryFrame

        const userData = artwork.mesh?.userData

        const width = userData?.artworkWidth

        const height = userData?.artworkHeight

        if(!frame || !(width > 0) || !(height > 0)) {

            this.remove(artwork)

            return
        }

        const artworkData = artwork.artworkData || {}

        const labelText = frame.label ? galleryLabelText(artworkData, frame.credit) : null

        const layout = galleryFrameLayout({
            width,
            height,
            depth: artworkDepth(artwork.opts?.roomParameters || {}),
            scale: artwork.scale,
            frame,
            withLabel: labelText != null,
            creditLabel: labelText?.credit != null,
        })

        const mesh = this.getMesh()

        let entry = this.entries.get(artwork)

        if(entry == null) {

            entry = { wrappers: [], visible: artwork.visible }

            this.entries.set(artwork, entry)
        }

        const boxes = layout.boxes

        while(entry.wrappers.length > boxes.length) {

            mesh.remove(entry.wrappers.pop())
        }

        while(entry.wrappers.length < boxes.length) {

            entry.wrappers.push(mesh.add({
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                color: new Color(),
                border: 0,
            }))
        }

        const moulding = galleryMouldingColor(artworkData.borderColor)

        const quaternion = artwork.quaternion

        const position = artwork.position

        entry.visible = artwork.visible

        for(let i = 0; i < boxes.length; i++) {

            const box = boxes[i]

            const wrapper = entry.wrappers[i]

            _v.set(box.x, box.y, box.z).applyQuaternion(quaternion).add(position)

            wrapper.updateCoords(_v, quaternion, { x: box.w, y: box.h, z: box.d })

            const color = box.part === "frame" ? moulding :
                box.part === "mat" ? frame.matColor :
                // the backing shows through transparent images
                frame.mat ? frame.matColor : moulding

            wrapper.setColor(color)

            wrapper.setBorder(box.part === "frame" ? 1 : 0)

            wrapper.visible = entry.visible
        }

        if(layout.label && labelText && this.parent) {
            this.labels ??= new GalleryLabelBatch(this.parent, (geometry, material) =>
                new PipeLineMesh(geometry, material, { visibleOnOcclusion: false })
            )

            this.labels.set(artwork, layout.label, labelText, frame.labelRounded)
        }
        else {
            this.labels?.remove(artwork)
        }
    }

    /**
     * @param { any } artwork
     */
    remove(artwork) {

        const entry = this.entries.get(artwork)

        if(entry == null) return

        for(const wrapper of entry.wrappers) this.mesh?.remove(wrapper)

        this.labels?.remove(artwork)

        this.entries.delete(artwork)
    }

    dispose() {

        Emitter.off(Events.PRE_RENDER, this.flushLabels)

        this.labels?.dispose()

        this.labels = null

        for(const artwork of [...this.entries.keys()]) this.remove(artwork)

        if(this.mesh) {

            this.mesh.parent?.remove(this.mesh)

            this.mesh.dispose()

            this.mesh.geometry.dispose()

            this.mesh = null
        }

        this.parent = null
    }
}
