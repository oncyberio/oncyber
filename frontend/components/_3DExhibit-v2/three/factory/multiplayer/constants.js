

export const TELEPORT_TO_USER = "TELEPORT_TO_USER";

export const SUMMON_TO_USER = "SUMMON_TO_USER";

// Radius (world units) around the summon target: users already inside it are
// left alone, users pulled in land on a random ring inside it so they don't
// stack on the target's head.
export const DEFAULT_SUMMON_RADIUS = 10;

export const GET_USER_INFO = "GET_USER_INFO";

export const GOTO = "GOTO";

export const UPDATE_CHAT_BUBBLE = "UPDATE_CHAT_BUBBLE"

export const GET_USERS_INFO = "GET_USERS_INFO";

export const ENABLE_VOICE = "ENABLE_VOICE"

export const DISABLE_VOICE = "DISABLE_VOICE"

export const DEBUG_AUDIO = "DEBUG_AUDIO"

export const SET_VOICE_RANGE = "SET_VOICE_RANGE"

export const SET_MEDIA_TIME = "SET_MEDIA_TIME"

export const ADMIN_SYNC_MEDIA_TIME = "ADMIN_SYNC_MEDIA_TIME"

export const CAMMAND_ERRORS = {

    NOT_SAME_SPACE: "not-same-space",

    USER_NOT_FOUND: "user-not-found",

    ASSET_NOT_FOUND: "asset-not-found"
}

export const NO_USER_ERROR = {

    type: CAMMAND_ERRORS.USER_NOT_FOUND,

    success: false,

    message: "User not found"
};
