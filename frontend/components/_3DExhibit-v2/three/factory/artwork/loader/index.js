

// @ts-check

import { MeshBasicMaterial, BoxGeometry, Mesh } from 'three'

import { getMediaType, MODEL_MEDIA, AUDIO_MEDIA } from '@3utils/mediatype'

import { SpaceArtworkLoaderMesh } from './spaceartworkloadermesh'


import LoaderMaterial from './material/index.js'

import { defaultPlaceholderSize } from '../placeholders'

import LogoJson from './logo.json'
import { GET_SINGLE_DISPLAY_EXPERIENCE } from '@utils/partnerships/singledisplay'

class ArtworkLoader {

    /**
     * @param { import('@uitypes/gl').ArtworkOptions & { maxTentatives: number } } opts
     */
     get(opts) {

        const artworkData = opts.item.data

        const artworkDefaultSize = artworkData.size || 200

        const artworkScale = opts.roomParameters.artworkScale

        let mediaType = getMediaType( artworkData.mime_type);

        const showLoader =
            mediaType !== MODEL_MEDIA
            && (mediaType !== AUDIO_MEDIA || artworkData.image_url)

        if (!showLoader) return null

        let [width, height] = artworkData?.dimensions ||
            artworkData?.videoDimensions || [
                artworkDefaultSize,
                artworkDefaultSize,
            ]

        if (artworkData.metric === "inch") {
            width *= 2.54;
            height *= 2.54;
        }

        let artworkWidth = Number((width / artworkScale).toFixed(2))

        let artworkHeight = Number((height / artworkScale).toFixed(2))

        const singledisplay = GET_SINGLE_DISPLAY_EXPERIENCE({
            slug: opts.roomParameters.slug,
        });

        if (singledisplay) {

            artworkWidth = ((artworkWidth * singledisplay.max_height) / artworkHeight);

            artworkHeight = singledisplay.max_height;
        }

        const ratio =
            LogoJson.frames[0].sourceSize.w / LogoJson.frames[0].sourceSize.h;


        const material = new LoaderMaterial({width: artworkWidth, height: artworkHeight, ratio: ratio})

        const geometry = new BoxGeometry(
            artworkWidth,
            artworkHeight,
            opts.roomParameters.placeholderSize?.[2] || defaultPlaceholderSize[2]
        )

        let loader = new SpaceArtworkLoaderMesh({
            ...opts,
            geometry,
            material
        }, LogoJson)

        // loader.play()

        if(artworkData?.dimensions || artworkData?.videoDimensions) {

            loader.scale.x = artworkData?.scale || 1

            loader.scale.y = artworkData?.scale || 1
        }



        const { position, rotation } = opts.item

        loader.position.set(+position?.x, +position?.y, +position?.z)

        loader.rotation.set(+rotation?._x, +rotation?._y, +rotation?._z)

        loader.name = "loader"

        return loader
    }


    getMaterial(width, height) {

        return new LoaderMaterial({width, height})

    }
}


export default new ArtworkLoader()
