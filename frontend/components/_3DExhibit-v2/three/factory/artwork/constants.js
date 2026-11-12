// @ts-check

/** @type { Record<import("@gltypes").ArtworkType, import("@gltypes").ArtworkType> } */
export const TYPES = {
    PLACEHOLDER: "PLACEHOLDER",
    AUDIO: "AUDIO",
	VIDEO : 'VIDEO',
	IMAGE : 'IMAGE',
    PANORAMA: 'PANORAMA',
    MODEL : 'MODEL',
	HTML  : 'HTML',
    HTML_EMBED: 'HTML_EMBED',
    YOUTUBE_EMBED: 'YOUTUBE_EMBED',
    CYBER_TEXT: 'CYBER_TEXT',
    GLOBAL_STREAM: 'GLOBAL_STREAM',
    TRIGGER_ZONE: 'TRIGGER_ZONE'
}

/** @type { Record<import("@gltypes").ArtworkState, import("@gltypes").ArtworkState> } */
export const STATES = {
    IDLE    : /** @type { const } */ ("IDLE"),
    PLAYING : /** @type { const } */ ("PLAYING"),
    PAUSED  : /** @type { const } */ ("PAUSED")
}


export const DEFAULTS = {
    MAX_SIZE: 200,
    DEPTH: 0.04,
    ARTWORK_SCALE: 15
}

export const MAX_LOAD_TENTATIVES = 2
