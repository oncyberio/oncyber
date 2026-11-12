// @ts-check

/** @typedef { "IMAGE_MEDIA" | "PANORAMA_MEDIA" | "VIDEO_MEDIA" | "AUDIO_MEDIA" | "HTML_MEDIA" | "MODEL_MEDIA" | "EMBED_HTML_MEDIA" | "EMBED_YOUTUBE_MEDIA" | "TEXT_MEDIA" |"TRIGGER_ZONE_MEDIA" | "GLOBAL_STREAM_MEDIA"}  MediaType  */

export const IMAGE_MEDIA = "IMAGE_MEDIA"

export const PANORAMA_MEDIA = "PANORAMA_MEDIA"

export const VIDEO_MEDIA = "VIDEO_MEDIA"

export const AUDIO_MEDIA = "AUDIO_MEDIA"

export const HTML_MEDIA = "HTML_MEDIA"

export const MODEL_MEDIA = "MODEL_MEDIA"

export const TEXT_MEDIA = "TEXT_MEDIA"

export const EMBED_HTML_MEDIA = "EMBED_HTML_MEDIA"

export const EMBED_YOUTUBE_MEDIA = "EMBED_YOUTUBE_MEDIA"

export const TRIGGER_ZONE_MEDIA = "TRIGGER_ZONE_MEDIA";

export const GLOBAL_STREAM_MEDIA = "GLOBAL_STREAM_MEDIA";

/**
 *
 * @param { string } mime
 * @returns { MediaType }
 */
export function getMediaType(mime) {
    if (!mime) return IMAGE_MEDIA;

    if(mime.startsWith("image")) {
        return IMAGE_MEDIA
    }
     else if(mime.startsWith("panorama")) {
        return PANORAMA_MEDIA
    }
    else if (mime.startsWith("video")) {
        return VIDEO_MEDIA
    }
    else if (mime.startsWith("audio")) {
        return AUDIO_MEDIA
    }
    else if (mime === "model/gltf+json" || mime === "model/gltf-binary") {
        return MODEL_MEDIA
    }
    else if (mime === "text/html") {
        return HTML_MEDIA
    }
    else if (mime.startsWith("embed/html")) {
        return EMBED_HTML_MEDIA
    }
    else if(mime === "embed/youtube") {
        return EMBED_YOUTUBE_MEDIA
    }

    else if (mime === "cyber/text") {

        return TEXT_MEDIA;
    } else if (mime === "cyber/triggerzone") {

        return TRIGGER_ZONE_MEDIA;

    } else if (mime === "cyber/globalstream") {

        return GLOBAL_STREAM_MEDIA;
    }
    else {
        return null
    }
}

/**
 *
 * @param { string } mime
 * @returns { boolean }
 */
export function isTransparent(mime) {

    return mime === "image/webp" || mime === "text/html" || mime === "image/png" || mime === "image/svg" || mime === "image/gif" || mime === "video/webm"

}



/**
 *
 * @param {string} mediaType
 * @returns
 */
export function supportsAudio(mediaType) {
    //
    return mediaType === "AUDIO_MEDIA" || mediaType === "VIDEO_MEDIA" || mediaType === "EMBED_YOUTUBE_MEDIA"
}


/**
 *
 * @param {string} mediaType
 * @returns
 */
export function supportsVideo(mediaType) {
    //
    return mediaType === "VIDEO_MEDIA" || mediaType === "EMBED_YOUTUBE_MEDIA"
}

/**
 *
 * @param {string} mediaType
 * @returns
 */
export function supportsBorder(mediaType) {
    //
    return mediaType !== "MODEL_MEDIA" && mediaType !== "TEXT_MEDIA"
}
