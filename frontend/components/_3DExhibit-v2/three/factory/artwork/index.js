// @ts-check
import { waitForArtworkPresentation } from "@utils/artworkPresentation";

import Events from '@3events'

import Emitter from "@3emitter"

import { AUDIO_TYPES, CURRENT_SPACE, EDIT_MODE, GLOBAL_TEXT_SCALE, LOADER_STATS, GPU_TIER } from "@3constants"

import {
    getMediaType,
    AUDIO_MEDIA,
    HTML_MEDIA,
    IMAGE_MEDIA,
    MODEL_MEDIA,
    VIDEO_MEDIA,
    EMBED_HTML_MEDIA,
    EMBED_YOUTUBE_MEDIA,
    TEXT_MEDIA,
    PANORAMA_MEDIA,
    GLOBAL_STREAM_MEDIA,
    TRIGGER_ZONE_MEDIA
}
from "@3utils/mediatype"

import ImageArtwork from '@3artwork/meshes/image'
import PanoramaArtwork from '@3artwork/meshes/panorama'
import VideoArtwork from '@3artwork/meshes/video'
import AudioArtwork from '@3artwork/meshes/audio'
import ModelArtwork from '@3artwork/meshes/model'
import HTMLArtwork from '@3artwork/meshes/html'
import CSSHTMLEmbed from '@3artwork/meshes/css'
import TextArtwork from '@3artwork/meshes/text'
import YoutubeArtwork from '@3artwork/meshes/youtube'
import TriggerZoneArtwork from '@3artwork/meshes/triggerzone'
import GlobalStreamArtwork from '@3artwork/meshes/globalstream'

import ArtworkLoader from '@3artwork/loader'

import { SpaceArtwork } from './abstract'

import Augmented from '@3abstract/augmented'

import { ArtworkContainer } from './artworkcontainer'

import { Euler, Frustum, Vector3, PerspectiveCamera, Matrix4 } from "three"

import {  noop } from '@utils/js'


import reformatAsset from '@utils/metadata/reformatAsset'

import LoaderStats from '@3utils/loaderstats'

import { cloudinary, resize } from '@utils/urlUtils'

import { MAX_LOAD_TENTATIVES } from './constants'

import { SpaceArtworkLoaderMesh } from './loader/spaceartworkloadermesh'

import { nodeEnv } from '@env'

import { CSSEmbedArtwork } from './meshes/css/CSSembedartwork'

import { runArtworkTasks } from "@utils/media/tasks"
import { createArtworkPlaceholders } from "@utils/media/artworkPlaceholders"
import { recoverArtworkMedia } from "@utils/media/recoverArtwork"

import { CHECK_ABORT_SIGNAL, IS_ABORT_ERROR, combineAbortSignals } from '../../utils/abort'

import { SPACE_EVENTS } from '../space/space'
import { getCoordsFromObject } from '../../utils/three'
import Camera from '@3camera'
import Root from '../../root'
import Players from '../player'


const defaultRoomOptions = {
    artworkScale: 15,
}


class ArtworkFactory extends Augmented {

    constructor(){

        super()
    }

    /**
     * @param { import('@gltypes').ItemFactoryOptions } opts
     * @returns { ArtworkContainer }
     */
	get(opts){

        const self = this

        /** @type { ArtworkContainer } */
        let container = opts.space.artworkContainer


        // We need a reference to the mixers
        this.mixers = opts.mixers;

        opts.roomParameters = { ...defaultRoomOptions, ...opts.roomParameters }

        if(container == null) {

            container = new ArtworkContainer(opts)

            opts.space.artworkContainer = container
        }


        const items =  Object.values(opts.exhibit.artworks || {}).filter(item => {

            if (!item?.data || !item.position) return false

            const artworkPosition = new Vector3(
                +item.position.x,
                +item.position.y,
                +item.position.z
            )

            const cameraPosition = new Vector3(
                opts.roomParameters.initialPlayerPosition?.x || 0,
                opts.roomParameters.initialPlayerPosition?.y || 0,
                opts.roomParameters.initialPlayerPosition?.z || 0
            )

		    const distance =  artworkPosition.distanceTo(cameraPosition)

            item.distanceToCamera = distance;

            if(item.data?.mime_type === "cyber/text") {
                //
                return EDIT_MODE || item.data.text
            } else if (item.data?.mime_type === "cyber/triggerzone" ) {

                return item.data.type;
            } else if (item.data?.mime_type === "cyber/globalstream") {

                return item.data.url;
            }

            return item?.data?.token_id || item?.data?.customData?.autographId || item?.data?.id
            //
        }).sort((a, b) => {
            return a.distanceToCamera - b.distanceToCamera
        })

        // show loader screens
        let loadersGroup = container.loadersGroup

        let abortController = new AbortController()

        const fireAbortSignal = () => {

            abortController.abort("Space disposed")
        }

        opts.space.scene.once(SPACE_EVENTS.DISPOSE, fireAbortSignal)


        // Fill every authored position immediately, before queued metadata,
        // posters or videos can delay it. Preview assets already own a surface.
        const placeholders = createArtworkPlaceholders(items, {
            create: item => container.getArtworkById(item.data.id) ? null : ArtworkLoader.get({
                ...opts, maxTentatives: MAX_LOAD_TENTATIVES, item,
                abort: abortController.signal,
            }),
            attach: loader => loadersGroup.add(loader),
            dispose: loader => { loadersGroup.remove(loader); loader.dispose() },
            signal: abortController.signal,
            onError: (error, item) => console.warn("Artwork placeholder skipped", item?.data?.id, error),
        })

        void runArtworkTasks(items, async (item, attempt, attemptSignal) => {

            const sourceItem = item
            const loader = placeholders.get(sourceItem)
            const releaseLoader = () => placeholders.release(sourceItem)
            const loadSignal = combineAbortSignals([abortController.signal, attemptSignal])

            if (attempt > 0) await recoverArtworkMedia(item.data, true)
            CHECK_ABORT_SIGNAL(loadSignal)

            // We don't need a loader if we aleady have a preview asset
            // that was loaded in a portal preview
            // if something needs to be formatted for each asset

            item = await reformatAsset(opts.exhibit, {
                ...item,
                data: item.data
            });

            CHECK_ABORT_SIGNAL(loadSignal)

            const preview = container.getArtworkById(item.data.id)

            await loadAsset(item, preview, loadSignal, loader, attempt, releaseLoader)
        }, {
            attempts: MAX_LOAD_TENTATIVES,
            initialTimeout: 10000,
            retryTimeout: 30000,
            concurrency: GPU_TIER.path === "low" ? 2 : 4,
            signal: abortController.signal,
            onError: (error, item) => {
                placeholders.release(item)
                console.warn("Artwork skipped", item?.data?.id, error)
            }
        });


        return container

        /**
         *
         * @param { import('@uitypes/experience').ArtworkData } item
         * @param { SpaceArtwork } preview
         * @param { AbortSignal } abort
         * @param { SpaceArtworkLoaderMesh } [loader]
         */
        async function loadAsset(item, preview, abort, loader, attempt = 0, releaseLoader = noop) {

            let artwork
            let attached = false
            try {

                loader?.loader.start()

                await waitForArtworkPresentation(abort)
                CHECK_ABORT_SIGNAL(abort)
                artwork = await self.loadAsset({
                    ...opts,
                    item,
                    preview,
                    abort
                })

                // samsy
                // samsy
                // samsy
                // samsy

                // await new Promise(( resolve )=>{

                //     setTimeout(()=>{

                //         resolve()

                //     }, 10000000)
                // })


                CHECK_ABORT_SIGNAL(abort)

                await waitForArtworkPresentation(abort)
                CHECK_ABORT_SIGNAL(abort)
                loader?.loader.success()

                releaseLoader()

                if(container.wasDisposed) {

                    artwork.dispose()

                    return
                }

                container.addArtwork(artwork)
                attached = true

                if(artwork.cssWrapper) {

                    if (!(artwork instanceof CSSEmbedArtwork && artwork.isPreviewMode)) {

                        artwork.cssWrapper.add()
                    }
                }

                if(artwork.animationMixer != null) {

                    opts.mixers.push(artwork.animationMixer)
                }


                if (item?.data?.visible === false) {
                    container.visible = false;
                }

                self.emit(Events.ARTWORK_LOADED, artwork)

                Emitter.emit(Events.CUSTOM, {

                    type: Events.ARTWORK_LOADED,

                    value: { artwork }
                })
            }
            catch(err) {

                if(IS_ABORT_ERROR(err) || abort?.aborted || container.wasDisposed) {

                    // A decoder may resolve after its attempt timed out. Never
                    // leave its unattached textures/video listeners behind.
                    if(artwork && !attached && artwork !== preview) artwork.dispose()
                    if(abortController.signal.aborted || container.wasDisposed) releaseLoader()

                    console.info("load asset cancelled ", item.data.name)

                    return
                }

                console.error("[loadAsset] Error while loading artwork", item, err);

                loader?.loader.error(err)

                // Keep the local placeholder while the bounded queue retries.
                // The final-error callback or scene disposal releases it.
                if (attempt + 1 >= MAX_LOAD_TENTATIVES) {
                    if(EDIT_MODE && item.data.placeholderId && Root.editor) {

                        const placeholder = Root.editor.restorePlaceholder(
                            item.data.placeholderId,
                            item.originalPosition,
                            item.originalRotation
                        )

                        placeholder?.setError(true)
                    }
                }
                throw err
            }
            finally {

                if(loader && LOADER_STATS) {

                    LoaderStats.update()
                }
            }
        }

	}

    /**
     * @param { import('@uitypes/gl').ArtworkOptions } opts
     * @returns { Promise<SpaceArtwork> }
     */
    async loadAsset( opts ) {

        let data = {
            ...opts.item.data,
            curatorNotes: opts.item.curatorNotes || "",
            lock: opts.item.lock || {}
        }

        let item = {
            ...opts.item,
            data
        }


        let mediaType = getMediaType( item.data.mime_type);

        let artwork;

        opts = {
            ...opts,
            item
        }

        if(mediaType === IMAGE_MEDIA) {

            artwork = await ImageArtwork.get(opts);
        }
        else if(mediaType === PANORAMA_MEDIA) {

            artwork = await PanoramaArtwork.get(opts);
        }
        else if (mediaType === VIDEO_MEDIA) {

            data.volume = item.volume || 1

            data.audioType = item.audioType

            data.videoPlayback = item.videoPlayback

            artwork = await VideoArtwork.get(opts);
        }
        else if (mediaType === AUDIO_MEDIA) {

            data.volume = item.volume || 1

            data.audioType = item.audioType

            artwork = await AudioArtwork.get(opts)
        }
        else if (mediaType === MODEL_MEDIA) {

            data.animations = item.animations || {}

            artwork = await ModelArtwork.get(opts)

        } else if (mediaType === TEXT_MEDIA) {

            const textOpts = item.data

            textOpts.font = textOpts.font || "aeonik-bold"
            textOpts.textTransform = textOpts.textTransform || "none"
            textOpts.textColor = textOpts.textColor || [1,1,1]
            textOpts.align = textOpts.align || 'left'
            textOpts.lineHeight = textOpts.lineHeight || 60
            textOpts.width = textOpts.width || 500

            artwork = await TextArtwork.get({
                ...textOpts,
                scale: GLOBAL_TEXT_SCALE * 20,
                color: textOpts.textColor,
                ...opts
            } );
        }

        else if (mediaType === HTML_MEDIA) {

            if(item.overwrite && getMediaType(item.overwrite.mediaType) === VIDEO_MEDIA) {

                artwork = await VideoArtwork.get({
                    ...opts,
                    overrideUrl: item.overwrite.url,
                    overrideMime: item.overwrite.mediaType
                })
            }
            else {

                artwork = await HTMLArtwork.get(opts)

            }
        }

        else if (mediaType === EMBED_HTML_MEDIA) {

            artwork = await CSSHTMLEmbed.get(opts)
        }

        else if (mediaType === EMBED_YOUTUBE_MEDIA) {

            data.volume = item.volume || 1

            data.audioType = item.audioType

            data.videoPlayback = item.videoPlayback

            artwork = await YoutubeArtwork.get(opts)
        }

        else if ( mediaType === GLOBAL_STREAM_MEDIA ) {

            artwork = await GlobalStreamArtwork.get(opts)
        }

        else if ( mediaType === TRIGGER_ZONE_MEDIA ) {

            artwork = await TriggerZoneArtwork.get(opts)
        }


        // Check before collider registration or other scene mutations: a timed
        // out decoder can finish while a retry or another space is active.
        if(opts.abort?.aborted) {
            if(artwork !== opts.preview) artwork?.dispose()
            CHECK_ABORT_SIGNAL(opts.abort)
        }

        artwork.setCoordinates( item )

        artwork.lock(item.lock || {})

        // Fix for a weird bug that happens when we teleport in 6529world
        // raycaster is invoked while raycast mesh hasn't yet updated its matrix world
        artwork.updateWorldMatrix(false, true)

        // get border

        if (artwork.userData.isCollider) {

            if (!EDIT_MODE) {

                Camera.currentControls.world.collisions.addCollider(artwork);
            }
        }

        return artwork

    }


    _projScreenMatrix = new Matrix4()

    /**
     *
     * @param { import("@gltypes").SpaceStateOptions } opts
     * @param {  PerspectiveCamera } camera
     * @param {  (x: any) => void } [onLoad]
     * @returns { ArtworkContainer }
     */
    loadPreviewAssets(opts, camera, onLoad = noop) {

        let { exhibit, roomParameters } = opts

        roomParameters = { ...defaultRoomOptions, ...roomParameters }

        const container = new ArtworkContainer(opts)

        opts.space.artworkContainer = container

        let items = Object.values(exhibit.artworks || {}).filter((item) => {

            let mediaType = getMediaType(item.data.mime_type)

            return item.data.token_id && mediaType !== MODEL_MEDIA;
        })

        camera.updateMatrixWorld()

        camera.updateProjectionMatrix()

        this._projScreenMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        )

        let frutsum = new Frustum().setFromProjectionMatrix(
            this._projScreenMatrix
        )

        let artworkPositiion = new Vector3();


        Promise.all(
            items.map(async (item) => {

                // console.log("Loading preview asset ", item.data.name)

                item = await reformatAsset(opts.exhibit, {
                    ...item,
                    data: item.data
                });

                const { position, rotation } = item;

                artworkPositiion
                    .applyEuler(
                        new Euler(rotation._x, rotation._y, rotation._z)
                    )
                    .set(position.x, position.y, position.z);

                if (!frutsum.containsPoint(artworkPositiion)) return;


                let mediaType = getMediaType( item.data.mime_type);

                /** @type { string } */
                let url;

                if(mediaType === IMAGE_MEDIA || mediaType === AUDIO_MEDIA || mediaType === HTML_MEDIA ) {

                    url = item.data.dcompressed_image_url || item.data.image_preview_url
                }
                else if(mediaType === VIDEO_MEDIA) {

                    url = item.data.dcompressed_animation_url || item.data.image_preview_url
                }
                else if(mediaType === EMBED_YOUTUBE_MEDIA) {

                    url = nodeEnv.POLAR_SAMA + item.data.image_preview_url
                }

                // No preview for Models, Texts and CSS embeds
                if(url == null) return

                url = resize(url, 300)

                url = cloudinary.asImage(url)

                try {
                    const artwork = await ImageArtwork.get({
                        ...opts,
                        item,
                        overrideUrl: url,
                    }, true)

                    if(opts.abort?.aborted) return

                    artwork.name = "preview";

                    artwork.position.set(position.x , position.y , position.z);

                    artwork.rotation.set(rotation._x, rotation._y, rotation._z);

                    container.addArtwork(artwork);

                    // console.log("Success Loaded preview asset ", item.data.name)
                } catch(err) {
                    console.error(err)
                    console.error("Failed to load asset preview for ", item.data)
                }
            })
        ).then(onLoad)

        return container
    }




}

export default new ArtworkFactory()
