// @ts-check


import { Mesh, PlaneGeometry, MeshBasicMaterial, ArrowHelper, Texture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Color, DoubleSide, Group, BoxGeometry } from "three";

import loader from "@3loader"

import Border from "@3factory/border"

import ArtworkFactory from "@3factory/artwork"

import PortalFactory, { DEF_PORTAL_HEIGHT, DEF_PORTAL_WIDTH } from "@3factory/portal"

// import scene from "../../scene";
import { disposeObject3D, disposeThreeResource } from "@3utils/three";

import { CHECK_ABORT_SIGNAL, IS_ABORT_ERROR } from "@3utils/abort"

import PipeLineMesh from "@3abstract/pipelinemesh";

import { getArtworkData, getPortalSpawnData, occlusionMaterial } from "../utils";

import { CURRENT_SPACE, DRAG_MIMES, USER_HEIGHT } from "@components/_3DExhibit-v2/three/constants";

import PlaceholderFactory, { defaultPlaceholderSize } from '@3artwork/placeholders'

import { delay } from "@utils/js";

import { MODEL_MEDIA, getMediaType } from "@3utils/mediatype";

import { endPerf, startPerf } from "@utils/perf";

import { getMediaDimensions } from "@utils/metadata/reformatAsset";



const DEFAULT_COLOR = new Color(0xcccccc)


const def2DGeo = new PlaneGeometry(1, 1)

def2DGeo.userData.isShared = true

const def2DMat = new MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        side: DoubleSide,
        color: DEFAULT_COLOR,
    })

def2DMat.userData.isShared = true

const def2DPreview = new PipeLineMesh(def2DGeo, def2DMat, {
    occlusionMaterial
})

def2DPreview.name = "def2DPreview"

def2DPreview.userData.isShared = true

const def3DGeo = new BoxGeometry(1, 1, 1, 6, 6, 6)

def3DGeo.userData.isShared = true

const def3DMat = new MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        side: DoubleSide,
        wireframe: true,
    })

def3DMat.userData.isShared = true

const def3DPreview = new PipeLineMesh(def3DGeo, def3DMat, {
    occlusionMaterial
})

def3DPreview.name = "def3DPreview"

def3DPreview.userData.isShared = true

export class EditorDragMesh extends Group {

    constructor(opts) {

        super()

        this.opts = opts

        this.name = "editor-drag-mesh"

        this.size = (this.opts.roomParameters.placeholderSize || defaultPlaceholderSize).map(it => it * 1.5)

        this.preview = null

        this.renderOrder = 10_000

        // this.normalHelper = new ArrowHelper()

        // this.normalHelper.setLength(1)

        // this.normalHelper.setColor(0xff0000)

        // scene.add(this.normalHelper)

        // const umw = this.normalHelper.updateMatrixWorld

        // this.normalHelper.updateMatrixWorld = (force) => {

        //     this.normalHelper.position.copy(this.position)

        //     this.normalHelper.visible = this.visible

        //     umw.call(this.normalHelper, force)
        // }
    }

    onPreviewChange = () => {}

    setPreview(preview) {

        if(this.preview) {

            this.remove(this.preview)
        }

        this.preview = preview

        this.add(this.preview)
        this.onPreviewChange?.()

        // console.log("dragMesh setPreview", this.preview, this.preview.position, this.preview.rotation, this.preview.scale)
    }

    setDefaultPreview(dragData) {

        this.setPreview (
            (dragData.is2D || dragData.isAvatar) ? def2DPreview : def3DPreview
        )

        if (dragData.isAvatar) {
            this.preview.scale.set(USER_HEIGHT * 0.65, USER_HEIGHT, 1)
        }
        else if (dragData.is2D) {

            if (dragData.mime === DRAG_MIMES.PORTAL) {

                this.preview.scale.set(DEF_PORTAL_WIDTH, DEF_PORTAL_WIDTH, 1)
            }
            else {

                this.preview.scale.set(this.size[0], this.size[1], 1)
            }
            
        }
        else {
            
            this.preview.scale.set(1, 1, 1)
        }
    }

    async enter(dragData) {
        this.perfs = {}
        this.abort?.abort()
        const controller = new AbortController()
        this.abort = controller
        const signal = controller.signal
        this._active = true
        this.setDefaultPreview(dragData)
        let assetLoaded = false
        const current = () => this._active && this.abort === controller && !signal.aborted
        const onError = error => {
            if (!IS_ABORT_ERROR(error)) console.warn("Drag preview failed", error)
        }
        if ((dragData.is2D || dragData.isAvatar) && dragData.previewUrl) {
            this.loadPreview(dragData, signal).then(preview => {
                if (!current() || assetLoaded) return this.disposePreview(preview)
                this.setPreview(preview)
            }).catch(onError)
        }
        if (dragData.preloadAsset) {
            this.loadAsset(dragData, signal).then(preview => {
                if (!current()) return this.disposePreview(preview)
                assetLoaded = true
                const previous = this.preview
                this.setPreview(preview)
                this.disposePreview(previous)
            }).catch(onError)
        }
    }

    disposePreview(preview) {
        if (!preview || preview.userData.isShared) return
        if (preview.isArtwork || preview.isPortal) preview.dispose()
        else disposeObject3D(preview)
    }

    /**
     *
     * @param { import("../utils").EditorDragData } dragData
     */
    async onDragStart(dragData) {

        endPerf(this.perfs, "drag-lag")   
        
        this._isDragging = true
    }

    createBorder(width, height, depth) {

        this.destroyBorder()

        this.border = Border.get({
            color: 0x000000,
            height,
            width,
            depth,
            borderSize: 0
        });

        this.add(this.border)
    }

    destroyBorder() {

        if(this.border == null) return

        this.remove(this.border)

        disposeObject3D(this.border)

        this.border = null
    }

    async loadPreview(dragData, signal) {

        let {previewUrl} = dragData

        const image = dragData.previewImg?.crossOrigin === "anonymous" && dragData.previewImg.complete && dragData.previewImg.naturalWidth
            ? dragData.previewImg
            : await loader.loadImage([previewUrl], signal, true, "drag-preview")

        CHECK_ABORT_SIGNAL(signal)

        const texture = new Texture(image)

        texture.colorSpace = SRGBColorSpace
        texture.minFilter = LinearMipmapLinearFilter
        texture.magFilter = LinearFilter
        texture.generateMipmaps = true;
        texture.needsUpdate = true

        let width, height, depth;

        if (dragData.isAvatar) {
            height = USER_HEIGHT
            width = height * ((image.naturalWidth || image.width) / (image.naturalHeight || image.height))
        }
        else if (dragData.mime === DRAG_MIMES.PORTAL) {

            width = DEF_PORTAL_WIDTH

            height = DEF_PORTAL_HEIGHT
        }
        else {
            
            ({ width, height, depth } = getMediaDimensions({
                artworkData: dragData.asset,
                roomParameters: CURRENT_SPACE.roomParameters,
                width: image.naturalWidth || this.size[0],
                height: image.naturalHeight || this.size[1],
            }));
        }
    
        let geometry = new PlaneGeometry(width, height)

        let material = new MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            side: DoubleSide,
        })

        const preview = new PipeLineMesh(
            geometry,
            material,
            {
                occlusionMaterial
            }
        )

        if (dragData.mime !== DRAG_MIMES.PORTAL && !dragData.isAvatar) {

            this.createBorder(width, height, depth)
        }

        return preview
    }
    
    loadAsset(dragData, signal) {

        if (dragData.mime === DRAG_MIMES.PORTAL) {

            return this.loadPortal(dragData)
        }
        else {

            return this.loadArtwork(dragData, signal)
        }
    }

    async loadPortal(dragData) {

        const spawn = getPortalSpawnData(null, false, {
            position: { x: 0, y: 0, z: 0 },
            rotation: { _x: 0, _y: 0, _z: 0 },
        })

        const portal = await PortalFactory.getPortal({
            ...this.opts,
            exhibitId: dragData.asset.id,
            spawn
        })

        await portal.initState(false)

        return portal
    }


    async loadArtwork(dragData, signal) {

        if(dragData.preload) {

            const result = await dragData.preload

            dragData.asset = result.artwork ?? dragData.asset

            dragData.mime_type = dragData.asset?.mime_type ?? dragData.mime_type

            dragData.assetMedia = getMediaType(dragData.mime_type)

            dragData.is2D =  dragData.assetMedia !== MODEL_MEDIA
        }

        CHECK_ABORT_SIGNAL(signal)

        const item = getArtworkData(null, dragData.asset, null, false, {
            position: { x: 0, y: 0, z: 0 },
            rotation: { _x: 0, _y: 0, _z: 0 },
        })
        
        const preview = await ArtworkFactory.loadAsset({ 
            ...CURRENT_SPACE, item, fromEdit: true
        })

        if ("isAvatarModel" in preview && preview.isAvatarModel) dragData.isAvatar = true

        const opts = preview.instancedBorderOpts

        if (opts && !signal.aborted) {

            // @ts-ignore
            const { artworkWidth, artworkHeight } = (preview.renderMesh ?? preview.raycastMesh)?.userData ?? {}

            this.createBorder(artworkWidth ?? this.size[0],  artworkHeight ?? this.size[1], opts.scale.z)
        }

        return preview
    }

    onDragEnd() {


        this._isDragging = false

        this._active = false

        // console.log("dragMesh drag end", this.perfs)

        this.abort?.abort()

        this.remove(this.preview)

        this.destroyBorder()

        this.preview = null
    }

    onDragLeave() {

        this._isDragging = false

        this._active = false

        // console.log("dragMesh drag leave", this.perfs)

        this.abort?.abort()

        this.remove(this.preview)

        this.disposePreview(this.preview)

        this.destroyBorder()



        this.preview = null
    }

    exit() {

        this._active = false

        this.onDragLeave()
    }

    dispose = () => {

        if(this.wasDisposed) return

        this.wasDisposed = true

        disposeObject3D(this)

        this.abort?.abort()

        this.abort = null
    }
}
