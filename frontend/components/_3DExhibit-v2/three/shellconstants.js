// @ts-check

// Engine constants that the app shell (pages, layouts, contexts, utils) also
// needs. This module must stay free of three.js, detect-gpu, workers and
// other engine code: importing `@3constants` from the shell pulls the whole
// engine into every page, importing this file does not.
//
// `three/constants.js` re-exports everything here, so engine code keeps
// importing from `@3constants`. The mutable values (EDIT_MODE, IS_MULTIPLAYER,
// DEFAULT_PLAYER_AVATAR_PICTURE, ...) live here with their setters, so both
// import paths read the same live binding.

import conf from "./utils/params";

import { asConst } from "@utils/js";

import { soloDefaultSpaces } from "../utils/constants";

import {
    FUD_SPACE_SLUG,
    MINT_SPACE_SLUG,
} from "../ui/ControlPanel/Raffle/raffles/rtfktRaffleConstants";

export const CINEMATIC = conf.cinematic == true;

export var EDIT_MODE = conf.edit == true;

export var SET_EDIT_MODE = function (val) {
    EDIT_MODE = val;
};

export var UPLOADER_MODE = false;

export var SET_UPLOADER_MODE = function (val) {
    UPLOADER_MODE = val;
};

export var IS_MULTIPLAYER = false;

export const SET_IS_MULTIPLAYER = (val) => {
    IS_MULTIPLAYER = val;
};

/**
 * @typedef { typeof EDITION_ACTIONS } EDIT_ACTIONS
 * @typedef { EDIT_ACTIONS[keyof EDIT_ACTIONS] } EDIT_ACTION_TYPE
 *
 * @typedef {typeof AUDIO_TYPES  } AUDIO_TYPS
 * @typedef { AUDIO_TYPS[keyof AUDIO_TYPS] } AUDIO_TYPE
 */
export const AUDIO_TYPES = {
    LOOKAT: /** @type {const} */ ("lookat"),
    SPATIAL: /** @type {const} */ ("spatial"),
    CONSTANT: /** @type {const} */ ("constant"),
};

export const VIDEO_PLAYBACK_TYPES = {
    MANUAL: /** @type {const} */ ("manual"),
    AUTO: /** @type {const} */ ("auto"),
};

export const EDITION_ACTIONS = /** @type {const} */ ({
    SET_SELECTED_ITEMS: asConst("set_selected_items"),

    HANDLE_DRAG_START: asConst("handle_drag_start"),

    HANDLE_DRAG_END: asConst("handle_drag_end"),

    UPDATE_CYBER_TEXT: asConst("update_cyber_text"),

    EDITOR_ADD_ARTWORK: asConst("editor_add_artwork"),

    EDITOR_ADD_ARTWORK_BULK: asConst("editor_add_artwork_bulk"),

    EDITOR_REMOVE_ARTWORK: asConst("editor_remove_artwork"),

    EDITOR_DUPLICATE_ARTWORK: asConst("editor_duplicate_artwork"),

    EDITOR_CHANGE_TRANSFORM_MODE: asConst("editor_change_transform_mode"),

    EDITOR_CHANGE_TRANSFORM_CONTROLS: asConst(
        "editor_change_transform_controls"
    ),

    EDITOR_SELECT_ANIMATION: asConst("editor_select_animation"),

    EDITOR_CHANGE_BORDER: asConst("editor_change_border"),

    EDITOR_CHANGE_AUDIO: asConst("editor_change_audio"),

    EDITOR_CHANGE_VIDEO_OPTS: asConst("editor_change_video_opts"),

    EDITOR_CHANGE_SIZE: asConst("editor_change_size"),

    EDITOR_TOGGLE_HTML: asConst("editor_toggle_html"),

    EDITOR_CHANGE_3D_SCALE: asConst("editor_change_3d_scale"),

    EDITOR_CHANGE_TRANSFORM: asConst("editor_change_transform"),

    EDITOR_UPDATE_ARTWORK_MEDIA: asConst("editor_update_artwork_media"),

    EDITOR_UPDATE_MODEL_MEDIA: asConst("editor_update_model_media"),

    EDITOR_CHANGE_ENVMAP: asConst("editor_change_envmap"),

    REPLACE_HTML_PREVIEW_TEXTURE: asConst(
        "editor_replace_html_preview_texture"
    ),

    EDITOR_SET_PORTAL: asConst("editor_set_portal"),

    EDITOR_ADD_PORTAL: asConst("editor_add_portal"),

    EDITOR_DELETE_PORTAL: asConst("editor_delete_portal"),

    EDITOR_SET_PORTAL_SHAPE: asConst("editor_set_portal_shape"),

    UPDATE_WEBSITE_DIMENSIONS: asConst("update_website_dimensions"),

    EDITOR_CHANGE_DIMENSIONS: asConst("editor_change_dimensions"),

    EDITOR_TOGGLE_360: asConst("editor_toggle_360"),

    EDITOR_CHANGE_COLLIDER: asConst("editor_change_collider"),
    // Kitbash

    EDITOR_ADD_KITBASH: asConst("editor_add_kitbash"),

    EDITOR_DUPLICATE_KITBASH: asConst("editor_duplicate_kitbash"),

    EDITOR_REMOVE_KITBASH: asConst("editor_remove_kitbash"),

    EDITOR_UPDATE_KITBASH: asConst("editor_update_kitbash"),

    EDITOR_RESET_KITBASH: asConst("editor_reset_kitbash"),

    SET_SELECTION_MODE: asConst("set_selection_mode"),

    EDITOR_ADD_TRIGGER_ZONE: asConst("editor_add_trigger_zone"),

    EDITOR_ADD_GLOBAL_STREAM: asConst("editor_add_global_stream"),

    EDITOR_CHANGE_LOCK: asConst("editor_change_lock"),
});

export const PORTAL_EDIT_ACTIONS = {
    EDITOR_SET_PORTAL: asConst("editor_set_portal"),
};

/**
 * @typedef { typeof EDITOR_TRANSFORM_MODE } EDIT_TRANSFORM_MODES
 * @typedef { EDIT_TRANSFORM_MODES[keyof EDIT_TRANSFORM_MODES] } EDIT_TRANSFORM_MODE
 */
export const EDITOR_TRANSFORM_MODE = {
    ROTATION: asConst("rotation"),

    POSITION: asConst("position"),

    SCALE: asConst("scale"),
};

/**
 * @typedef { typeof EDITION_TRANSFORM_CONTROL } EDIT_TRANSFORM_CONTROLS
 * @typedef { EDIT_TRANSFORM_CONTROLS[keyof EDIT_TRANSFORM_CONTROLS] } EDIT_TRANSFORM_CONTROL
 */
export const EDITION_TRANSFORM_CONTROL = {
    TRANSFORM_3D: asConst("3d"),

    TRANSFORM_SNAP: asConst("snap"),
};

export var EDITION_TYPES = {
    ...EDITION_TRANSFORM_CONTROL,

    ...EDITOR_TRANSFORM_MODE,
};

export const EDITION_SCOPE = {
    ARTWORK: asConst("artwork_scope"),

    PORTAL: asConst("portal_scope"),
};

export var TRANSITION_ACTIONS = {
    PORTAL: asConst("transition_action_portal"),

    ARTWORK: asConst("transition_action_artwork"),
};

export var APP_STATES = {
    GENESIS: asConst("GENESIS"),

    INTRO: asConst("INTRO"),

    IDLE: asConst("IDLE"),

    SPACE: asConst("SPACE"),

    TELEPORT: asConst("TELEPORT"),

    TRANSITION: asConst("TRANSITION"),

    CINEMATIC: asConst("CINEMATIC"),

    EXPOSITION: asConst("EXPOSITION"),

    PANORAMA: asConst("PANORAMA"),

    EXIT: asConst("EXIT"),
};

/**
 * @typedef {typeof APP_STATES} APP_States
 *
 * @typedef { APP_States[keyof APP_States] } AppState
 *
 */

export var PREVIOUS_STATE = null;

/** @type { AppState } */
export var CURRENT_STATE = APP_STATES.GENESIS;

export var SET_CURRENT_STATE = function (STATE) {
    PREVIOUS_STATE = CURRENT_STATE;

    CURRENT_STATE = STATE;
};

/**
 * @typedef { typeof DRAG_MIMES  } DRAG_MIMES
 *
 * @typedef { DRAG_MIMES[keyof DRAG_MIMES]  } DRAG_MIME_TYPES
 */

export const DRAG_MIMES = {
    NFT: asConst("cyber/nft"),

    YOUTUBE: asConst("cyber/youtbe"),

    UPLOAD: asConst("cyber/upload"),

    PORTAL: asConst("cyber/portal"),

    KITBASH: asConst("cyber/kitbash"),
};

const MFER_AVATAR_PICTURE =
    "https://cyber.mypinata.cloud/ipfs/QmTN7ytNn7DurPVg6J8s7sYFUKZFc1ZuCa3MMuebth894m?filename=finalsun_ipz0ru.png";

export var DEFAULT_PLAYER_AVATAR_PICTURE = MFER_AVATAR_PICTURE;

export function SET_DEFAULT_AVATAR_PICTURE(exhibit) {
    const wow_spaces = [
        "wow_patio",
        "wow_cave",
        "wow_galaxy_frame",
        "wow_bedroom_frame",
        "wow_galaxy",
        "wow_bedroom",
        "originresidence",
    ];

    if (
        exhibit?.info?.customLink === "anarrowthroughhistory" ||
        exhibit?.info?.customLink === "980madison" ||
        exhibit?.info?.customLink === "976madison"
    ) {
        DEFAULT_PLAYER_AVATAR_PICTURE =
            "https://cyber.mypinata.cloud/ipfs/QmfQarzpzC79WDJpNXtmnkMCZQUnEJVhEL7TVPW7gY8TfL?filename=mf-1_085_720_hmochf.jpg";
    } else if (exhibit?.info?.room === "creadoreworkshop") {
        DEFAULT_PLAYER_AVATAR_PICTURE =
            "https://cyber.mypinata.cloud/ipfs/QmbgWVUkij4JBSuHmcH2YjAkdkHhe7tQi55ZfFTiQLRrDQ?filename=10168925769530204361.png";
    } else if (exhibit?.info?.room === "creadorexpato824") {
        DEFAULT_PLAYER_AVATAR_PICTURE =
            "https://cyber.mypinata.cloud/ipfs/QmPCPDsELepxNAoBCDdRya4BWE8fqgJkgDN57rPDNCNtbr?filename=1016892577255002132.png";
    } else if (wow_spaces?.includes?.(exhibit?.info?.room)) {
        DEFAULT_PLAYER_AVATAR_PICTURE =
            "https://cyber.mypinata.cloud/ipfs/Qmbh3j48ptUaSEMUdfz1xL3aYCSKhphcUnY7U34zzhtrow?filename=women_qksitn.png";
    } else if (
        exhibit?.info?.room === FUD_SPACE_SLUG ||
        exhibit?.info?.room === MINT_SPACE_SLUG
    ) {
        DEFAULT_PLAYER_AVATAR_PICTURE =
            "https://cyber.mypinata.cloud/ipfs/QmQYaRpwjz55RS2kenMzqZuSigQC32HGNi9Zw6XegNc9AU?filename=bot_btrp4c.png";
    }
}

/** Whether this world runs multiplayer: not in solo spaces, the editor or a cinematic. */
export const IS_MULTIPLAYER_ENABLED = (exhibit = null) => {
    if (exhibit?.info?.room && soloDefaultSpaces.includes(exhibit.info.room))
        return false;
    if (exhibit?.params?.soloExperience || exhibit?.soloExperience)
        return false;

    if (
        window.location.pathname === "/upload" ||
        window.location.pathname === "/studio" ||
        window.location.pathname.includes("/destinations/") ||
        window.location.pathname.includes("/mints/")
        // || window.location.pathname.includes("/art-blocks")
    ) {
        return false;
    }

    return !EDIT_MODE && !CINEMATIC;
};
