

// @ts-check

import { PlaneGeometry, MeshBasicMaterial, NoBlending, Mesh, Scene, Color } from "three"
import { MeshBasicNodeMaterial } from "three/webgpu"
import { float as tslFloat } from "three/tsl"

import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js"

import { CSS_FACTOR } from "@3constants"

import { disposeObject3D } from "@3utils/three"

import  CSS3DRenderer from '@3gl/renderer/css3D/renderer'
import { ArtworkMesh } from "../../LODmesh/artworkmesh"


const padding = 10

export class CSSWrapper {

    /**
     *
     * @param { HTMLElement } element
     * @param { number } width
     * @param { number } height
     * @param { object } materialParams
     */
    constructor(
        element,
        width,
        height,
        materialParams = {}
    ) {

        this.width = width

        this.height = height

        const geometry  = this.geometry = new PlaneGeometry(width, height)

        this.element = element

        // adding 10px here because the element looks jagged when 3d css transform is applied
        // TODO: look on how to force antialias on 3d elements
        element.style.width = `${width * CSS_FACTOR + padding}px`

        element.style.height = `${height * CSS_FACTOR + padding}px`

        // Punches a transparent hole in the canvas so the CSS3D element behind
        // it shows through. Node materials discard alpha <= 0 unless told
        // otherwise; this one must write its (0, 0, 0, 0).
        const material = new MeshBasicNodeMaterial({
            // wireframe: true,
            opacity: 0,
            color: new Color("black"),
            ...materialParams,
            blending: NoBlending,
            fog: false
            // transparent : true
        });

        material.alphaTestNode = tslFloat(-1)

        // @ts-ignore
        this.glPlane = new ArtworkMesh({ geometry, material });

        // this.glPlane.visible = false

        // this.glPlane.renderOrder = -1

        // this.glPlane.visible = false

        this.glCache = new Mesh( geometry, new MeshBasicMaterial({

            color: new Color("black"),
            fog: true,
            blending: NoBlending,
            // transparent : true

        }))

        this.glCache.visible = false

        /** @type { CSS3DObject } */
        this.cssObject = new CSS3DObject(element)

        element.style.pointerEvents = ""
        element.classList.add("css3d")

        this.cssObject.glCache = this.glCache
        this.cssObject.glPlane = this.glPlane

        const updateMatrixWorld = this.cssObject.updateMatrixWorld

        this.cssObject.updateMatrixWorld = (force) => {


            this.glPlane.getWorldPosition(this.cssObject.position)

            this.cssObject.position.multiplyScalar(CSS_FACTOR)

            this.glPlane.getWorldQuaternion(this.cssObject.quaternion)

            this.glPlane.getWorldScale(this.cssObject.scale)

            this.glCache.position.copy(this.glPlane.position)
            this.glCache.scale.copy(this.glPlane.scale)
            this.glCache.quaternion.copy(this.glPlane.quaternion)

            updateMatrixWorld.call(this.cssObject, force);
        }
    }

    rescale(width, height) {
        //

        this.geometry.scale(
            width / this.width,
            height / this.height,
            1
        )

        this.geometry.parameters.width = width

        this.geometry.parameters.height = height

        this.element.style.width = `${width * CSS_FACTOR + padding}px`

        this.element.style.height = `${height * CSS_FACTOR + padding}px`


        this.width = width
        this.height = height
    }

    add() {

        CSS3DRenderer.scene.add(this.cssObject)
    }

    remove() {

        CSS3DRenderer.scene.remove(this.cssObject)
    }

    dispose() {

        this.remove()

        disposeObject3D(this.glPlane)

        disposeObject3D(this.glCache)
    }
}
