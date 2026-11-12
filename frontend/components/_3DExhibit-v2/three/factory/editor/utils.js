
// @ts-check

import Camera from '@3camera'

import { ARTWORK_VERSION, AUDIO_TYPES, CURRENT_SPACE } from '@3constants';

import { MeshBasicMaterial } from 'three';

import { getMediaType } from '../../utils/mediatype';

import { getDefaultAssetPosition, getDefaultAssetRotation, idToCoords } from '@3utils/spaceutils'

import { toXYZ, toXYZ_ } from '@3utils/three';

import { SpaceArtwork } from '@3artwork/abstract';

import { SpacePlaceholder } from '@3artwork/placeholders/spaceplaceholder';

import { Portal } from '@3portal/portal';

import { coordsToId } from '@utils/metadata/formatExhibit';
import { PORTAL_SHAPES } from '../portal/previewmesh';
import { ModelSpaceArtwork } from '../artwork/meshes/model/modelspaceartwork';

/**
 * @typedef { object } EditorDragData
 * @property { string } previewUrl
 * @property { string } mime_type
 * @property { boolean } permissionless
 * @property { any } [asset]
 * @property { boolean } [is2D]
 * @property { boolean } [isAvatar]
 * @property { boolean } [isFileSystem]
 * @property { boolean } [preloadAsset]
 * @property { HTMLImageElement } [previewImg]
 * @property { import('@3constants').DRAG_MIME_TYPES } mime
 * @property { string } assetMedia
 */


let blankCanvas = null

export function getEmptyDragPreview() {

    if (blankCanvas == null) {

        blankCanvas = document.createElement("canvas");

        blankCanvas.style.position = "absolute";
        blankCanvas.style.width = "1px";
        blankCanvas.style.height = "1px";

        document.body?.appendChild(blankCanvas);
    }

    return blankCanvas

}


export const EditorEvents = {

    DRAG_ENTER: "dragsate_drag_enter",

    DRAG_END: "dragstate_drag_end"
}

export const occlusionMaterial = new MeshBasicMaterial({ color: 0x000000 })

/**
 * @param { SpacePlaceholder | SpaceArtwork | Portal } target
 * @param { boolean } keepPlaceholder
 * @param { { position?: import('@uitypes/experience.js').Position, rotation?: import('@uitypes/experience.js').Rotation } } [props]
 */
function getTargetProps(target, keepPlaceholder, props) {

    const position = toXYZ(target?.position ?? props?.position ?? getDefaultAssetPosition(Camera.current, 4.6))

    const rotation = toXYZ_(target?.rotation  ?? props?.rotation ?? getDefaultAssetRotation(Camera.current))

    let originalPosition = position
    
    let originalRotation = rotation
    
    let id, placeholderId


    const uid = keepPlaceholder || target == null ? `f${String(Date.now())}` : null

    const uidSuffix = uid ? `@${uid}` : ""

    if (target == null) {

        const { _x,x, _y,y, _z,z } = rotation

        const dummyTarget = { position, rotation: { x: _x??x, y: _y??y, z: _z??z } }    

        id = coordsToId(dummyTarget, uid, CURRENT_SPACE.exhibit)
    }
    else if (target instanceof SpacePlaceholder) {

        id = coordsToId(target, uid, CURRENT_SPACE.exhibit)

        placeholderId = target.placeholderId

        if(target.face === 1) {

            rotation._y += Math.PI;
        }
    }
    else if(target instanceof SpaceArtwork) {

        originalPosition = target.item.originalPosition

        originalRotation = target.item.originalRotation

        id = target.item.data.id + uidSuffix

        placeholderId = target.item.data.placeholderId
    }
    else {

        originalPosition = target.spawn.originalPosition

        originalRotation = target.spawn.originalRotation

        id = target.spawn.portalId + uidSuffix

        placeholderId = target.spawn.placeholderId
    }

    if (keepPlaceholder) {

        id += String(Date.now())
    }

    return { 
        id,
        placeholderId : keepPlaceholder || target == null ? null : placeholderId,
        position,
        rotation,
        originalPosition, 
        originalRotation
    }
}

/**
 *
 * @param {SpacePlaceholder | SpaceArtwork | Portal} target
 * @param {import('@uitypes/Asset').FetchedAsset} asset
 * @param {string} _placeholderId
 * @param {boolean} keepPlaceholder
 * @param {Partial<import('./selector').ArtworkData>} [artworkDataProps]
 */
export function getArtworkData(target, asset, _placeholderId, keepPlaceholder, artworkDataProps ) {

    const { 
        id, 
        placeholderId, 
        position, rotation, 
        originalPosition, originalRotation
    } = getTargetProps(target, keepPlaceholder, artworkDataProps)
    
    /** @type { import('@uitypes/experience.js').ArtworkData } */
    let artworkData = {
        version: ARTWORK_VERSION,
        data: {
            ...asset,
            id,
            placeholderId,
            addedBy: asset.addedBy || "",
        },
        position,
        rotation,
        originalPosition,
        originalRotation,
        addedBy: asset.addedBy || "",
        ...artworkDataProps
    }

    // mime_type: text
    const media = getMediaType( artworkData.data.mime_type)

    if (media === "MODEL_MEDIA") {

        // artworkData.scale = { x: 1, y: 1, z: 1 }

        // if (target instanceof ModelSpaceArtwork) {

        //     artworkData.scale = {
        //         x: target.scale.x,
        //         y: target.scale.y,
        //         z: target.scale.z
        //     }
        // }

        artworkData.envmap = "scene"
        
        artworkData.envmapIntensity = 1
    }
    else if(media === "AUDIO_MEDIA") {

        artworkData.audioType = AUDIO_TYPES.SPATIAL
        
        artworkData.volume = 2
    }
    else if(media === "VIDEO_MEDIA" || media === "EMBED_YOUTUBE_MEDIA") {
        
        artworkData.audioType = AUDIO_TYPES.LOOKAT
    }

    return artworkData
}


/**
 *
 * @param {SpacePlaceholder | SpaceArtwork | Portal} target
 * @param {*} keepPlaceholder
 * @param {Partial<import('@uitypes/experience.js').PortalData["spawn"]>} [portalDataProps]
 * @returns
 */
export function getPortalSpawnData(target, keepPlaceholder, portalDataProps) {

    const { 
        id, placeholderId, 
        position, rotation, 
        originalPosition, originalRotation
    } = getTargetProps(target, keepPlaceholder, portalDataProps)

    return {
        shape: PORTAL_SHAPES.RECTANGLE,
        portalId: id,
        placeholderId,
        position,
        rotation,
        scale : { x: 1, y: 1, z: 1 },
        originalPosition,
        originalRotation,
    }
}