// @ts-check


import { Frustum, Group, Mesh } from "three"

import Raycaster from "@3raycaster"
import { hoveredArtwork } from "@utils/artworks/selection"

import Events from "@3events"

import Emitter from '@3emitter'

import Camera from '@3camera'


import { IS_DESKTOP, IS_MOBILE, IS_VR, TRANSITION_ACTIONS, IS_FIRST_PERSON, STATS, ARTWORK_STATS, EDIT_MODE } from "@3constants"

import { SpaceArtwork } from "@3artwork/abstract"

import { STATES, TYPES } from "@3artwork/constants"

import { VideoSpaceArtwork } from "@3artwork/meshes/video/videospaceartwork"

import { YouTubeSpaceArtwork } from "@3artwork/meshes/youtube/youtubespaceartwork"

import InstancedGeometry from '@3abstract/instancedgeometry'

import BorderInstancedMaterial from "@3factory/border/borderinstancedmaterial"


import {

    BoxGeometry,
    CylinderGeometry,

} from 'three'

import {
    getMediaType,
    AUDIO_MEDIA,
    HTML_MEDIA,
    IMAGE_MEDIA,
    MODEL_MEDIA,
    VIDEO_MEDIA,
    EMBED_HTML_MEDIA,
    EMBED_YOUTUBE_MEDIA
}
from "@3utils/mediatype"

import { disposeObject3D, getFrustum } from "@3utils/three"

import InstancedPipelineMesh from '@3abstract/instancedpipelinemesh.js'

import Players from "../../player"

import { SitZoneSpaceArtwork } from "../meshes/triggerzone/zones/sitzonespaceartwork"
// import { InstancedBorderGroup } from "./instancedbordergroup"

import { TriggerManager } from "../meshes/triggerzone/manager"

export class ArtworkContainer extends Group {

    /**
     * @param { import('@gltypes').SpaceStateOptions } opts
     */
    constructor(opts) {

        super()

        this.instancedBorderGroup = {}

        this.matrixAutoUpdate = false

        /** @type { SpaceArtwork[] } */
        this.artworks = []

        /**@type { Mesh[] }  */
        this.raycastMeshes = []

        /** @type { VideoSpaceArtwork } */
        this.localPlaying

        /** @type { Record<string, SpaceArtwork> } */
        this.previews = {}


        /** @type { SpaceArtwork } */
        this.currentArtwork = null

        this.loadersGroup = new Group()

        this.loadersGroup.name = "artworkLoaders"

        this.zoneManager = new TriggerManager();

        this.add(this.loadersGroup)

        // deactivating this for now
        this.createInstancedBorders(opts)

        window.$$ac = this
    }

    _tmpFrsutum = new Frustum()

    hasArtworksLoading(camera) {

        if(camera) {

            getFrustum(camera, this._tmpFrsutum)
        }

        let hasArtsLaoding = false

        this.loadersGroup.traverse(child => {

            // @ts-ignore
            if(hasArtsLaoding || !child.geometry) return

            if(camera == null) {

                hasArtsLaoding = true
            }
            else {

                hasArtsLaoding = this._tmpFrsutum.intersectsObject(child)
            }
        })

        return hasArtsLaoding

    }

    /**
     * @param { import('@gltypes').SpaceStateOptions } opts
     */
    createInstancedBorders(opts) {

        let artLength = {
            "square": 0,
            "circle": 0
        }

        for (const item in opts.exhibit.artworks) {

            let mediaType = getMediaType(  opts.exhibit.artworks[item].data.mime_type)

            if(mediaType !== MODEL_MEDIA ) {

                artLength[opts.exhibit.artworks[item].data?.shape || "square"] += 1;

                // console.log( artLength[opts.exhibit.artworks[item].data?.shape] ) 

            }
        }


        if( artLength['square'] > 0 ) {

            this.getInstance( 'square', artLength['square'] )
        }

        if( artLength['circle'] > 0 ) {

            this.getInstance( 'circle', artLength['circle'] )
        }

    }


    getInstance(key, max){

        if( this.instancedBorderGroup[key] == null ) {

            const geo = key == 'square' ? new BoxGeometry(1, 1, 1) : (new CylinderGeometry( 0.5, 0.5, 1, 32 )).rotateX( Math.PI / 2 )

             this.instancedBorderGroup[key] = new InstancedPipelineMesh(

                new InstancedGeometry( geo , { max: max, color: true, scale: true, rotation: true, useNormal: true, border: true, transparencySorting : true}),

                new BorderInstancedMaterial(),

                {

                 type : "INSTANCED_BORDER",

                 occlusionMaterial : new BorderInstancedMaterial()
                }
            )
        }

        this.add( this.instancedBorderGroup[key] )

        return this.instancedBorderGroup[key]
    }

    /**
     *
     * @param { import("@uitypes/experience").ArtworkData } item
     */
    hasArtwork(item) {

        return this.artworks.some(it => {

            return it.userData.id === item.data.id
        })
    }


    /**
     *
     * @param { (item: import("@uitypes/experience").ArtworkData) => boolean } fn
     * @returns
     */
    findArtwork(fn) {

        return this.artworks.find(it => {
            //
            if(it.isPlaceholder) return false

            return fn(it.item)
        })
    }


    /**
     *
     * @param { string } id
     * @returns
     */
     getArtworkById(id) {

        return this.artworks.find(it => it.userData.id === id)
    }


    /**
     *
     * @param { SpaceArtwork } artwork
     */
     addArtwork(artwork) {

        const index = this.artworks.findIndex(it => {

            return it.userData.id === artwork.userData.id
        })

        let hasPreview = index >= 0

        if(hasPreview) {

            const previous = this.artworks[index]

            // console.log("Replce preview asset", previous, "with", artwork)

            this.artworks[index] = artwork

            this.raycastMeshes[index] = artwork.raycastMesh

            // we reattach the instanced border to the new artwork
            if (previous?.instancedBorder?.visible) {

                artwork.instancedBorder = previous.instancedBorder
            }

            this.remove(previous)

            previous.dispose()

            // why is this commented out?
            // previous = null

        } else {

            this.artworks.push(artwork)

            this.raycastMeshes.push(artwork.raycastMesh)
        }

        if (artwork instanceof SitZoneSpaceArtwork) {

            this.zoneManager.add(artwork)
        }

        Emitter.emit(Events.ARTWORK_ADDED, artwork)

        this.add(artwork)

        if(artwork.instancedBorderOpts && !hasPreview) {

            artwork.instancedBorder = this.getInstance(artwork.shape).add(
                artwork.instancedBorderOpts
            );

            artwork.instancedBorder.visible = artwork.instancedBorderOpts._visible

        }


        if(!IS_VR && !artwork.isPlaceholder) {

            artwork.on(Events.CURRENT_ARTWORK_CHANGED, this.handleCurrentArtworkChanged)
        }

        if(artwork.mediaType === TYPES.VIDEO || artwork.mediaType === TYPES.YOUTUBE_EMBED) {

            artwork.on(Events.LOCAL_PLAYING_CHANGED, this.handleLocalPlayingChanged)
        }
    }

    /**
     *
     * @param { SpaceArtwork } artwork
     */
    removeArtwork(artwork) {

        const index = this.artworks.indexOf(artwork)

        if(index >= 0) {

            this.artworks.splice(index, 1)

            this.raycastMeshes.splice(index, 1)

            this.remove(artwork)

            if(artwork.instancedBorder) {

                this.instancedBorderGroup[artwork.shape].remove(
                    artwork.instancedBorder
                );
            }

            artwork.off(Events.CURRENT_ARTWORK_CHANGED, this.handleCurrentArtworkChanged)

            artwork.off(Events.LOCAL_PLAYING_CHANGED, this.handleLocalPlayingChanged)

            artwork.dispose()

            Emitter.emit(Events.ARTWORK_REMOVED, artwork)
        }
    }

    /**
     *
     * @param { import('@gltypes').ArtworkRaycastEvent } e
     */
    handleCurrentArtworkChanged = e => {

        if(!this.isTransitionning) {

            this.currentArtwork = this.getHoveredArtwork() || (e.active ? e.currentArtwork : null)

            this.updateArtworkInfo()
        }
    }

    handleLocalPlayingChanged = (e)=>{

        console.group(Events.LOCAL_PLAYING_CHANGED)

        console.log("event", e)

        if(e.active) {

            console.log("unmute local playin", e.currentMedia)

            this.localPlaying = e.currentMedia

            this.localPlaying.muted = false

        } else if(e.currentMedia === this.localPlaying) {

            console.log("mute previous local playin", e.currentMedia)

            this.localPlaying.muted = true

            this.localPlaying = null
        }

        this.updateBackgroundMedia()

        console.groupEnd()
    }

    edit(type, opts) {}


    getHoveredArtwork() {
        return hoveredArtwork(
            this.hoveredArtwork,
            Camera.current.position,
            IS_DESKTOP && !IS_VR && !EDIT_MODE && !document.pointerLockElement
        )
    }

    onMouseMove(e) {
        if (IS_DESKTOP && !IS_VR && !EDIT_MODE && !this.isTransitionning) {
            // The pointer ray is otherwise only evaluated on the next frame.
            // Update it now so stopping the mouse over art selects that art.
            if (!document.pointerLockElement && !e.isDragging) {
                Raycaster.update()
                this.hoveredArtwork = Raycaster.currentSpaceItem
            } else {
                this.hoveredArtwork = null
            }
            this.currentArtwork = this.getHoveredArtwork() ||
                (Raycaster.lookedAtItem?.isArtwork ? Raycaster.lookedAtItem : null)
            this.updateArtworkInfo()
        }


        if(e.isDragging) {

            if(IS_MOBILE && this.currentArtwork != null && !this.isTransitionning) {

                // @ts-ignore
                this.currentArtwork =
                        Raycaster.lookedAtItem?.isArtwork && !Raycaster.lookedAtItem.isPlaceholder
                            ? Raycaster.lookedAtItem
                            : null

                this.updateArtworkInfo()
            }
        }
    }


    clickAction(e) {

        const prevArtwork = this.currentArtwork

        if(!Camera.currentControls.isClickLocked()) {

            Raycaster.mouseDown(e)

            Raycaster.update()

            let clickedArtwork = Raycaster.currentSpaceItem

            if(clickedArtwork instanceof SpaceArtwork &&  clickedArtwork?.videoController) {

                clickedArtwork.videoController.handleClick()
            }
        }

        if(IS_MOBILE) {

            if ( Raycaster.currentSpaceItem instanceof SpaceArtwork ) {

                if (Raycaster.currentSpaceItem instanceof SitZoneSpaceArtwork ) return this.zoneManager.onClick();

                // 1st we need to hide the current artwork info before initiating the transition

                if(prevArtwork != null) {

                    this.currentArtwork = null

                    this.updateArtworkInfo()
                }

                this.currentArtwork = Raycaster.currentSpaceItem

                // if (!IS_FIRST_PERSON) return;


                // no transition triggered on mobile if the clicked element is a panorama

                if( Raycaster.currentSpaceItem.isPanorama == true ) {

                    return;
                }


                this.isTransitionning = true

                Emitter.emit(Events.CUSTOM, {

                    type: Events.TRANSITION,

                    value: {

                        target: this.currentArtwork.raycastMesh,

                        lookAtDistance: this.currentArtwork.maxLookatDistance(),

                        action: TRANSITION_ACTIONS.ARTWORK
                    }
                })
            }
            else if(!this.isTransitionning) {

                this.currentArtwork = null

                if(prevArtwork != null) {

                    this.updateArtworkInfo()
                }
            }
        }
    }

    onKeydownAction = (e) => {


    }

    transitionDone(opts) {

        this.isTransitionning = false

        this.updateArtworkInfo()
    }


    updateArtworkInfo() {

        if(this.displayedArtwork !== this.currentArtwork) {

            this.displayedArtwork = this.currentArtwork

            Emitter.emit(Events.CUSTOM, {

                type: Events.CURRENT_ARTWORK_CHANGED,

                value: { currentArtwork: this.currentArtwork }

            })
        }

    }

    addEvents() {

        if( this.onMouseMoveEvent == null ) {

            this.onMouseMoveEvent  = this.onMouseMove.bind(this)

            Emitter.on( Events.MOUSE_MOVE, this.onMouseMoveEvent )
        }

        if( this.onMouseClickEvent == null ) {

            this.onMouseClickEvent  = this.clickAction.bind(this)

            Emitter.on( Events.CLICK, this.onMouseClickEvent )
        }

        Emitter.on(Events.KEY_DOWN, this.onKeydownAction)

        if(STATS) {

            Emitter.on(Events.POST_UPDATE, this.onPostUpdate)
        }
    }

    removeEvents(){

        // console.log("remove Events", this)

        if( this.onMouseMoveEvent ) {

            Emitter.off( Events.MOUSE_MOVE, this.onMouseMoveEvent )

            this.onMouseMoveEvent = null
        }

        if( this.onMouseClickEvent ) {

            Emitter.off(Events.CLICK, this.onMouseClickEvent)

            this.onMouseClickEvent = null
        }

        Emitter.off(Events.KEY_DOWN, this.onKeydownAction)

        Emitter.off(Events.POST_UPDATE, this.onPostUpdate)
    }

    // onRecord( timer ){

    //     console.log(this.artworks)


    //     let i = 0
    //     while( i < this.artworks.length){

    //         i++
    //     }
    // }

    onRecord( timer ){

        return new Promise((res)=>{

            var ps = []

            let i = 0

            while( i < this.artworks.length ){

                const currentArtwork = this.artworks[i]

                if( currentArtwork instanceof VideoSpaceArtwork  ) {

                    if( Camera.frustum.intersectsObject(currentArtwork.mesh) == true ) {

                        ps.push( currentArtwork.videoController.cinematic_seek( timer ) )

                    }
                }

                i++
            }

            Promise.all(ps).then(()=>{

                res()

            })
        })
    }

    onRecordStart(){

        return new Promise( async (res)=>{

            var ps = []

            let i = 0

            while( i < this.artworks.length ){

                const currentArtwork = this.artworks[i]

                if( currentArtwork instanceof VideoSpaceArtwork  ) {

                    currentArtwork.mesh.forceHI = true

                    console.log(currentArtwork)

                    await currentArtwork.mesh.updateLODFromPosition()

                    ps.push( currentArtwork.videoController.loadBlob() )
                }

                if( currentArtwork instanceof  YouTubeSpaceArtwork ) {

                    currentArtwork.videoController?.pause()

                    currentArtwork.visible = false
                }

                i++
            }

            Promise.all(ps).then(()=>{

                console.log('end of video blob loading')

                res()

            })
        })
    }

    updateBackgroundMedia() {

        const muted = this.localPlaying !== null

        for (let i = 0; i < this.artworks.length; i++) {

            const artwork = this.artworks[i]

            if(artwork.isBackgroundAudio) {

                // @ts-ignore
                artwork.muted = muted
            }
        }
    }

    onPostUpdate = () => {

        if(STATS) {

            ARTWORK_STATS.IMAGES = 0

            ARTWORK_STATS.VIDEOS = 0

            ARTWORK_STATS.PLAYING_VIDEOS = 0

            ARTWORK_STATS.MODELS = 0

            ARTWORK_STATS.HTML = 0

            ARTWORK_STATS.CSS = 0

            for (let i = 0; i < this.artworks.length; i++) {

                const artwork = this.artworks[i]

                if(artwork.mediaType === TYPES.IMAGE) {

                    ARTWORK_STATS.IMAGES++
                }
                else if(artwork.mediaType === TYPES.VIDEO) {

                    if(artwork.mesh?.videoController) {

                        ARTWORK_STATS.VIDEOS++

                        // @ts-ignore
                        if(!artwork.videoController.video.paused) {

                            ARTWORK_STATS.PLAYING_VIDEOS++
                        }
                    }
                    else {

                        ARTWORK_STATS.IMAGES++
                    }
                }
                else if(artwork.mediaType === TYPES.MODEL) {

                    ARTWORK_STATS.MODELS++
                }
                else if(artwork.mediaType === TYPES.HTML) {

                    ARTWORK_STATS.HTML++
                }


            }
        }
    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.zoneManager.dispose()

        this.removeEvents()

        for (let i = 0; i < this.artworks.length; i++) {

            const artwork = this.artworks[i]

            artwork.dispose()

            artwork.parent?.remove(artwork)
        }

        this.artworks = null

        disposeObject3D(this.loadersGroup)

        this.loadersGroup = null

        Object.values(this.instancedBorderGroup).forEach((shapeGroup) => shapeGroup.dispose());

        this.instancedBorderGroup = null

        this.raycastMeshes = null

        this.localPlaying = null

        Object.values(this.previews || {}).forEach(preview => {

            preview.dispose()
        })

        this.previews = null

        this.currentArtwork = null
    }
}
