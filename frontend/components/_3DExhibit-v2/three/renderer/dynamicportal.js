// @ts-check

/**
 * @typedef { object }  SceneData
 * @property { import('@gltypes').SpaceData } space
 * @property {PortalCamera } camera
 * @property { PortalPreviewMesh } previewMesh
 * @property { import('@uitypes/roomParameters').RoomParameters } roomParameters
*/

import Renderer from '@3renderer'

import Camera 	from '@3camera'

import Events from '@3events'

import Emitter from '@3emitter'

import FBOHelper from '@3gl/globals/fbohelper.js'

import Textures from '@3textures'

import {

    Matrix4,

    Object3D,

    PerspectiveCamera,

    Plane,

    Quaternion,

    Scene,

    Vector3,

    Texture,

    AmbientLight,

    AlwaysDepth,

    HalfFloatType,

    Frustum

} from 'three'

import {

    ClippingGroup,

    MeshBasicNodeMaterial,

    RenderTarget

} from 'three/webgpu'

import {

    float as tslFloat,

    mix,

    screenUV,

    smoothstep,

    texture,

    uniform,

    uv

} from 'three/tsl'

import PostProcessing from './postprocessing'

import { PortalCamera } from '@3gl/camera/portal'

import { VIEW, DPI, FBO_DEBUG, USER_HEIGHT, CAPSULE_RADIUS, CURRENT_SPACE } from '@3constants'

import Shared from '@3shared'

import { PortalPreviewMesh } from '@3factory/portal/previewmesh'
import { correctRatio } from '@3factory/portal/material/utils.js'
import renderer from '@3renderer'


const tmpVec3 = new Vector3();
const unitVec3 = new Vector3(1, 1, 1);

const srcPos = new Vector3();
const srcQuat = new Quaternion();
const srcDir = new Vector3()

const camPos = new Vector3();
const camQuat = new Quaternion();

const adjPos = new Vector3();
const adjQuat = new Quaternion();

const srcMat = new Matrix4();
const camMat = new Matrix4();
const userMat = new Matrix4();
const camMatInv = new Matrix4();
const adjustMat = new Matrix4();
const newMat = new Matrix4();

const controlsParams = { deltaTime: 0.0, elapsedTime: 0.0 }

const emptyTexture = new Texture()

/**
 * The preview mesh shows the portal render target at its own screen position
 * (the GLSL `gl_FragCoord.xy / ( resolution * dpi )`). The target holds linear
 * colour, as on WebGL, and the node output converts it (<colorspace_fragment>).
 */
function createPortalMaterial(renderTarget) {

    const map = texture(renderTarget.texture, screenUV)

    const material = new MeshBasicNodeMaterial()

    material.fog = false

    material.colorNode = map

    material.uniforms = {

        resolution: Shared.resolution,

        dpi: Shared.dpi,

        map
    }

    return material
}

/**
 * Same, dissolving in from the preview (the 360 material rendered into
 * `dissolveTarget`) through the transition map.
 */
function createPortalDissolveMaterial(renderTarget, dissolveTarget) {

    const timer = uniform(0)

    const aspectRatio = uniform(1)

    const vUv = correctRatio(uv(), 1.0, aspectRatio).toVarying('vUv')

    const map = texture(renderTarget.texture, screenUV)

    // The GLSL decoded this sample with SRGBToLinear: the 360 preview wrote
    // unconverted (sRGB) values into a linear target. Here the preview already
    // writes linear colour (it decodes before output), so the sample is used as is.
    const dissolve = texture(dissolveTarget.texture, screenUV)

    const transitionMap = texture(emptyTexture, vUv)

    const tex = transitionMap.r.add(dissolve.r.mul(0.1)).oneMinus()

    const transitionValue = smoothstep(tex.sub(0.1), tex.add(0.1), timer)

    const material = new MeshBasicNodeMaterial()

    material.fog = false

    material.colorNode = mix(dissolve, map, transitionValue)

    material.uniforms = {

        resolution: Shared.resolution,

        dpi: Shared.dpi,

        timer,

        dissolve,

        map,

        transitionMap,

        aspectRatio
    }

    return material
}


class DynamicPortal {

	constructor(){

        /** @type { SceneData } */
        this.sceneData = null

        this.mainScene = new Scene()

        this.light = new AmbientLight()

        // this.mainScene.add( this.light )

        /** @type { Scene } */
        this.currentScene = null

        this.frustum             = new Frustum()

        this.projScreenMatrix    = new Matrix4()


        this.initDestMatrix = new Matrix4()

        this.initDestPosition = new Vector3()

        this.initDestDirection = new Vector3()

        this.initDestDistance = 0

        this.active = false

        // No stencil: WebGPU has no global stencil state to clip the whole
        // destination scene with, so the portal region is masked with depth
        // instead (see maskPortal). The target only needs a depth buffer.
        this.renderTarget = new RenderTarget(VIEW.w, VIEW.h)

        // Holds the (linear) 360 preview the portal dissolves from; half float so
        // the dark end does not band now that it stores linear instead of sRGB.
        this.dissolveTarget = new RenderTarget(VIEW.w, VIEW.h, {
            type: HalfFloatType
        })

        if ( FBO_DEBUG ) {

            FBOHelper.attach(  this.dissolveTarget, 'dissolveTarget' )
        }


        this.basicMaterial = new MeshBasicNodeMaterial({ color: 0x0 })

        // Depth-only draws of the preview mesh:
        // - maskMaterial writes the far plane inside the portal frame (the rest of
        //   the target is cleared to the near plane), so the destination scene only
        //   passes the depth test inside the frame, like the old stencil test;
        // - depthMaterial (XR) writes the frame's real depth, like drawPortalDepth.
        this.maskMaterial = new MeshBasicNodeMaterial({

            colorWrite: false,

            depthWrite: true,

            depthTest: true,

            depthFunc: AlwaysDepth,

            fog: false
        })

        this.maskMaterial.depthNode = tslFloat(1)

        this.depthMaterial = new MeshBasicNodeMaterial({

            colorWrite: false,

            depthWrite: true,

            depthTest: true,

            depthFunc: AlwaysDepth,

            fog: false
        })

        // Replaces the renderer's global clipping plane: the destination scene is
        // rendered inside this group, clipped behind the destination camera.
        this.clippingPlane = new Plane(new Vector3(0, 0, 1), 1000000)

        this.clippingGroup = new ClippingGroup()

        this.clippingGroup.clippingPlanes = [ this.clippingPlane ]

        this.clippingGroup.matrixAutoUpdate = false

        this.dynamicPortalDissolveMaterial = createPortalDissolveMaterial(this.renderTarget, this.dissolveTarget)

        this.dynamicPortalMaterial = createPortalMaterial(this.renderTarget)

        this.addEvents()

        window.dportal = this
	}

    addEvents() {

        if(this.resizeEvent == null) {

            this.resizeEvent = this.onResize.bind(this)

            Emitter.on(Events.RESIZE, this.resizeEvent)
        }
    }

    removeEvents() {

        if(this.resizeEvent != null) {

            Emitter.off(Events.RESIZE, this.resizeEvent)

            this.resizeEvent = null
        }

    }

    onResize(w, h) {

        if(Renderer.xr.enabled) return

        this.renderTarget.setSize(
            Math.ceil(w * DPI),
            Math.ceil(h * DPI)
        )

        this.dissolveTarget.setSize(
            Math.ceil(w * DPI),
            Math.ceil(h * DPI)
        )
    }

    /**
     *
     * @param { SceneData } sceneData
     */
	play( sceneData, opts ){

        const isVR = renderer.xr.enabled

        this.sceneData = sceneData

        this.dissolving = false

        if( opts.dissolve && !isVR  ) {

            this.portalPreviewMaterial = this.sceneData.previewMesh.material

            this.dynamicPortalDissolveMaterial.uniforms.timer.value = 0

            this.dynamicPortalDissolveMaterial.uniforms.transitionMap.value = Textures['transition_map'] ?? emptyTexture

            this.dissolving = true

            this.sceneData.previewMesh.geometry.computeBoundingBox()

            const boundingBox = this.sceneData.previewMesh.geometry.boundingBox

            let width        = (boundingBox.max.x - boundingBox.min.x)
            let height       = (boundingBox.max.y - boundingBox.min.y)
            const aspectRatio  = width / height

            this.dynamicPortalDissolveMaterial.uniforms.aspectRatio.value = aspectRatio
        }


        // @ts-ignore
        const { camera, space } = this.sceneData

        // @ts-ignore
        window.$portalCamera = camera

        if(CURRENT_SPACE.space !== space) {

            this.mainScene.add(space.scene)

            this.currentScene = this.mainScene

            // Renderer.shadowMap.autoUpdate

            if(space.scene.lighting ) {

               space.scene.lighting.render( true )
            }
        }
        else {

            this.currentScene = opts.scene
        }



        // this.currentScene.fog = null

        this.currentScene.fog = space.fog

        this.initDestMatrix.copy(camera.matrixWorld)

        camera.getWorldPosition(this.initDestPosition)

        camera.getWorldDirection(this.initDestDirection);

        sceneData.previewMesh.getWorldPosition(srcPos)

        sceneData.previewMesh.getWorldDirection(srcDir)

        srcPos.add(srcDir.setLength(CAPSULE_RADIUS / 2))

        let distToFloor = Camera.currentControls?.distanceToFloor?.(srcPos)

        if(!isFinite(distToFloor) || distToFloor < 0) {

            distToFloor = sceneData.previewMesh.height / 2
        }

        this.adjY = USER_HEIGHT - distToFloor

        this.teleportDistance = opts.teleportDistance

        // this.initDestDistance = this.initDestPosition.length()

        this.scaleFactor = 1;

        this.active = true

	}

	stop(){

        // dispose space

        this.sceneData = null

        this.mainScene.clear()

        this.active = false
	}

	update(deltaTime){

        const portalScene = this.currentScene

        const portalCamera = this.sceneData.camera

        this.projScreenMatrix.multiplyMatrices( portalCamera.projectionMatrix, portalCamera.matrixWorldInverse )

        this.frustum.setFromProjectionMatrix( this.projScreenMatrix )

        portalCamera.frustum = this.frustum

        Emitter.emit(Events.STENCIL, true, portalScene, portalCamera )

        let isVR = Renderer.xr.enabled

        if( this.dissolving ) {

            let oldTarget = Renderer.getRenderTarget()

            Renderer.setRenderTarget(this.dissolveTarget)

            const mesh = this.sceneData.previewMesh

            const oldMaterial = mesh.material

            mesh.material = this.portalPreviewMaterial

            Renderer.clear()

            this.drawPreviewMesh()

            Renderer.setRenderTarget(oldTarget)

            mesh.material = oldMaterial
        }

        this.sceneData.space.mixer?.update(deltaTime)

        let prevRenderTarget

        if(!isVR) {

            prevRenderTarget = Renderer.getRenderTarget()

            Renderer.setRenderTarget(this.renderTarget)

            Renderer.clear()

            this.sceneData.previewMesh.material = this.basicMaterial

            // this.sceneData.previewMesh.overrideOcclusionMaterial( this.basicMaterial )
        }
        else {

            this.sceneData.previewMesh.visible = false
        }

        // Limit drawing to the portal frame (was: stencil = 1 inside the frame,
        // depth cleared, scene drawn with stencilFunc LEQUAL 1)
        this.maskPortal()

        if (isVR) {

            // TODO: figure out why stencil mask isn't working in VR
            // We should fix the XR camera bug and recheck
            this.adjustPortalViewXR(Camera.current)

        } else {

            // Ensure we will only draw inside the portal frame
            this.adjustPortalView(Camera.current)
        }

        this.clippingPlane.setFromNormalAndCoplanarPoint(this.initDestDirection, this.initDestPosition)

        Shared.isDynamicRendering.value = 1

        // Renderer.render( portalScene, portalCamera)

        this.renderClipped(portalScene, () => {

            PostProcessing.render( portalScene, portalCamera, this.sceneData.roomParameters, isVR ? null : this.renderTarget )
        })

        Shared.isDynamicRendering.value = 0

        this.clippingPlane.normal.set(0, 0, 1)

        this.clippingPlane.constant = 1000000


        if(!isVR) {

            renderer.setRenderTarget(prevRenderTarget)

            this.sceneData.previewMesh.material = this.dissolving ? this.dynamicPortalDissolveMaterial : this.dynamicPortalMaterial

            // this.sceneData.previewMesh.overrideOcclusionMaterial( this.basicMaterial )


            this.dynamicPortalDissolveMaterial.uniforms.timer.value += deltaTime * 0.5

            if( this.dynamicPortalDissolveMaterial.uniforms.timer.value > 1 ) {

                this.dissolving = false
            }
        }
        else {

            this.drawPortalDepth()
        }

        Emitter.emit(Events.STENCIL, false)
	}

    // drawDissolving(){


    // }

    /**
     * Depth mask standing in for the stencil: everything is set to the near
     * plane except the preview mesh's footprint, which is set to the far plane.
     * The destination scene (depth test LessEqual) then only lands inside the
     * frame. The background draws everywhere, as it did with the stencil when
     * a colour background force-cleared; only the frame's pixels are ever read.
     */
    maskPortal() {

        const clearDepth = Renderer.getClearDepth()

        Renderer.setClearDepth(0)

        Renderer.clear(false, true, false)

        Renderer.setClearDepth(clearDepth)

        this.drawPreviewMesh(this.maskMaterial)
    }

    /**
     * Renders `scene` with the portal clipping plane applied to everything in
     * it. The scene's children are moved under the clipping group for the call
     * (their parent links and matrices are untouched; the group is identity).
     *
     * @param { Object3D } scene
     * @param { () => void } render
     */
    renderClipped(scene, render) {

        const group = this.clippingGroup

        const children = scene.children

        group.children = children

        scene.children = [ group ]

        try {

            render()
        }
        finally {

            // keep anything added to the scene while rendering
            const added = scene.children.filter((child) => child !== group)

            scene.children = children

            group.children = []

            for (const child of added) children.push(child)
        }
    }

    /**
     * @param { import('three').Material } [material] draws with this material instead
     */
    drawPreviewMesh(material) {

        const mesh = this.sceneData.previewMesh

        const isVisible = mesh.visible

        const meshMaterial = mesh.material

        mesh.visible = true

        if(material) mesh.material = material

        Renderer.render(mesh, Camera.current)

        if(material) mesh.material = meshMaterial

        mesh.visible = isVisible
    }

     drawPortalDepth() {

        // Clear the depth buffer
        Renderer.clear(false, true, false);

        // Renders portal frames into the depth buffer (no colour, depth always written)
        this.drawPreviewMesh(this.depthMaterial);
    }

    /**
     *
     * @param { Object3D } camera
     * @param { number } scaleFactor
     * @param { Matrix4 } mat
     * @returns
     */
    adjMatr(camera, scaleFactor, mat) {
        const mesh = this.sceneData.previewMesh

        mesh.updateMatrixWorld();

        camera.updateMatrixWorld();

        camera.matrixWorld.decompose(camPos, camQuat, tmpVec3);

        mesh.matrixWorld.decompose(srcPos, srcQuat, tmpVec3);

        srcPos.y += this.adjY


        camMat.compose(camPos.multiplyScalar(scaleFactor), camQuat, unitVec3);

        srcMat.compose(srcPos.multiplyScalar(scaleFactor), srcQuat, unitVec3);

        return mat.multiplyMatrices(srcMat.invert(), camMat);
    }

    /**
     *
     * @param { PerspectiveCamera } camera Camera of the main scene
     */
    adjustPortalView(camera) {

        const mesh = this.sceneData.previewMesh

        const portalCamera = this.sceneData.camera

        const distance = mesh.position.distanceTo(
            camera.position
        )

        const scaleFactor = Math.max(distance - this.teleportDistance, 0) / distance

        this.adjMatr(camera, scaleFactor, adjustMat)

        newMat.multiplyMatrices(this.initDestMatrix, adjustMat)

        newMat.decompose(
            portalCamera.position,
            portalCamera.quaternion,
            tmpVec3
        );

        portalCamera.rotation.z = 0
    }

    /**
     *
     * @param { PerspectiveCamera } camera Camera of the main scene
     */
    adjustPortalViewXR(camera) {


        const mesh = this.sceneData.previewMesh

        const portalCamera = this.sceneData.camera

        const distance = mesh.position.distanceToSquared(
            camera.parent.position
        )


        const scaleFactor = Math.max(distance - this.teleportDistance, 0) / distance

        this.adjMatr(camera.parent, scaleFactor, adjustMat);


        newMat.multiplyMatrices(this.initDestMatrix, adjustMat)

        const user = portalCamera.parent;

        newMat.decompose(user.position, user.quaternion, tmpVec3)

    }
}

export default new DynamicPortal()
