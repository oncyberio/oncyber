// @ts-check


import { DEFAULTS, TYPES } from "@3artwork/constants"


import { CSSWrapper } from "../css/CSSwrapper"

import { YouTubeSpaceArtwork } from "./youtubespaceartwork"

import { artworkDepth } from "@3utils/spaceutils"

import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants"

import { CHECK_ABORT_SIGNAL } from "@3utils/abort"



const YOUTUBE_ASPECT_RATIO = 0.56

/** @type { { type: "Idle" } | { type: "Started", ready: Promise<null> } } */
let apiState = { type: "Idle" }

function initYoutubeAPI() {

    return  new Promise((resolve) => {

        const tag = document.createElement("script")

        tag.id = "iframe-youtube"

        tag.src = "https://www.youtube.com/iframe_api"

        const firstScriptTag = document.getElementsByTagName("script")[0]

        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)

        // @ts-ignore
        window.onYouTubeIframeAPIReady =
            function onYouTubeIframeAPIReady() {
                console.log("Youtube ready")

                resolve(null)
            }
    })
}


class YoutubeArtwork {

    /**
     *
     * @param { import("@gltypes").ArtworkOptions } opts
     * @returns
     */
    async get(opts) {

        const asset = opts.item.data

        let artworkData = opts.item.data;

        let assetSize = DEFAULTS.MAX_SIZE

        let dimensions = asset.dimensions || [assetSize / YOUTUBE_ASPECT_RATIO , assetSize]

        let [width, height] = dimensions

        const scaleDown = opts.roomParameters?.artworkScale || DEFAULTS.ARTWORK_SCALE


        let artworkWidth = width / scaleDown

        let artworkHeight = height / scaleDown

        let depth = artworkDepth(opts.roomParameters)

        const div = document.createElement("div")

        // Gallery data is untrusted: only a plain video id and a number may
        // reach the embed markup below.
        const rawId = String(asset.animation_url ?? "")

        const videoId = /^[A-Za-z0-9_-]{1,64}$/.test(rawId) ? rawId : ""

        const time = Math.max(0, Math.floor(Number(asset.params?.time) || 0))

        const controls = IS_MOBILE || artworkData.YTUserControls ? 0 : 1

        const embedCode = `<iframe
                style="width: 100%; height: 100%"
                src="https://www.youtube.com/embed/${videoId}?start=${time}&autoplay=0&mute=1&playsinline=1&enablejsapi=1&rel=0&playlist=${videoId}&loop=1&controls=${controls}&fs=0&modestbranding=1"
                title="YouTube video player"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>`

        div.innerHTML = embedCode;

        if(apiState.type === "Idle") {

            const ready = initYoutubeAPI()

            apiState = { type: "Started", ready }
        }

        await apiState.ready

        CHECK_ABORT_SIGNAL(opts.abort)


        const cssWrapper = new CSSWrapper(
            // @ts-ignore
            div,
            artworkWidth,
            artworkHeight
        )

        const userData = {
            ...asset,
            artworkWidth,
            artworkHeight,
            dimensions: asset?.dimensions || dimensions,
        }

        cssWrapper.glPlane.userData = { ...userData }

        cssWrapper.glPlane.position.z = depth * 0.50 + 0.01;

        const youtubeArtwork = new YouTubeSpaceArtwork(
            {
                ...opts,
                cssWrapper,
                type: TYPES.YOUTUBE_EMBED,
                raycastMesh: cssWrapper.glPlane,
                resources: [cssWrapper]
            }
        )

       youtubeArtwork.setBorder()

        youtubeArtwork.userData = { ...userData }

        // scale down artworkGroup here
        youtubeArtwork.scale.x = asset?.scale || 1

        youtubeArtwork.scale.y = asset?.scale || 1

        youtubeArtwork.borderData = {
            width: artworkWidth,
            height: artworkHeight
        }


        return youtubeArtwork
    }

}

export default new YoutubeArtwork()
