const DEFAULT_SIZE_LIMIT = 10 * 1024 * 1024;

const IMAGE_SIZE_LIMIT = 20 * 1024 * 1024;

const VIDEO_SIZE_LIMIT = 30 * 1024 * 1024;

const GIF_SIZE_LIMIT = 30 * 1024 * 1024;

const AUDIO_SIZE_LIMIT = 30 * 1024 * 1024;

const MODEL3D_SIZE_LIMIT = 30 * 1024 * 1024;

export function getUploadSizeLimit(mimeType: string) {
    //

    if (mimeType.startsWith("image/gif")) {
        return GIF_SIZE_LIMIT;
    }

    if (mimeType.startsWith("image/")) {
        return IMAGE_SIZE_LIMIT;
    }

    if (mimeType.startsWith("video/")) {
        return VIDEO_SIZE_LIMIT;
    }

    if (mimeType.startsWith("audio/")) {
        return AUDIO_SIZE_LIMIT;
    }

    if (mimeType.startsWith("model/")) {
        return MODEL3D_SIZE_LIMIT;
    }

    return DEFAULT_SIZE_LIMIT;
}
