// @ts-check

import { placeFeetOnGround } from "./states/groundPlacement"
import { placeArtworkInFrontOfCamera } from "../../utils/cameraArtworkPlacement";

import { Vector3, Group } from 'three'

import Emitter from '@3emitter'

import Events from '@3events'

import Camera from '@3camera'


import Raycaster from "@3raycaster"

import Root from '@3gl/root'

import { ARTWORK_VERSION, EDITION_ACTIONS, APP_STATES, EDIT_MODE, CURRENT_STATE } from '@3constants'

import PortalFactory from '@3factory/portal'

import { SpaceArtwork } from '@3artwork/abstract'

import { SpacePlaceholder } from '@3artwork/placeholders/spaceplaceholder'

import { TYPES } from '@3artwork/constants'

import { AudioSpaceArtwork } from '@3artwork/meshes/audio/audiospaceartwork'

import { VideoSpaceArtwork } from '@3artwork/meshes/video/videospaceartwork'

import PlaceholderFactory from '@3artwork/placeholders'

import ArtworkFactory from '@3artwork/index'

import { HTMLSpaceArtwork } from '@3artwork/meshes/html/HTMLspaceartwork'

import { ModelSpaceArtwork } from '@3artwork/meshes/model/modelspaceartwork'

import { getDefaultAssetPosition, getDefaultAssetRotation, idToCoords } from '@3utils/spaceutils'

import { ImageSpaceArtwork } from '../artwork/meshes/image/imagespaceartwork'

import { getMediaType, IMAGE_MEDIA, PANORAMA_MEDIA, VIDEO_MEDIA } from '@3utils/mediatype'

import { ENVMAPS } from '@components/_3DExhibit-v2/utils/envmaps'

import  CSS3DRenderer from '@3gl/renderer/css3D/renderer'

import { TextSpaceArtwork } from '../artwork/meshes/text/textspaceartwork'

import { SpaceItem } from '../abstract/spaceitem'

import { Portal } from '../portal/portal'
import { snap, toXYZ, toXYZ_ } from '../../utils/three'
import { PORTAL_SHAPES } from '../portal/previewmesh'
import { CSSHTMLSpaceArtwork } from '../artwork/meshes/html/CSSHTMLspaceartwork'
import { asAny, deepClone } from '@utils/js'
import { AUDIO_TYPES } from '@3constants'
import { coordsToId } from '@utils/metadata/formatExhibit'
import { LODMesh } from '../artwork/LODmesh'
import { PanoramaSpaceArtwork } from '../artwork/meshes/panorama/panoramaspaceartwork'
import CSSEmbedArtwork from '../artwork/meshes/css'
import TextArtwork from '../artwork/meshes/text'
import ComponentManager from '../space/componentManager'
import { Component3D } from '../space/kits/abstract'
import { Selector } from './selector'
import { SpaceComponent } from '../abstract/spacecomponent'
import { getArtworkData, getPortalSpawnData } from './utils'
import { overrideInitialCoords } from "@3utils/spaceutils";


/**
 * @typedef { object } EditorDragData
 * @property { string } previewUrl
 * @property { string } mime_type
 * @property { unknown } asset
 * @property { HTMLImageElement } [previewImg]
 * @property { import('@3constants').DRAG_MIME_TYPES } mime
 * @property { string } assetMedia
 *
 *
 * @typedef {import('@uitypes/Asset').Asset} Asset
 * @typedef {import('@uitypes/experience.js').ArtworkData} ArtworkData
 * @typedef { import('@3constants').EDIT_ACTIONS } EDIT_ACTIONS
 * @typedef {import('@3constants').EDIT_ACTION_TYPE} EDIT_ACTION_TYPE
 * @typedef {import('@gltypes').XYZ} XYZ
 *
 * @typedef { "content" | "kitbash" } SelectionMode
 */


export class Editor extends Group {

    /**
     *
     * @param { import('@gltypes').ItemFactoryOptions } opts
     */
	constructor(opts){

        super()

        this.opts = opts

        /** @type { SpacePlaceholder[] } */
        this.placeholders = []

        this.raycastMeshes = []

        this.artworkContainer = Root.currentArtworks

        this.portalContainer = Root.currentPortals

        /** @type { ComponentManager } */
        this.kitbash = opts.space.kitbash

        this.selector = new Selector(opts)

        this.add(this.selector)

        this.loadPlaceholders()

        if(process.env.NODE_ENV === "development") {

            // @ts-ignore
            window.$$ed = this
        }
	}

    updateState(STATE) {

        const val = Camera.isEditing && STATE !== APP_STATES.CINEMATIC
        
        this.setEnabled(val)

        this.visible = val

    }

    _editEnabled = false

    setEnabled(isEnabled) {

        if(isEnabled === this._editEnabled) return

        this._editEnabled = isEnabled

        this.visible = isEnabled

        this.artworkContainer.artworks.forEach(it => {
            //
            if(it.mediaType === "CYBER_TEXT" && !it.userData.text) {
                //
                it.visible = isEnabled
            }
        })

        if(isEnabled) {

            this.addEvents()

            Raycaster.register(
                this.raycastMeshes,
                Raycaster.TYPES.PLACEHOLDERS
            )
        }
        else {

            this.removeEvents()

            Raycaster.unregisterAll( Raycaster.TYPES.PLACEHOLDERS )
        }

        this.selector.enabled = isEnabled
    }

    onSelectorDrop = (data) => {
    
        const { target, keepPlaceholder, drop } = data

        if (drop != null) {

            this.drop = drop
    
            this.add(drop)
    
            if (target != null && !keepPlaceholder) {
    
                target.visible = false
            }
        }

        Emitter.emit(Events.CUSTOM, {

            type: Events.EDITOR_DROP,

            value: {
                ... data,

                abort: () => {

                    if (this.drop == null) return

                    this.remove(this.drop)

                    this.drop.abort()

                    this.drop.dispose()

                    this.drop = null

                    if (target != null && !keepPlaceholder) {

                        target.visible = true
                    }
                },
            }
        })
    }

    addEvents() {

        this.selector.on(
            Events.EDITOR_DROP,
            this.onSelectorDrop
        )

    }

    removeEvents() {

        this.selector.off(
            Events.EDITOR_DROP,
            this.onSelectorDrop
        )
    }

    /** @param { SpacePlaceholder } placeholder */
    addPlaceholder(placeholder) {

        this.placeholders.push(placeholder)

        this.add(placeholder)

        this.raycastMeshes.push(placeholder.raycastMesh)
    }

    /** @param { SpacePlaceholder } placeholder */
    removePlaceholder(placeholder) {

        const idx = this.placeholders.indexOf(placeholder)

        if(idx >= 0) {

            this.placeholders.splice(idx, 1)

            this.raycastMeshes.splice(idx, 1)

            this.remove(placeholder)
        }
    }

    /**
     *
     * @param { import('@gltypes').XYZ } pos
     * @returns
     */
    posToId(pos) {
        return pos.x.toFixed(2) + "X" + pos.y.toFixed(2) + "X" + pos.z.toFixed(2)
    }

    toNum(x) {
        return x != null ? Number(x) : null
    }

    loadPlaceholders() {

        let placeholders = PlaceholderFactory.get(this.opts)

        let slots = {}

        Object.values(this.opts.exhibit.artworks || {}).forEach(item => {

            if(item.data.placeholderId == null) return

            slots[this.posToId(item.originalPosition)] = true
        })

        Object.values(this.opts.exhibit.portals || {}).forEach(item => {

            if(!item.spawn?.placeholderId) return

            slots[this.posToId(item.spawn.originalPosition)] = true
        })

        placeholders.forEach(p => {

            const artworkId = this.posToId(p.position)

            if(slots[artworkId] == null) {

                this.addPlaceholder(p)
            }
        })
    }

    setSelectedArtwork(artwork) {

        artwork = typeof artwork === "string" ? this.artworkContainer.getArtworkById(artwork) : artwork

        this.selector.setSelection(artwork == null ? [] : [artwork])
    }

    get selectedArtwork() {

        return this.selector.selectedItem
    }



    //#region Editor handlers
    /**
     * @template {import('./actions').EDITOR_ACTION_TYPE} T
     * @template {import('./actions').EditorActionMap[T]} A
     *
     * @param {T} type
     * @param {A} action
     * @returns {import('./actions').EditorReturnType[T]}
     */
    edit(type, action) {

        action.type = type

        switch(action.type) {

            case EDITION_ACTIONS.EDITOR_ADD_ARTWORK:

                return asAny(this.handleAddArtwork(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_COLLIDER:

                return asAny(this.handleChangeCollider(action))

            case EDITION_ACTIONS.EDITOR_REMOVE_ARTWORK:

                return asAny(this.handleDeleteArtwork(action))

            case EDITION_ACTIONS.EDITOR_DUPLICATE_ARTWORK:

                return asAny(this.handleDuplicateArtwork(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM_MODE:

                return asAny(this.handleChangeTransformMode(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM_CONTROLS:

                return asAny(this.handleChangeTransformControls(action))

            case EDITION_ACTIONS.EDITOR_SELECT_ANIMATION:

                return asAny(this.handleSelectAnimation(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_ENVMAP:

                return asAny(this.handleChangeEnvmap(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_BORDER:

                return asAny(this.handleChangeBorder(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_AUDIO:

                return asAny(this.handleChangeAudio(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_VIDEO_OPTS:

                return asAny(this.handleChangeVideoOpts(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_SIZE:

                return asAny(this.handleChangeSize(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM:

                return asAny(this.handleChangeTransform(action))

            case EDITION_ACTIONS.EDITOR_TOGGLE_HTML:

                return asAny(this.handleToggleHTM(action))

            case EDITION_ACTIONS.EDITOR_TOGGLE_360:

                return asAny(this.handleToggle360(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_3D_SCALE:

                return asAny(this.handleChange3DObjectScale(action))

            case EDITION_ACTIONS.EDITOR_UPDATE_ARTWORK_MEDIA:

                return asAny(this.handleUpdateArtworkMedia(action))

            case EDITION_ACTIONS.EDITOR_UPDATE_MODEL_MEDIA:

                return asAny(this.handleUpdateModelMedia(action))

            case EDITION_ACTIONS.REPLACE_HTML_PREVIEW_TEXTURE:

                return asAny(this.handleReplaceHtmlPreviewTexture(action))

            case EDITION_ACTIONS.UPDATE_CYBER_TEXT:

                return asAny(this.handleUpdateCyberText(action))

            case EDITION_ACTIONS.EDITOR_ADD_PORTAL:

                    return asAny(this.handleAddPortal(action))

            case EDITION_ACTIONS.EDITOR_SET_PORTAL:

                return asAny(this.handleSetPortal(action))

            case EDITION_ACTIONS.EDITOR_DELETE_PORTAL:

                return asAny(this.handleDeletePortal(action))

            case EDITION_ACTIONS.SET_SELECTED_ITEMS:

                return asAny(this.handleSelectItems(action))

            case EDITION_ACTIONS.HANDLE_DRAG_START:

                return asAny(this.handleDragStart(action))

            case EDITION_ACTIONS.HANDLE_DRAG_END:

                return asAny(this.handleDragEnd(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_DIMENSIONS:

                return asAny(this.handleChangeDimensions(action))

            case EDITION_ACTIONS.EDITOR_ADD_KITBASH:

                return asAny(this.handleAddKitBash(action))

            case EDITION_ACTIONS.EDITOR_DUPLICATE_KITBASH:

                return asAny(this.handleDuplicateKitbash(action))

            case EDITION_ACTIONS.EDITOR_REMOVE_KITBASH:

                return asAny(this.handleRemoveKitBash(action))

            case EDITION_ACTIONS.EDITOR_UPDATE_KITBASH:

                 return asAny(this.handleUpdateKitBash(action))

            // case EDITION_ACTIONS.EDITOR_RESET_KITBASH:

            //     return asAny(this.handleResetKitBash(action))

            case EDITION_ACTIONS.EDITOR_CHANGE_LOCK:

                return asAny(this.handleChangeLock(action))
        }
    }


    /**
     *  @typedef {object} KITBASH_ADD
     *  @property {EDIT_ACTIONS["EDITOR_ADD_KITBASH"]} type
     *  @property {string } ctype
     *  @property {string} kit
     *  @property {import('@3factory/space/kits/types').PresetData} [preset]
     *  @property {string} id
     *  @property {boolean} [duplicate]
     *  @property {any} [payload]
     *  @property {boolean} [realtime]

     *
     * @param { KITBASH_ADD } opts
     */
    async handleAddKitBash(opts) {

        const element =  await this.kitbash.handleAddType(opts)

        if(element.collisionMesh != null) {

            const world = Camera.getWorld()

            world?.collisions.addCollider(element);
        }

        return element?.data
    }


    /**
     *  @typedef {object} KITBASH_DUPLICATE
     *  @property {EDIT_ACTIONS["EDITOR_DUPLICATE_KITBASH"]} type
     *  @property {any} [payload]

     *
     * @param { KITBASH_DUPLICATE } opts
     */
    async handleDuplicateKitbash(opts) {

        return this.handleAddKitBash({
            type: EDITION_ACTIONS.EDITOR_ADD_KITBASH,
            ctype: opts.payload.type,
            kit: opts.payload.kit,
            preset: null,
            id: opts.payload.id,
            duplicate: true,
        })
            
    }

    /**
     *  @typedef {object} KITBASH_REMOVE
     *  @property {EDIT_ACTIONS["EDITOR_REMOVE_KITBASH"]} type
     *  @property {string} id
     *
     *
     * @param { KITBASH_REMOVE } opts
     */
     async handleRemoveKitBash(opts) {

        const component = this.kitbash.getComponentById(opts.id)

        if (component == null) {

            throw new Error("invalid component id " + opts.id)
        }

        this.selector.toggleSelection([component], false)

        const result = this.kitbash.handleRemoveElement(opts)

        if(result?.collisionMesh != null) {

            const world = Camera.getWorld()

            world?.collisions.removeCollider(result);
        }

        return result?.data

    }

    /**
     *  @typedef {object} KITBASH_UPDATE
     *  @property {EDIT_ACTIONS["EDITOR_UPDATE_KITBASH"]} type
     *  @property {string} id
     *  @property {any} payload

     *
     * @param { KITBASH_UPDATE } opts
     */
    async handleUpdateKitBash(opts) {

        const result = this.kitbash.handleUpdateElement(opts)

        return result

    }



    /**
     *  @typedef {object} KITBASH_RESET
     *  @property {EDIT_ACTIONS["EDITOR_RESET_KITBASH"]} type
     *  @property {import('@uitypes/experience.js').KitBashData[]} data

     *
     * @param { KITBASH_RESET } opts
     */
     async handleResetKitBash(opts) {

        return this.kitbash.handleReset(opts)
    }


    /**
     * @typedef {object} SET_SELECTED_ITEMS
     *  @property {EDIT_ACTIONS["SET_SELECTED_ITEMS"]} type
     *  @property {(SpaceComponent | string)[]} items
     *  @property {boolean} [toggle]
     *
     *
     * @param { SET_SELECTED_ITEMS } opts
     */
    async handleSelectItems(opts) {

        const items = opts.items?.map(it => { 
            
            if (typeof it === "string") {

                it = this.getComponent(it)

                if (it == null) {

                    throw new Error("invalid component id " + it)
                }
            }

            return it
        })

        if (opts.toggle) {

            this.selector.toggleSelection(items, true)
        }
        else {

            this.selector.setSelection(items)
        }
    }


    /**
     * @typedef {object} CHANGE_LOCK
     *  @property {EDIT_ACTIONS["EDITOR_CHANGE_LOCK"]} type
     *  @property {string} artworkId
     *  @property {object} lock

     *
     * @param { CHANGE_LOCK } opts
     */
    async handleChangeLock(opts) {

        const target = this.getTarget(opts.artworkId)

        target.lock(opts.lock)

        target.userData.lock = opts.lock

        if(target === this.selectedArtwork) {

            this.selector.syncLockState()
        }

        return opts
    }




    /**
     * @typedef {object} HANDLE_DRAG_START
     * @property {EDIT_ACTIONS["HANDLE_DRAG_START"]} type
     * @property { DragEvent } event
     * @property { string } mime
     * @property { any } data
     *
     * @param { HANDLE_DRAG_START } opts
     */
    handleDragStart(opts) {

        this.selector.handleDragStart(opts)
    }

    /**
     * @typedef {object} HANDLE_DRAG_END
     * @property {EDIT_ACTIONS["HANDLE_DRAG_END"]} type
     * @property { DragEvent } event
     *
     * @param { HANDLE_DRAG_END } opts
     */
    handleDragEnd(opts) {

        this.selector.handleDragEnd()
    }

    /**
     * @typedef { SpacePlaceholder | SpaceArtwork | Portal } TargetSpaceItem
     *
     *
     * @param {string} id
     */
    getTarget(id) {

        /** @type { TargetSpaceItem } */
        let oldArtwork = this.placeholders.find(it => it.placeholderId === id)

        if(oldArtwork == null) {

            oldArtwork = this.artworkContainer.artworks.find(it => !it.isPlaceholder && it.item.data.id === id)
        }

        if(oldArtwork == null) {

            oldArtwork = this.portalContainer.portals.find(it => (it.userData.id === id || it.placeholderData.portalId === id))
        }

        return oldArtwork

    }

    getComponent(id) {

        /** @type { SpaceComponent } */
        let res = this.getTarget(id)

        if (res == null) {

            res = this.kitbash.getComponentById(id)
        }

        return res
    }

    /**
     *
     * @param {TargetSpaceItem} target
     * @param {boolean} keepPlaceholder
     */
     removeTarget(target, keepPlaceholder) {

        if(target == null) return

        this.selector.toggleSelection([target], false)

        if(target instanceof SpacePlaceholder) {

            if(!keepPlaceholder) {

                this.removePlaceholder(target)
            }
        }
        else if(target instanceof SpaceArtwork) {

            if(!keepPlaceholder) {

                this.artworkContainer.removeArtwork(target)
            }
        }
        else if(target instanceof Portal) {

            if(!keepPlaceholder) {

                this.portalContainer.removePortal(target)
            }
        }
        else {

            console.error("edit/removeTarget: invalid target", target)
        }
    }


    /**
     * @typedef { ArtworkData & { file?: Blob } } AddArtworkResult
     *
     * @typedef {object} EDITOR_ADD_ARTWORK
     *  @property {EDIT_ACTIONS["EDITOR_ADD_ARTWORK"]} type
     *  @property {import('@uitypes/Asset').FetchedAsset} asset
     *  @property {string} placeholderId
     *  @property {boolean} [keepPlaceholder]
     *  @property {boolean} [autoSelect]
     *  @property {Partial<ArtworkData>} [artworkDataProps]
     *  @property {ArtworkData} [remotePayload]
     *  @property {boolean} [realtime]
     *  @property {AbortSignal} [abort]
     *
     *
     * @param { EDITOR_ADD_ARTWORK } action
     * @returns { Promise<AddArtworkResult> }
     */
    async handleAddArtwork ({
        placeholderId,
        asset,
        keepPlaceholder = false,
        autoSelect = true,
        artworkDataProps = {},
        remotePayload,
        realtime = false,
        abort,
    }) {

        let target = placeholderId ? this.getTarget(placeholderId) : null

        if(!realtime) {

            this.selector.hideTransforms()
        }

        /** @type { AddArtworkResult } */
        let artworkData = remotePayload

        // debugger

        /** @type { SpaceArtwork } */
        let artwork;

        if(artworkData == null) {
    
            artworkData = getArtworkData(target, asset, placeholderId, keepPlaceholder, artworkDataProps)
        }

        let isDrop = this.drop != null

        if ( isDrop ) {

            if (this.drop.preview.isArtwork) {

                artwork = this.drop.preview
    
                artwork.item = artworkData
    
                artwork.userData.id = artworkData.data.id

                artwork.userData.placeholderId = artworkData.data.placeholderId
            }
        }

        if (artwork == null) {
    
            artwork = await ArtworkFactory.loadAsset({ ...this.opts, item: artworkData, fromEdit: true, abort })
        }

        if (this.drop != null) {

            this.drop.commit(artwork)

            artwork.position.copy(this.drop.position)
    
            artwork.quaternion.copy(this.drop.quaternion)

            if (artwork instanceof ModelSpaceArtwork && artwork.isAvatarModel && this.drop.groundPoint) {
                placeFeetOnGround(artwork, this.drop.groundPoint)
            }

            this.drop.dispose()

            this.drop = null
        }

        if (
            !isDrop && !remotePayload && !realtime && !target &&
            artworkDataProps.position == null &&
            !(artwork instanceof PanoramaSpaceArtwork)
        ) {
            // Fit fresh camera-spawned artwork after its real dimensions load.
            // Drops, replacements and saved placements retain their coordinates.
            placeArtworkInFrontOfCamera(artwork, Camera.current);
            artworkData.originalPosition = toXYZ(artwork.position);
        }

        if (artwork instanceof ModelSpaceArtwork && artwork.isAvatarModel && !isDrop && !remotePayload && !target) {
            const ground = this.selector.dragState.findFloorBelow(artwork.position)
            if (ground) placeFeetOnGround(artwork, ground.point)
        }

        if (artwork.mediaType === "MODEL") {

            ArtworkFactory.mixers.push(artwork.animationMixer);
        }

        if(artwork instanceof TextSpaceArtwork && target instanceof SpaceArtwork && !target.isPlaceholder && keepPlaceholder) {
            //
            let v = new Vector3(0, 0, 0.2 )

            v.applyQuaternion(artwork.quaternion)

            artwork.position.add(v)
        }

        this.removeTarget(target, keepPlaceholder)

        this.artworkContainer.addArtwork(artwork)

        artwork.updateBorderInstance()

        if(artwork.cssObject) {

            CSS3DRenderer.scene.add(artwork.cssObject)
        }

        // if(!realtime && this._editEnabled) {

        //     if(artwork instanceof ModelSpaceArtwork && artwork.transformedBlob) {

        //         artworkData = { ...artworkData, file: artwork.transformedBlob }
        //     }
        // }

        // @ts-ignore
        // artworkData.data = artwork.userData
        artworkData = {
            ...artworkData,
            position: toXYZ(artwork.position),
            rotation: toXYZ_(artwork.rotation),
            ...(artwork instanceof ModelSpaceArtwork && artwork.isAvatarModel ? { animations: { ...artwork.activeAnimations } } : {})
        }

        return artworkData
    }


    /**
      * @typedef {object} EDITOR_ADD_PORTAL
      *  @property {EDIT_ACTIONS["EDITOR_ADD_PORTAL"]} type
      *  @property {string} placeholderId
      *  @property {string} exhibitId
      *  @property {string} coords
      *  @property {import('@uitypes/experience.js').PortalData} [remotePayload]
      *  @property {boolean} [keepPlaceholder]
      *  @property {boolean} [realtime]
      *  @property {any} [levels]
      *
      * @param { EDITOR_ADD_PORTAL } opts
      **/
     async handleAddPortal({ placeholderId, exhibitId, coords, keepPlaceholder, remotePayload, realtime = false, levels }) {

        let placeholder = this.getTarget(placeholderId)

        if(!realtime) {

            this.selector.hideTransforms()
        }

        /** @type { Portal } */
        let portal;

        let result, spawn;

        let isDrop = this.drop != null

        if(placeholder instanceof Portal && placeholder.spawn == null) {

            this.drop?.abort()

            this.drop?.dispose()

            return this.handleSetPortal({
                type: EDITION_ACTIONS.EDITOR_SET_PORTAL,
                portalId: placeholderId,
                exhibitId,
                coords,
                realtime,
                remotePayload,
            })
        }

        if(remotePayload != null) {

            portal = await PortalFactory.getPortal({
                ...this.opts,
                ...remotePayload
            })
        }
        else {

            spawn = getPortalSpawnData(placeholder, keepPlaceholder)

            if (isDrop) {

                portal = this.drop.preview

            } 
            else {

                portal = await PortalFactory.getPortal({
                    ...this.opts,
                    exhibitId,
                    coords,
                    spawn,
                    levels
                })
            }

            result = await this.setPortalExhibit(portal, exhibitId, coords, isDrop)

            if (this.drop != null) {

                portal.position.copy(this.drop.position)

                portal.quaternion.copy(this.drop.quaternion)

                spawn.position = toXYZ(portal.position)

                spawn.rotation = toXYZ_(portal.rotation)

                portal.spawn = spawn

                portal.placeholderData.portalId = spawn.portalId

                portal.userData = {
                    ...portal.userData,
                    id: spawn.portalId,
                    placeholderId: spawn?.placeholderId,
                    spawn,
                }
                
                this.drop.commit(portal)
    
                this.drop.dispose()
    
                this.drop = null
            }
        }

        if(placeholder != null)  {

            this.removeTarget(placeholder, keepPlaceholder)
        }

        this.portalContainer.addPortal(portal)


        return {
            ...result,
            update: {
                id: portal.userData.id,
                exhibitId,
                spawn
            }
        }
    }


    /**
      * @typedef {object} EDITOR_SET_PORTAL
      *  @property {EDIT_ACTIONS["EDITOR_SET_PORTAL"]} type
      *  @property {string} portalId
      *  @property {string} [exhibitId]
      *  @property {string} [coords]
      *  @property {import('@uitypes/experience.js').PortalData} [remotePayload]
      *  @property {boolean} [realtime]
      *  @property {import('@uitypes/experience.js').PortalData["spawn"]["shape"]} [shape]
      *
      * @param { EDITOR_SET_PORTAL } opts
      **/
     async handleSetPortal({ portalId, exhibitId, shape, coords, realtime = false, remotePayload }) {

        console.log("handleSetPortal/start", portalId, exhibitId)

        let portal = this.portalContainer.portals.find(
            (it) => it.placeholderData.portalId === portalId
        )

        if (portal == null) return null

        if(exhibitId) {

            if (portal.portalData?.exhibit?.id !== exhibitId) {

                let result;

                if(remotePayload) {

                    const portalData = await PortalFactory.loadPortalData(exhibitId)

                    await portal.setPortalData(portalData, remotePayload)
                }
                else {

                    result = await this.setPortalExhibit(portal, exhibitId, coords)
                }

                return {
                    ...result || {},
                    update: {
                        id: portal.userData.id,
                        exhibitId,
                    }
                }
            }
        }
        else if(shape) {

            return this.setPortalShape(portal, shape)
        }
    }


    /**
     *
     * @typedef {object} EDITOR_DUPLICATE_ARTWORK
     *  @property {EDIT_ACTIONS["EDITOR_DUPLICATE_ARTWORK"]} type
     *  @property {ArtworkData} [payload]
     *  @property {boolean} [autoSelect]
     *  @property {boolean} [realtime]
     *  @property {AbortSignal} [abort]
     *
     *
     * @param { EDITOR_DUPLICATE_ARTWORK } action
     * @returns { Promise<ArtworkData> }
     */
    async handleDuplicateArtwork ({
        payload,
        autoSelect = true,
        realtime = false,
        abort,
    }) {

        let target = this.getTarget(payload.data.id)

        if (!realtime) {

            this.selector.hideTransforms()
        }

        /** @type {ArtworkData} */
        let artworkData = deepClone(payload)

        const { _x, _y, _z } = payload.rotation
        const dummyTarget = { position: payload.position, rotation: { x: _x, y: _y, z: _z } }
        const uid = `f${String(Date.now())}`

        artworkData.data.id = coordsToId(dummyTarget, uid, this.opts.exhibit)

        artworkData.data.placeholderId = null

        delete artworkData.lock

        /**
         * TODO:
         *  We should have a clone method to optimize, but duplicates should also be handled at the load level
         *  otherwise it's useless
         *
         */
        let artwork = await ArtworkFactory.loadAsset({ ...this.opts, item: artworkData, abort })

        if (artwork.mediaType === "MODEL") {

            ArtworkFactory.mixers.push(artwork.animationMixer);

            snap(target, artwork, { horz: "left", offset: 0.1 })
        }
        else {

            snap(target, artwork, { horz: "left", offset: 0.2 })
        }

        const p = artwork.position
        const r = artwork.rotation

        artworkData.position = { x: p.x, y: p.y, z: p.z }
        artworkData.rotation = { _x: r.x, _y: r.y, _z: r.z }


        this.artworkContainer.addArtwork(artwork)

        if(artwork.cssObject) {

            CSS3DRenderer.scene.add(artwork.cssObject)
        }

        return artworkData
    }


    /**
      * @typedef {object} UPDATE_CYBER_TEXT
      *  @property {EDIT_ACTIONS["UPDATE_CYBER_TEXT"]} type
      *  @property {string} meshId
      *  @property {any} [textColor]
      *  @property {import('@uitypes/Asset').TextAlign} [align]
      *  @property {number} [width]
      *  @property {number} [lineHeight]
      *  @property {string} [text]
      *  @property {string} [font]
      *  @property {import('@uitypes/Asset').TextTransform} [textTransform]
      *
     * @param {UPDATE_CYBER_TEXT} opts
     * @returns
     */
    async handleUpdateCyberText(opts) {

        const artwork = this.artworkContainer.artworks.find(it => it.userData.id === opts.meshId)

        if(!(artwork instanceof TextSpaceArtwork)) return



            // color: [1,1,1],
            // align: 'left',
            // scale : GLOBAL_TEXT_SCALE * 20,
            // lineHeight: 60,
            // text: item.data.text,



            if (opts.align) {

                artwork.font.updateStyle({
                    align: opts.align
                })

                artwork.userData.align = opts.align

            }

            if(opts.textColor) {

                artwork.font.updateStyle({
                    color: opts.textColor
                })

                artwork.userData.textColor = opts.textColor;

            }

            if(opts.width) {

                artwork.font.updateStyle({
                    width: opts.width
                })


                artwork.updateRaycastMesh()

                artwork.userData.width = opts.width;

            }

            if(opts.text != null || opts.textTransform) {

                const text = opts.text ?? artwork.userData.text;

                const textTransform = opts.textTransform || artwork.userData.textTransform;

                artwork.font.text = TextArtwork.getTransformedText( text, textTransform )

                artwork.font.update()

                artwork.updateRaycastMesh()

                artwork.userData.text = text;

                artwork.userData.textTransform = textTransform;

            }

            if(opts.lineHeight) {

                artwork.font.updateStyle({
                    lineHeight: opts.lineHeight
                })

                artwork.updateRaycastMesh()

                artwork.userData.lineHeight = opts.lineHeight;

            }

            if(opts.font) {

                await TextArtwork.updateFont(artwork, opts.font)

                artwork.userData.font = opts.font

            }


            return {

                lineHeight: artwork.font.lineHeight,

                align: artwork.font.options?.align,

                textColor: artwork.font.color,

                width: artwork.font.options?.width,

                text: artwork.userData.text,

                textTransform: artwork.userData.textTransform,

                font: artwork.userData.font
            }


        // Update cyber text code...
    }

    /**
      * @typedef {object} EDITOR_REMOVE_ARTWORK
      *  @property {EDIT_ACTIONS["EDITOR_REMOVE_ARTWORK"]} type
      *  @property {string} artworkId
      *  @property {boolean} [realtime]
      *
      * @param { EDITOR_REMOVE_ARTWORK } opts
      * */
    async handleDeleteArtwork({ artworkId, realtime = false }) {

        let placeholderMesh = null

        if(!realtime) {

            this.selector.hideTransforms()
        }

        /** @type { SpaceArtwork | Portal | Component3D } */
        let artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if(artwork == null) {

            artwork = this.portalContainer.portals.find((obj) => obj.userData.id === artworkId)
        }

        if(artwork == null) {

            artwork = this.kitbash.getComponentById(artworkId)
        }

        if(artwork == null) {

            console.error("[ArtworkEditor/handleDeleteArtwork] Can't find artwork", artworkId)

            return
        }

        this.selector.toggleSelection([artwork], false)

        if(artwork instanceof Component3D) {

            this.kitbash.handleRemoveElement({ id: artworkId })

        }
        if(artwork instanceof SpaceArtwork) {

            if (artwork.mediaType === TYPES.PLACEHOLDER) return

            this.artworkContainer.removeArtwork(artwork)
        }

        else if(artwork instanceof Portal) {

            this.portalContainer.removePortal(artwork)
        }

        // @ts-ignore

        if( !(artwork instanceof Component3D) && artwork.userData.placeholderId) {

            let item = artwork instanceof SpaceArtwork ? artwork.item : artwork.spawn

            let { originalPosition, originalRotation } = item

            if(originalPosition == null) {

                    let res = idToCoords(artwork.userData.id)

                    originalPosition = res.position

                    originalRotation = toXYZ_(res.rotation)
            }


            const placeholder = this.restorePlaceholder(
                artwork.userData.placeholderId,
                originalPosition,
                originalRotation
            )

            return { placeholderMesh: placeholder }
        }  else {

            return { placeholderMesh: null }
        }
    }

    /**
     *
     * @param { string } placeholderId
     * @param { import('@gltypes').XYZ } position
     * @param { import('@uitypes/experience.js').Rotation } rotation
     * @returns
     */
    restorePlaceholder(placeholderId, position, rotation) {

        const placeholder = PlaceholderFactory.getPlaceholder(
            this.opts,
            placeholderId
        )

        placeholder.visible = this._editEnabled

        placeholder.position.set(position.x, position.y, position.z);

        placeholder.rotation.set(rotation._x, rotation._y, rotation._z);

        this.addPlaceholder(placeholder)

        return placeholder
    }


     /**
      * @typedef {object} EDITOR_CHANGE_TRANSFORM_MODE
      *  @property {EDIT_ACTIONS["EDITOR_CHANGE_TRANSFORM_MODE"]} type
      *  @property {import('@3constants').EDIT_TRANSFORM_MODE} mode
      *
      * @param { EDITOR_CHANGE_TRANSFORM_MODE } opts
      * */
    async handleChangeTransformMode({ mode }) {

       this.selector.changeTransformMode(mode)
    }

    /**
      * @typedef {object} EDITOR_CHANGE_TRANSFORM_CONTROLS
      *  @property {EDIT_ACTIONS["EDITOR_CHANGE_TRANSFORM_CONTROLS"]} type
      *  @property {import('@3constants').EDIT_TRANSFORM_CONTROL} mode
      *
      * @param { EDITOR_CHANGE_TRANSFORM_CONTROLS } opts
      * */
    async handleChangeTransformControls({ mode }) {

        return this.selector.changeTransformControls(mode)
    }

     /**
      * @typedef {object} EDITOR_CHANGE_ENVMAP
      *  @property {EDIT_ACTIONS["EDITOR_CHANGE_ENVMAP"]} type
      *  @property {string} artworkId
      *  @property {keyof (typeof ENVMAPS)} envmap
      *  @property {number} envmapIntensity
      *
      * @param { EDITOR_CHANGE_ENVMAP } opts
      * */
    async handleChangeEnvmap({ artworkId, envmap, envmapIntensity }) {
        /** @type { ModelSpaceArtwork } */
        // @ts-ignore
        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if (!(artwork instanceof ModelSpaceArtwork)) {

            throw new Error("Not a 3D model")
        }

        artwork.userData.envmap = envmap;
        artwork.userData.envmapIntensity = envmapIntensity;

        artwork.updateEnvMap()

        return {
            envmap,
            envmapIntensity
        }
    }

    /**
      * @typedef {object} EDITOR_SELECT_ANIMATION
      *  @property {EDIT_ACTIONS["EDITOR_SELECT_ANIMATION"]} type
      *  @property {string} artworkId
      *  @property { Record<string, unknown> } animations
      *
      * @param { EDITOR_SELECT_ANIMATION } opts
      * */
    async handleSelectAnimation({ artworkId, animations }) {

        /** @type { ModelSpaceArtwork } */
        // @ts-ignore
        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if (artwork.mediaType !== TYPES.MODEL) {

            throw new Error("Not an object")
        }

        /** @type { Record<string, { name: string }> } */
        const newAnimations = {}



        await artwork.prepareAnimations(animations)

        artwork.animations.forEach((animation) => {

            const name = animation.name

            if (animations[name]) {

                newAnimations[name] = { name }
            }

         
        })

        artwork.activeAnimations = { ...newAnimations }
        artwork.syncAnimations()
        artwork.mixer?.update(0)

        artwork.item = {
            ...artwork.item,
            animations: newAnimations
        }

        return newAnimations
    }

       /**
      * @typedef {object} EDITOR_CHANGE_COLLIDER
      *  @property {EDIT_ACTIONS["EDITOR_CHANGE_COLLIDER"]} type
      *  @property {string} artworkId
      *  @property {boolean} isCollider
      *
      * @param { EDITOR_CHANGE_COLLIDER } opts
      **/
    async handleChangeCollider({ artworkId, isCollider }) {
        // throw new Error("No yet implemented")
        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if (!artwork) throw new Error("No artwork")

        if(artwork.mediaType === TYPES.PLACEHOLDER) {

            throw new Error("Invalid artwork for borders")
        }

        artwork.userData = {
            ...artwork.userData,
            isCollider: isCollider,
        };

        if(!EDIT_MODE) {

            if(isCollider) {

                Camera.currentControls.world.collisions.addCollider(artwork);
            }
            else {

                Camera.currentControls.world.collisions.removeCollider(artwork);
            }
        }

        return {
            isCollider: isCollider,
        }
    }

    /**
      * @typedef {object} EDITOR_CHANGE_BORDER
      *  @property {EDIT_ACTIONS["EDITOR_CHANGE_BORDER"]} type
      *  @property {string} artworkId
      *  @property {string} color
      *
      * @param { EDITOR_CHANGE_BORDER } opts
      **/
    async handleChangeBorder({ artworkId, color }) {
        // throw new Error("No yet implemented")
        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if (!artwork) throw new Error("No artwork")

        if(artwork.mediaType === TYPES.PLACEHOLDER || artwork.mediaType === TYPES.MODEL) {

            throw new Error("Invalid artwork for borders")

        }

        artwork.borderColor = color;

        artwork.userData = {
            ...artwork.userData,
            borderColor: color,
            hasBorder: artwork.hasBorder,
        };

        return {
            borderColor: color,
            hasBorder: artwork.hasBorder,
        }
    }



    /**
     *  @typedef {object} EDITOR_CHANGE_AUDIO
     *  @property {EDIT_ACTIONS["EDITOR_CHANGE_AUDIO"]} type
     *  @property {string} artworkId
     *  @property { import('@3constants').AUDIO_TYPE } audioType
     *  @property {number} volume
     *
     * @param { EDITOR_CHANGE_AUDIO } opts
     *
     */
    async handleChangeAudio({ artworkId, audioType, volume }) {

        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if(!artwork.audioController) throw new Error("Not an audio artwork")

        let audioController = artwork.audioController

        const wasLookat = audioController.audioType  === AUDIO_TYPES.LOOKAT

        audioController.setAudioType(audioType)

        audioController.setVolume(volume)

        if (artwork === this.selectedArtwork) {

            if (audioType === AUDIO_TYPES.SPATIAL) {

                audioController.showVolumeRange()

            } else {

                audioController.hideVolumeRange()

                if(!wasLookat && artwork instanceof VideoSpaceArtwork && audioType === AUDIO_TYPES.LOOKAT) {

                    this.artworkContainer.localPlaying = artwork

                    artwork.emit(Events.LOCAL_PLAYING_CHANGED, { currentMedia: artwork, active: artwork.isLookedAt })

                }
            }
        }

        artwork.userData = {
            ...artwork.userData,
            audioType,
            volume: artwork.audioController.volume,
        }

        return { volume: audioController.volume, audioType }
    }


    /**
     *  @typedef {object} EDITOR_CHANGE_VIDEO
     *  @property {EDIT_ACTIONS["EDITOR_CHANGE_VIDEO_OPTS"]} type
     *  @property {string} artworkId
     *  @property { { videoPlayback: import('@gltypes').VideoPlaybackType } } opts
     *
     * @param { EDITOR_CHANGE_VIDEO } opts
     */
     async handleChangeVideoOpts({ artworkId, opts }) {

        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if(artwork.videoController == null) throw new Error("Not a video artwork")


        artwork.videoController.updatePlaybackOptions(opts)

        artwork.userData = {
            ...artwork.userData,
            ...opts
        }

        return opts
    }

     /**
      * @typedef {object} EDITOR_CHANGE_SIZE
      *  @property {EDIT_ACTIONS["EDITOR_CHANGE_SIZE"]} type
      *  @property {string} artworkId
      *  @property {number} uiSize
      *
      * @param { EDITOR_CHANGE_SIZE } opts
      **/
    async handleChangeSize({ artworkId, uiSize }) {

        if (isNaN(uiSize)) {
            return Promise.reject("Invalid size")
        }

        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if(artwork.mediaType === TYPES.PLACEHOLDER) {

            throw new Error("Not an artwork")
        }

        let scale = artwork.uiSizeToScale(uiSize)

        artwork.scale.x = scale

        artwork.scale.y = scale

        artwork.userData = {
            ...artwork.userData,
            scale,
        };

        return {
            scale,
            id: artwork.userData.id,
        }
    }

    /**
      * @typedef {object} EDITOR_TOGGLE_HTML
      *  @property {EDIT_ACTIONS["EDITOR_TOGGLE_HTML"]} type
      *  @property {string} artworkId
      *  @property {boolean} enableHTMLView
      *
      * @param { EDITOR_TOGGLE_HTML } opts
      **/
    async handleToggleHTM ({ artworkId, enableHTMLView }) {

        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if(artwork instanceof HTMLSpaceArtwork || artwork instanceof CSSHTMLSpaceArtwork) {

            artwork.toggleHTMLView(enableHTMLView)
        }
        else {

            throw new Error("Not an HTML artwork!")
        }


        artwork.userData = {
            ...artwork.userData,
            enableHTMLView,
        }

        return {
            id: artwork.userData.id,
            enableHTMLView,
        }
    }

    /**
      * @typedef {object} EDITOR_CHANGE_DIMENSIONS
      *  @property {EDIT_ACTIONS["EDITOR_CHANGE_DIMENSIONS"]} type
      *  @property {string} artworkId
      *  @property {[number, number]} dimensions
      *
      * @param { EDITOR_CHANGE_DIMENSIONS } opts
      **/
    async handleChangeDimensions ({ artworkId, dimensions }) {

        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if(artwork.mediaType !== TYPES.HTML_EMBED) {

            throw new Error("Not a website!")
        }

        artwork.userData.dimensions = dimensions

        CSSEmbedArtwork.updateDimensions(artwork, dimensions)

        return {
            id: artwork.userData.id,
            dimensions,
        }
    }

    /**
      * @typedef {object} EDITOR_TOGGLE_360
      *  @property {EDIT_ACTIONS["EDITOR_TOGGLE_360"]} type
      *  @property {string} artworkId
      *  @property {boolean} is360Active
      *
      * @param { EDITOR_TOGGLE_360 } opts
      **/
    async handleToggle360 ({ artworkId, is360Active }) {

        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if(artwork instanceof ImageSpaceArtwork || artwork instanceof PanoramaSpaceArtwork) {

            // artwork.toggleHTMLView(enableHTMLView)
        }
        else {

            throw new Error("Not an IMAGE artwork!")
        }


        artwork.userData = {
            ...artwork.userData,
            prev_mime_type: artwork.userData.mime_type,
            mime_type: is360Active ? 'panorama/jpg' : artwork.userData.prev_mime_type,
        }

        return {
            id: artwork.userData.id,
            prev_mime_type: artwork.userData.mime_type,
            mime_type: is360Active ? 'panorama/jpg' : artwork.userData.prev_mime_type,
        }
    }

    /**
      * @typedef {object} EDITOR_CHANGE_3D_SCALE
      *  @property {EDIT_ACTIONS["EDITOR_CHANGE_3D_SCALE"]} type
      *  @property {string} artworkId
      *  @property {number} uiSize
      *
      * @param { EDITOR_CHANGE_3D_SCALE } opts
      **/
    async handleChange3DObjectScale({ artworkId, uiSize }) {

        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === artworkId)

        if(artwork instanceof ModelSpaceArtwork) {

            let scale = artwork.uiSizeToScale(uiSize)

            artwork.scale.set(scale, scale, scale)
        }
        else {

            throw new Error("Not a 3D Model")
        }
    }

    /**
      * @typedef {{ id: string, position?: XYZ, rotation?: XYZ, scale?: XYZ }} ChangeTransformPayload
      *  
      * @typedef {object} EDITOR_CHANGE_TRANSFORM
      *  @property {EDIT_ACTIONS["EDITOR_CHANGE_TRANSFORM"]} type
      *  @property { ChangeTransformPayload[] } updates
      *  
      *
      * @param { EDITOR_CHANGE_TRANSFORM } opts
      **/
     async handleChangeTransform({ updates }) {

        let items = updates.map(it => {

            /** @type { SpaceComponent } */
            let item = this.getTarget(it.id)

            if(item == null) {

                item = this.kitbash.getComponentById(it.id)
            }
            if(item == null) {

                throw new Error("Can't find item  " + it.id)
            }

            return item
        })

        return items.map((it, i) => {

            const update = updates[i]

            if(update.position) {

                const pos = it.position
    
                pos.set(
                    this.toNum(update.position?.x) ?? pos.x,
                    this.toNum(update.position?.y) ?? pos.y,
                    this.toNum(update.position?.z) ?? pos.z,
                )
            }
    
            if(update.rotation) {
    
                const rot = it.rotation
    
                rot.set(
                    this.toNum(update.rotation.x) ?? rot.x,
                    this.toNum(update.rotation.y) ?? rot.y,
                    this.toNum(update.rotation.z) ?? rot.z,
                )
    
            }
    
            if(update.scale) {
    
                const is3D = it instanceof ModelSpaceArtwork
    
                const scale = it.scale
    
                const zScale = is3D ? this.toNum(update.scale.z) : scale.z
    
                scale.set(
                    this.toNum(update.scale.x) ?? scale.x,
                    this.toNum(update.scale.y) ?? scale.y,
                    zScale,
                )
    
            }
    
            it.updateMatrixWorld()

            // @ts-ignore
            it.updateCoords?.()

            return {
                position: toXYZ(it.position),
                rotation: toXYZ(it.rotation),
                scale: toXYZ(it.scale),
                id: update.id
            }
        })

    }

    /**
      * @typedef {object} EDITOR_UPDATE_MODEL_MEDIA
      *  @property {EDIT_ACTIONS["EDITOR_UPDATE_MODEL_MEDIA"]} type
      *  @property {string} artworkId
      *  @property {import('@uitypes/Asset').Asset["dcompressed_animation_url"]} dcompressed_animation_url
      *  @property {import('@uitypes/Asset').Asset["d_optimized_files"]} d_optimized_files
      *
      * @param { EDITOR_UPDATE_MODEL_MEDIA } opts
      **/
    async handleUpdateModelMedia(opts) {

        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === opts.artworkId)

        if (artwork == null || !(artwork instanceof ModelSpaceArtwork)) return

        artwork.userData.dcompressed_animation_url = opts.dcompressed_animation_url,
        
        artwork.userData.d_optimized_files =  opts.d_optimized_files

        return artwork.load()
    }

    /**
      * @typedef {object} EDITOR_UPDATE_ARTWORK_MEDIA
      *  @property {EDIT_ACTIONS["EDITOR_UPDATE_ARTWORK_MEDIA"]} type
      *  @property {string} artworkId
      *  @property {import('@uitypes/mediaInfo').UploadableMediaInfo} mediaInfo
      *  @property {import('@uitypes/mediaInfo').UploadableMediaInfo} [coverMediaInfo]
      *
      * @param { EDITOR_UPDATE_ARTWORK_MEDIA } opts
      **/
    async handleUpdateArtworkMedia(opts) {

        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === opts.artworkId)

        if (artwork == null) return

        const index = this.artworkContainer.artworks.indexOf(artwork)


        /** @type { import('@uitypes/mediaInfo').UploadableMediaInfo } */
        let mediaInfo;

        /** @type { SpaceArtwork } */
        let _artwork = artwork;

        if(opts.coverMediaInfo != null) {

            if (artwork instanceof AudioSpaceArtwork) {

                _artwork = artwork.coverImage

                artwork.raycastMesh = _artwork.raycastMesh
            }

            mediaInfo = opts.coverMediaInfo;
        }
        else {

            mediaInfo = opts.mediaInfo
        }

        const mesh = _artwork.mesh

        if(mesh instanceof LODMesh) {

            this.updateArtworkMesh(mesh, mediaInfo, _artwork.opts)
        }

        this.artworkContainer.raycastMeshes[index] = artwork.raycastMesh
    }

      /**
     *
     * @param { LODMesh } lodMesh
     * @param { import("@uitypes/mediaInfo").UploadableMediaInfo  } mediaInfo
     * @param { import('@gltypes').ArtworkOptions } opts
     */
    async updateArtworkMesh (
        lodMesh,
        mediaInfo,
        opts
    ) {
        let mediaType = getMediaType(mediaInfo.mime_type)

        if(mediaType === IMAGE_MEDIA || mediaType === VIDEO_MEDIA || mediaType === PANORAMA_MEDIA) {

            lodMesh.updateMedia(mediaInfo.url, mediaType, opts)
        }
    };


    /**
      * @typedef {object} REPLACE_HTML_PREVIEW_TEXTURE
      *  @property {EDIT_ACTIONS["REPLACE_HTML_PREVIEW_TEXTURE"] } type
      *  @property {string} artworkId
      *  @property {ArtworkData} asset
      *
      * @param { REPLACE_HTML_PREVIEW_TEXTURE } opts
      **/
    async handleReplaceHtmlPreviewTexture(opts) {
        const artwork = this.artworkContainer.artworks.find((obj) => obj.userData.id === opts.artworkId)

        if (artwork == null) return

        if (artwork instanceof HTMLSpaceArtwork  || artwork instanceof CSSHTMLSpaceArtwork) {

            const newArtwork = await ArtworkFactory.loadAsset({ ...this.opts, item: opts.asset })

            if (newArtwork.mediaType === "MODEL") {

                ArtworkFactory.mixers.push(newArtwork.animationMixer);
            }

            this.artworkContainer.removeArtwork(artwork)

            this.artworkContainer.addArtwork(newArtwork)

            return opts.asset
        }
    }

    /**
     *
     * @param { Portal } portal
     * @param { string } exhibitId
     * @param { string } coords
     * @param { boolean } [force]
     * @returns
     */
    async setPortalExhibit(portal, exhibitId, coords, force = false) {

        console.log("handleSetPortal/loadPortalData ...")

        let portalData = await PortalFactory.loadPortalData(exhibitId)

        if (portalData == null) throw new Error("Exhibit not found!");

        portalData.roomParameters = overrideInitialCoords(portalData.roomParameters, coords)

        console.log("handleSetPortal/loadPortalData  -> SUCCESS", portalData)


        let result = {
            heroImg: null,
            heroImg360: null
        }

        const info = portalData.exhibit.info

        // if(info?.cHeroImg == null || info?.cHeroImg360 == null) {

        console.log("handleSetPortal/takeScreenshot ...")

        let { heroImg, heroImg360 } = await portal.takeScreenshot(portalData, true, true);

        if(heroImg != null) {
            portalData.exhibit.info.cHeroImg = heroImg
        }

        if(heroImg360 != null) {
            portalData.exhibit.info.cHeroImg360 = heroImg360
            portal.opts.cHeroImg360 = heroImg360
        }

        console.log("handleSetPortal/takeScreenshot -> SUCCESS")

        result = { heroImg, heroImg360 }

        // }

        await portal.setPortalData(portalData, { ...result, exhibitId }, force)

        console.log("handleSetPortal/all set")

        return result
    }

    /**
     *
     * @param { Portal } portal
     * @param { import('@uitypes/experience.js').PortalData["spawn"]["shape"] } shape
     */
    async setPortalShape(portal, shape) {

        const spawn = {
            ...portal.spawn,
            shape
        }

        const oldMesh = portal.previewMesh

        const newMesh = PortalFactory.createPortalPreviewMesh({
            ...this.opts,
            spawn
        })

        await portal.setPreviewMesh(newMesh)

        this.portalContainer.replaceRaycastMesh(oldMesh, newMesh)

        return { spawn }

    }



    /**
      * @typedef {object} EDITOR_DELETE_PORTAL
      *  @property {EDIT_ACTIONS["EDITOR_DELETE_PORTAL"]} type
      *  @property {string} portalId
      *  @property {boolean} [realtime]
      *
      * @param { EDITOR_DELETE_PORTAL } opts
      **/
    async handleDeletePortal({ portalId, realtime = false }) {

        let portal = this.portalContainer.portals.find(
            (it) => it.placeholderData.portalId === portalId
        )



        if(portal?.spawn) {

            // @ts-ignore
            return this.handleDeleteArtwork({ artworkId: portalId })
        } else {

            await portal.removePortalData()
        }
    }



    // onMirror( val ){

    //     this.snapControls.setVisible( !val )

    // }
    //#endregion


    dispose() {

        this.selector.dispose()
    }
}
