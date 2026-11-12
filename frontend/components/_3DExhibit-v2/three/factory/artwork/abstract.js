// @ts-check

import { Color, Matrix4, Object3D } from "three"

import Emitter from '@3emitter'

import Events from '@3events'

import Camera from '@3camera'

import { USER_INTERACTED, MAX_PLAY_DISTANCE_SQ, AUDIO_TYPES, EDITION_TRANSFORM_CONTROL } from '@3constants'

import Raycaster from '@3raycaster'

import Border, { BORDER_SIZE } from "@3factory/border"

import { SpaceItem } from '@3factory/abstract/spaceitem'

import { disposeThreeResource, lookAtDistance } from '@3utils/three'

import { artworkDepth } from "@3utils/spaceutils"

import { AbstractAudioController } from "./controllers/abstractaudiocontroller"

import { VideoController } from "./controllers/videocontroller"



export class SpaceArtwork extends SpaceItem {

    /**
     *
     * @param { import('@gltypes').SpaceArtworkOptions } opts
     */
	constructor(opts){

		super(opts)

        this.opts = opts

        this.item = opts.item

        this.artworkData = opts.item?.data

        this.borderData = null

        this.isUniformScale = true

        this._instancedBorderOpts = null

        this._maxLookatDistance = null

        this.instancedBorder = null

        this.mesh = opts.mesh

        /** @type { AbstractAudioController } */
        this._audioController = null

        /** @type {  VideoController} */
        this._videoController = null

        this._border = opts.border

        this.resources = opts.resources

        this.isArtwork = true

        // Scale conversion [UI pixels] <-> [webgl units]
        this.uiScaleFactor = 50

        this.mediaType = opts.type

        this.animationMixer = opts.mixer

        this.isSelected = false

        this.isLookedAt = false

        this.userInteracted = false

        this.addEvents()

        USER_INTERACTED.then(() => {

            this.userInteracted = true
        })

        this._infoAction = null

        this._prefTransformControl = EDITION_TRANSFORM_CONTROL.TRANSFORM_SNAP
	}


    get infoAction() {

        return this._infoAction
    }

    /** @type { Object3D } */
    get renderMesh() {

        return this.mesh
    }

    get border() {

        return this._border
    }

    set border(val) {

        this._border = val
    }

    get borderColor() {

        return this.instancedBorderOpts._baseColor
    }

    get shape(){
        return this.userData?.shape || 'square'
    }

    set borderColor(val) {

        this.artworkData.borderColor = val

        this.artworkData.hasBorder = val !== "transparent-borderless" && val !== "black-borderless"

        this.setBorder()

        const opts = this.instancedBorderOpts

        if(this.instancedBorder) {

            if(val === "transparent-borderless") {

                this.instancedBorder.visible = false
            }
            else {

                this.instancedBorder.visible = true

                this.instancedBorder.setColor(opts._hexColor)

                this.instancedBorder.setBorder(this.hasBorder ? 1 : 0)

                this.updateBorderInstance()
            }
        }
    }

    get hasBorder() {

        return this.borderColor !== "transparent-borderless" && this.borderColor !== "black-borderless"
    }

    get instancedBorderOpts() {

        return this._instancedBorderOpts
    }

    set instancedBorderOpts(val) {

        this._instancedBorderOpts = val
    }

    get hasAudio() {

        return this.audioController != null
    }

    get audioController() {

        return this._audioController || this.mesh?.audioController
    }

    get videoController() {

        return this._videoController || this.mesh?.videoController
    }


    get isBackgroundAudio() {

        return this.audioController?.isBackground
    }

    set isBackgroundAudio(val) {

        if(this.audioController) {

            this.audioController.audioType = AUDIO_TYPES.SPATIAL
        }
    }

    get muted() {

        return !!this.audioController?.muted
    }

    set muted(_muted) {

        if(this.audioController) {

            this.audioController.muted = _muted
        }
    }


    setVisible(v) {

        if(v === this.visible) return

        this.visible = v

        this.active = v


        if(!v) {

            this.raycastCallBack({ active: false, type: Raycaster.TYPES.USER_RAYCAST, intersect: null })

            if(this.videoController) {

                this._wasplaying = !this.videoController.isPaused

                this.videoController.pause()

                this.videoController.removeEvents()
            }

            this.__wasMuted = this.muted

            this.muted = true

            this.audioController?.removeEvents()
        }
        else {

            if(this.videoController) {

                this.videoController.addEvents()

                if(this._wasplaying) {

                    this.videoController.play()
                }
            }

            this.audioController?.addEvents()

            this.muted = this.__wasMuted
        }
    }

    maxLookatDistance() {

        if(this._maxLookatDistance == null) {

            this._maxLookatDistance = Math.max(
                lookAtDistance(this.raycastMesh, Camera.mainCamera) * 1.4,
                2.4
            )
        }

        return this._maxLookatDistance
    }

    inPlayRange() {

        let distanceSq = Camera.current.position.distanceToSquared(this.position)

        return distanceSq <= MAX_PLAY_DISTANCE_SQ
    }

    lookAtCallback() {}

    /**
     *
     * @param { import('@gltypes').RaycastEvent } e
     */
    raycastCallBack(e) {

        const prevLookedAt = this.isLookedAt

        const isUserAction = e.type == Raycaster.TYPES.USER_RAYCAST

        if(!isUserAction) {

            this.isLookedAt = e.active

            this.lookedAtPoint = e.intersect?.point

            if(prevLookedAt !== this.isLookedAt) {

                this.lookAtCallback({ active: e.active })
            }
        }
        else {

            this.isMouseOver = e.active
        }

        if(!isUserAction) {

            this.emit(Events.CURRENT_ARTWORK_CHANGED, {

                currentArtwork: this,
                active: e.active,
                type: e.type,
                intersect: e.intersect
            })
        }

        if(this.audioController && !this.isBackgroundAudio && prevLookedAt !== this.isLookedAt) {

            // console.log(this.isLookedAt, e)

            this.emit(Events.LOCAL_PLAYING_CHANGED, { currentMedia: this, active: this.isLookedAt })
        }
    }

    /**
     *
     * @param { number } uiSize
     * @returns number
     */
    uiSizeToScale(uiSize) {
        return uiSize / this.uiScaleFactor;
    }

    /**
     *
     * @param { number } uiSize
     * @returns number
     */
     scaleToUISize(uiSize) {
        return uiSize * this.uiScaleFactor;
    }

    update()  {}

    onMatrixChange = () => {

        this.updateBorderInstance()
    }

    updateBorderInstance() {

        if(this.instancedBorder) {

            // console.log("change border")

            const opts = this.instancedBorderOpts

            opts.scale.x = opts._baseScale.x * this.scale.x
            opts.scale.y = opts._baseScale.y * this.scale.y
            opts.scale.z = opts._baseScale.z * this.scale.z

            this.instancedBorder.updateCoords(this.position, this.quaternion, opts.scale)
        }
    }


    addEvents(){

        if(this._hasEvents) return

        this._hasEvents = true

        this.preUdpdateEVent = this.update.bind(this)

        Emitter.on(Events.PRE_UPDATE, this.preUdpdateEVent)

        this.onMatrixChanged(this.onMatrixChange)

        this.onSelect( e => {

            if (!e.isSelected) {

                this.audioController?.hideVolumeRange();
            }
            else if(this.audioController?.audioType === AUDIO_TYPES.SPATIAL) {

                this.audioController.showVolumeRange()
            }
        })
    }

    removeEvents(){

        if(!this._hasEvents) return

        this._hasEvents = false

        Emitter.off(Events.PRE_UPDATE, this.preUdpdateEVent)

        this.offMatrixChanged(this.onMatrixChange)

    }

    setBorder() {

        if(this.mesh == null) return

        const { artworkWidth, artworkHeight } = this.mesh.userData

        const opts = this.opts

        const artworkData = this.artworkData

        const depth = artworkDepth(opts.roomParameters)


        // if( opts.space.artworkContainer.instancedBorder ) {

            // if (  artworkData.borderColor != 'transparent-borderless' ){

                const colorStr = artworkData.borderColor ? artworkData.borderColor : "#000000"

                const borderWidthSize = artworkData.hasBorder ? BORDER_SIZE   : 0;

                const borderHeightSize = artworkData.hasBorder ? BORDER_SIZE / (artworkHeight / artworkWidth)  : 0;

                const baseBorderWidth = (artworkWidth *  (1 + borderWidthSize))

                const baseBorderHeight = (artworkHeight * (1+ borderHeightSize))

                const artworkScaledWidth = baseBorderWidth * (artworkData.scale ?? 1)

                const artworkScaledHeight = baseBorderHeight * (artworkData.scale ?? 1)

                this.instancedBorderOpts = {

                    color: new Color(colorStr),

                    _baseColor: artworkData.borderColor,

                    _hexColor: colorStr,

                    _baseScale: {
                        x: baseBorderWidth,
                        y: baseBorderHeight,
                        z: depth
                    },

                    _visible: artworkData.borderColor != 'transparent-borderless',

                    scale: {
                        x: artworkScaledWidth,
                        y: artworkScaledHeight,
                        z: depth
                    },
                    rotation: {
                        x: opts.item.rotation._x,
                        y: opts.item.rotation._y,
                        z: opts.item.rotation._z,
                    },
                    position: {
                        x: opts.item.position.x,
                        y: opts.item.position.y,
                        z: opts.item.position.z,
                    },

                    border: artworkData.hasBorder ? 1 : 0

                }
            // }
        // }

        // else {

        //     this.border = Border.get({
        //         color: artworkData.borderColor,
        //         height: artworkHeight,
        //         width: artworkWidth,
        //         depth,
        //         borderSize: artworkData.hasBorder ? 0.05 : 0
        //     });

        //     this.add(this.border)

        //     this.resources.push(this.border)
        // }
    }

    rescaleBorder() {
        //
        this.setBorder()

        this.updateBorderInstance()
    }

    dispose() {

        if(this.wasDisposed) return;

        this.wasDisposed = true

        super.disposeResources()

        // console.log

        // console.log(this.mesh)


        this.mesh?.dispose?.()

        this.removeEvents()

        for (let i = 0; i < this.resources.length; i++) {

            const resource = this.resources[i]

            if(resource) {

                disposeThreeResource(resource)
            }
        }

        for(let i = 0; i < this.children.length; i++) {

            this.remove(this.children[i])
        }

        this.opts = null

        this.mesh = null

        this.border = null

        this.resources = null
    }
}
