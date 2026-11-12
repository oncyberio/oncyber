// @ts-check

import conf from "@3gl/utils/params"

import {  Vector3 } from "three";

import { isWebmSupported } from "@3gl/utils/platform"

import { asConst, deferred } from "@utils/js"


// Device flags and the plain constants the app shell also needs live in two
// three-free modules. They are re-exported here so engine code keeps
// importing everything from `@3constants`; shell code (pages, layouts,
// contexts, utils) should import those modules directly instead, because
// importing this file pulls three.js and the rest of the engine into the page.
import {
    FRONT_END,
    IS_DESKTOP,
    IS_MOBILE,
    BROWSER,
} from "./device"

import {
    CINEMATIC,
    EDIT_MODE,
    APP_STATES,
    AUDIO_TYPES,
    EDITION_ACTIONS,
    EDITOR_TRANSFORM_MODE,
    EDITION_TRANSFORM_CONTROL,
    DRAG_MIMES,
} from "./shellconstants"

export {
    FRONT_END,
    UA_RESULT,
    IS_IOS,
    IS_MAC_MOBILE,
    isTouchDevice,
    IS_DESKTOP,
    IS_MOBILE,
    IS_MAC,
    IS_ANDROID,
    BROWSER,
    IS_SAFARI,
    IS_CHROME,
    DELETE_KEY,
    IS_TOUCH,
} from "./device"

export {
    CINEMATIC,
    EDIT_MODE,
    SET_EDIT_MODE,
    UPLOADER_MODE,
    SET_UPLOADER_MODE,
    IS_MULTIPLAYER,
    SET_IS_MULTIPLAYER,
    AUDIO_TYPES,
    VIDEO_PLAYBACK_TYPES,
    EDITION_ACTIONS,
    PORTAL_EDIT_ACTIONS,
    EDITOR_TRANSFORM_MODE,
    EDITION_TRANSFORM_CONTROL,
    EDITION_TYPES,
    EDITION_SCOPE,
    TRANSITION_ACTIONS,
    APP_STATES,
    PREVIOUS_STATE,
    CURRENT_STATE,
    SET_CURRENT_STATE,
    DRAG_MIMES,
    DEFAULT_PLAYER_AVATAR_PICTURE,
    SET_DEFAULT_AVATAR_PICTURE,
    IS_MULTIPLAYER_ENABLED,
} from "./shellconstants"

export const USER_HEIGHT = 2.8

export const CAPSULE_RADIUS = 0.55

// The transfer test starts a Web Worker, so it no longer runs when its module
// is imported: it runs here, when the engine's constants are first evaluated.
import { testTransferrable } from './utils/transferrabletest.js'


export var SUPPORT_TRANSFERRABLE = testTransferrable()

// export var SUPPORT_BITMAP_LOADING = ( typeof createImageBitmap != 'undefined' && BROWSER.name != 'Firefox' )


export const WEB_WORKER_SUPPORT = typeof(Worker) !== "undefined"

export const WEB_CODECS = typeof window!="undefined" && typeof window.VideoEncoder=="function" && BROWSER.name == 'Chrome' && IS_DESKTOP == true

export const WEBM_SUPPORTED = FRONT_END && isWebmSupported()


// cf https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#browser_compatibility
const browsersSupportingAudioCapture = ['chrome', "edge"]

export const AUDIO_CAPTURE_SUPPORTED = FRONT_END && browsersSupportingAudioCapture.includes( BROWSER?.name?.toLowerCase() )

export const OVERWRITER = conf.overwrite == true;

export const DEBUG = conf.debug == true

export const DEBUG_COLLISION = conf.debugcollision == true

export const DEBUGAPI = conf.debugapi == true

export const DEBUG_MULTIPLAYER = conf.debugmulti == true

export const MOBILE_FOLLOW_CONTOLS = conf.followcontrols == true

export const MOBILE_FOLLOW_CONTOLS_1 = conf.followcontrols1 == true

export const MOBILE_FOLLOW_CONTOLS_2 = conf.followcontrols2 == true

export const DEBUG_DAY = conf.day == true

export const IS_FUTURE_GUI = conf.futuregui == true

export const CYBER_CITY = conf.cybercity == true

export const INTERPOLATE = conf.interpolate == true

export const FAKE_PLAYERS      = conf.fakep == true

export var DEFAULT_ADJUSTMENT_SPEED = conf.adjustmentSpeed ? conf.adjustmentSpeed : 300

export var SET_ADJUSTMENT_SPEED = function( val ) {

    DEFAULT_ADJUSTMENT_SPEED = val
}

export var FAST_ADJUSTMENT_SPEED = conf.fastAdjustmentSpeed ? conf.fastAdjustmentSpeed : 1000

export var SET_FAST_ADJUSTMENT_SPEED = function( val ) {

    FAST_ADJUSTMENT_SPEED = val
}

export var FAKE_DATA = null

export var SET_FAKE_DATA = function( val ) {

    FAKE_DATA = val
}

export const FBO_DEBUG = conf.debugfbo == true

export var STATIC_CAMERA = conf.staticcamera == true

export const SET_STATIC_CAMERA = function (val) {

    STATIC_CAMERA = val;
}

export const DISABLE_REFLECTOR = conf.disablereflector == true

export const DEBUG_AUDIO = conf.debugaudio == true

// Gating basis for spatial voice: a speaker reaches listeners within
// ~2.0–2.5x this value (see VOICE_GATE_ON/OFF), so 60 => ~150-unit reach.
export const DEF_VOICE_RANGE = isNaN(+conf.voicerange) ? 60 : +conf.voicerange

export const VOICE_ROLLOFF_FACTOR = isNaN(+conf.voicedecay) ? 1 : +conf.voicedecay

export const DEBUG_CAM = conf.debugcam == true

export const DOWNLOAD = conf.download == true

export const DEBUG_RAYCAST = conf.debugraycast == true

export const DEBUG_BOX = conf.debugbox == true

export const ENABLE_OCCLUSION = conf.occ == true

export const FORCE_REFLECTOR  = conf.reflector == true

export const FORCE_POSTPROCESSING  = conf.postpro == true

export const DISABLE_LOD = conf.nolod == true

export var IS_FUTURE = conf.future == true

export const GLOBAL_TEXT_SCALE  = 0.02

export var FONT_DISTANCE_RANGE_FIELD = 0

export var SET_FONT_DISTANCE_RANGE_FIELD = function(val){

    FONT_DISTANCE_RANGE_FIELD = val
}

export const FPS = Number(conf.fps)

export const STATS = conf.stats == true

export const LOADER_STATS = conf.loaders == true

export const DEBUG_WEBWORK = conf.webwork == true

export const WEBWORK_DELAY = conf.webworkdelay ? conf.webworkdelay  : false

export var IS_FIRST_PERSON = true

export var SET_IS_FIRST_PERSON = (val) => {

    IS_FIRST_PERSON = val
}

export var IS_MAP_VIEW = false

export var SET_IS_MAP_VIEW = (val) => {

    IS_MAP_VIEW = val

    // window['IS_MAP_VIEW'] = val
}


export var IS_VR_SUPPORTED = null

export const SET_VR_SUPPORTED = (val) => {

    IS_VR_SUPPORTED = val
}


export var IS_VR = false

export const SET_VR = (val) => {

    IS_VR = val
}

export const IS_VR_URL = conf.isVR == true

export var DPI = FRONT_END ? Math.min(window.devicePixelRatio, 2) : null

export var REAL_DPI = DPI

export var SET_REAL_DPI = function( val ) {

    REAL_DPI = val
}

export var QUALITIES = {

    HIGH        : "high",

    MEDIUM      : "medium",

    LOW         : "low"
}

export var QUALITY =  QUALITIES.HIGH

export var FLY_MODE_LERP = {

    OFF : 1,

    MEDIUM: 0.4,

    HIGH: 0.02

}

export var FLY_MODE_PLERP = {

    OFF : 1,

    MEDIUM: 0.9,

    HIGH: 0.7

}

export const FLY_SPEED = {
    SLOWEST: 0.1,
    SLOW: 0.5,
    NORMAL: 1,
    FAST: 5,
};

export var SET_QUALITY = function( val ) {

    QUALITY = val
}

if( FRONT_END ) {

    window["sq"] = SET_QUALITY
}

/** @type { HTMLCanvasElement } */
export var CANVAS    	=  null

/**
 *
 * @param { HTMLCanvasElement } val
 */
export function SET_CANVAS(val){

	CANVAS = val
}


/**
 * @type { HTMLElement }
 */
export var CSS_CANVAS = null

/**
 *
 * @param { HTMLElement } val
 */
export function SET_CSS_CANVAS(val) {

    CSS_CANVAS = val
}

export const IS_POINTER_LOCK = () => FRONT_END ? document.pointerLockElement === CANVAS : null;

// export var RECORD_LAYOUTS = {

//     DESKTOP: {

//         w: 1920,
//         h : 1080
//     }
// }

export var RECORD_FPS = 30

export var SET_RECORD_SIZE = function( val ){

    RECORD_SIZE.w = val.w

    RECORD_SIZE.h = val.h

}

export var RECORD_SIZE = {

    w: 1920,

    h: 1080
}

export var CINEMATIC_PREVIEW_SIZE = {

    w: 1,
    h: 1,
    left : 1,
    bottom : 1
}

export var SET_CINEMATIC_PREVIEW_SIZE = function(val){

    CINEMATIC_PREVIEW_SIZE.w         = Math.ceil( val.w )
    CINEMATIC_PREVIEW_SIZE.h         = Math.ceil( val.h )
    CINEMATIC_PREVIEW_SIZE.left      = Math.floor( val.left )
    CINEMATIC_PREVIEW_SIZE.bottom    = Math.floor( val.bottom )
}

export var RECORD_INTRO = 3

export var RECORD_END = 0.5

export var IS_RECORDING = false

export const SET_IS_RECORDING = function(val){

    // console.log('IS RECORDING SET : ', val )
    // console.trace()

    IS_RECORDING = val
}

let userInteraction = deferred()

export const USER_INTERACTED = userInteraction.promise

export const SET_USER_INTERACTED = (val) => {

    userInteraction.resolve(true)
}


let worldCreated = deferred()


/** @type { Promise<import("./api").default> } */
// @ts-ignore
export const WORLD_CREATED = worldCreated.promise

export const SET_WORLD_CREATED = (val) => {

    worldCreated.resolve(val)
}


let multiplayerInit = deferred()


/** @type { Promise<import("./api").default> } */
// @ts-ignore
export const MULTIPLAYER_INIT = multiplayerInit.promise

export const SET_MULTIPLAYER_INIT = (val) => {

    multiplayerInit.resolve(val)
}


export var VIEW = {

	w : 0,

	h : 0
}


export var REAL_VIEW = {

    w : 0,

    h : 0
}



export var IS_LEGACY_GLTF_LOADER = true

export var SET_IS_LEGACYGLTF_LOADER = function(val){

    IS_LEGACY_GLTF_LOADER = val
}


export var IS_DEBUG_VIEW = false

export var SET_IS_DEBUG_VIEW = function( val ){

    IS_DEBUG_VIEW = val
}

export var SET_VIEW = (w,h)=>{

	VIEW.w = w

	VIEW.h = h
}

export const FLY_MODE_ROTATION = 30

export var SET_REAL_VIEW = (w,h)=>{

    REAL_VIEW.w = w

    REAL_VIEW.h = h
}


export var SHADOW_NEEDS_UPDATE = false

export function SET_SHADOW_NEEDS_UPDATE (val) {

    SHADOW_NEEDS_UPDATE = val
}



// Default CSS factor for an artwok scale of 150
export var CSS_FACTOR = 260


// export var BITMAP_SUPPORT = true

var  isSafari       = false
var  isFirefox      = false
var  firefoxVersion = 0

if( FRONT_END ) {
    isSafari = /^((?!chrome|android).)*safari/i.test( navigator.userAgent ) === true
    isFirefox = navigator.userAgent.indexOf( 'Firefox' ) > - 1
    // @ts-ignore
    firefoxVersion =  parseInt( isFirefox ? navigator.userAgent.match( /Firefox\/([0-9]+)\./ )[ 1 ] : - 1 )
}


export var BITMAP_SUPPORT = ( typeof createImageBitmap !== 'undefined' && !isSafari && !( isFirefox && firefoxVersion < 98 ) )

export var SUPPORT_BITMAP_LOADING = BITMAP_SUPPORT

const canvasTest = FRONT_END ?  document.createElement('canvas') : null

export var SUPPORT_OFFSCREEN_CANVAS = ( canvasTest ? typeof canvasTest.transferControlToOffscreen === "function" : false )

export var SUPPORT_OFFSCREEN_CANVAS_WEBGL = false


export function SET_SUPPORT_OFFSCREEN_CANVAS_WEBGL (val) {

    SUPPORT_OFFSCREEN_CANVAS_WEBGL = val
}



export const SUPPORT_KTX_SUITE = WEB_WORKER_SUPPORT && SUPPORT_TRANSFERRABLE && BITMAP_SUPPORT && SUPPORT_OFFSCREEN_CANVAS

// this.supportKTXSuite = WEB_WORKER_SUPPORT && SUPPORT_TRANSFERRABLE && BITMAP_SUPPORT && SUPPORT_OFFSCREEN_CANVAS

// var canvasTest = document.createElement('canvas');

// if(typeof canvasTest.transferControlToOffscreen === "function")
// {
//    console.log('true');
// }
// else
// {
//    console.log('false');
// }



export const LANDSCAPE = 'landscape'

export const PORTRAIT = 'portrait'

export var ORIENTATION  = null

export var SET_ORIENTATION = function (val) {

   ORIENTATION = val

}

// AUDIO_TYPES, VIDEO_PLAYBACK_TYPES, EDITION_ACTIONS, PORTAL_EDIT_ACTIONS,
// EDITOR_TRANSFORM_MODE, EDITION_TRANSFORM_CONTROL, EDITION_TYPES,
// EDITION_SCOPE, TRANSITION_ACTIONS and APP_STATES are defined in
// shellconstants.js and re-exported above. The type names stay here too.

/**
 * @typedef { typeof EDITION_ACTIONS } EDIT_ACTIONS
 * @typedef { EDIT_ACTIONS[keyof EDIT_ACTIONS] } EDIT_ACTION_TYPE
 *
 * @typedef {typeof AUDIO_TYPES  } AUDIO_TYPS
 * @typedef { AUDIO_TYPS[keyof AUDIO_TYPS] } AUDIO_TYPE
 *
 * @typedef { typeof EDITOR_TRANSFORM_MODE } EDIT_TRANSFORM_MODES
 * @typedef { EDIT_TRANSFORM_MODES[keyof EDIT_TRANSFORM_MODES] } EDIT_TRANSFORM_MODE
 *
 * @typedef { typeof EDITION_TRANSFORM_CONTROL } EDIT_TRANSFORM_CONTROLS
 * @typedef { EDIT_TRANSFORM_CONTROLS[keyof EDIT_TRANSFORM_CONTROLS] } EDIT_TRANSFORM_CONTROL
 */

/**
 * @typedef {typeof APP_STATES} APP_States
 *
 * @typedef { APP_States[keyof APP_States] } AppState
 *
 */

// PREVIOUS_STATE, CURRENT_STATE and SET_CURRENT_STATE live in
// shellconstants.js (the shell's world-state hook reads them) and are
// re-exported above.

export var CURRENT_MODE = null

export var SET_CURRENT_MODE = function (mode) {

    CURRENT_MODE = mode

}


export var LOADED_STATE = {}

export var SET_LOADED_STATE = function(val){

    LOADED_STATE[val] = true
}


/**
 * @typedef { object } CurrentSpace
 * @property { import("@gltypes").SpaceData }  space
 * @property { import("@uitypes/experience").Experience } exhibit
 * @property { import("@uitypes/roomParameters").RoomParameters } roomParameters
 * @property { object } cinematic
 *
*/

/** @type { CurrentSpace } */
export var CURRENT_SPACE = null

/**
 *
 * @param { CurrentSpace } val
 */
export var SET_CURRENT_SPACE = (val) => {

    CURRENT_SPACE = val

    CSS_FACTOR = 260 * (val?.roomParameters?.artworkScale || 15) / 150

    if (process.env.NODE_ENV === "development") {

        // @ts-ignore
        window.$$currentSpace = val
    }
}

/**
* @typedef { object } UserOpts
* @property { Partial<import("@uitypes/user.js").UserState> } userData
* @property { string } id
* @property { string } token
* @property { boolean } isAnonymous
*/

/* @type { UserOpts } */
export let CURRENT_USER = null

/**
 *
 * @param { UserOpts } val
 */
export var SET_CURRENT_USER = (val) => {

    CURRENT_USER = val
}

export var ANTIALIAS = false

export var GPU_TIER = { path: 'mid' }

export var SET_GPU_TIER = (tier) => {

    GPU_TIER = tier

    if (tier !== "low" || IS_MOBILE) {

        ANTIALIAS = true;

    }
}

export const PINCH_THRESHOLD = FRONT_END ? Math.min(screen.availHeight, screen.availWidth) / 20 : 0

// DEFAULT_PLAYER_AVATAR_PICTURE and SET_DEFAULT_AVATAR_PICTURE live in
// shellconstants.js (the shell shows that picture) and are re-exported above.

export let DEFAULT_VRM = "";

export async function SET_DEFAULT_VRM(val) {
    DEFAULT_VRM = val;
}

// Naming convention for portal meshes (eg doors): eg Portal_Mesh_001 ...
export var RE_PORTAL = /^portal_mesh_(?:\d)+$/i

// Naming convention for portal previews: eg Portal_Preview_001 ...
export var RE_PORTAL_PREVIEW = /^((\d+)portal_preview$|portal_preview_(\d+))$/i


// Some reusable Vectors

export const UP_VECTOR = new Vector3(0, 1, 0).normalize()

export const DOWN_VECTOR = new Vector3(0, -1, 0).normalize()

// Max distance to allow playing videos
// export const MAX_PLAY_DISTANCE_SQ = IS_MOBILE ? 25 ** 2 : 300 ** 2
export const MAX_PLAY_DISTANCE_SQ = IS_MOBILE ? 40 ** 2 : 300 ** 2

export const LOAD_PORTAL_DISTANCE_SQ = MAX_PLAY_DISTANCE_SQ

export const LOAD_PORTAL_INFO_DISTANCE_SQ = 50 ** 2

export const LOAD_AUDIO_CLOSE_DIST =  15



// max distance to toggle LOD for images

export const MAX_HI_IMAGE_DISTANCE_SQ = 20 ** 2

export var ARTWORK_STATS = {

    IMAGES: 0,

    VIDEOS : 0,

    PLAYING_VIDEOS: 0,

    MODELS: 0,

    HTML: 0,

    CSS: 0
}

export const ARTWORK_VERSION = 1


export const MEDIA_NETWORK_STATE = {

    NETWORK_EMPTY : 0,	// There is no data yet. Also, readyState is HAVE_NOTHING.

    NETWORK_IDLE  : 1,	// HTMLMediaElement is active and has selected a resource, but is not using the network.

    NETWORK_LOADING: 2, 	// The browser is downloading HTMLMediaElement data.

    NETWORK_NO_SOURCE:	3, // No HTMLMediaElement src found.
}

export const VIDEO_READY_STATE = {

    HAVE_NOTHING: 0,

    HAVE_METADATA: 1,

    HAVE_CURRENT_DATA: 2,

    HAVE_FUTURE_DATA: 3,

    HAVE_ENOUGH_DATA: 4
}

export const VIDEO_ERROR = [

    // code 0 : MEDIA_ERR_ABORTED
    "Media fetching was aborted by the user",

    // code 1: MEDIA_ERR_NETWORK
    "Network error occurred while fetching media data",

    // code 2: MEDIA_ERR_DECODE
    "Error while trying to decode the media resource",

    // code 3: MEDIA_ERR_SRC_NOT_SUPPORTED
    "Invalid media resource"

]

export const UPLOADER_TYPES = {
    NEAR: asConst("near"),

    FAR: asConst("far"),

    APPLY_ENVMAP_BACKGROUND: asConst("APPLY_ENVMAP_BACKGROUND"),

    BACKGROUND: asConst("BACKGROUND"),

    APPLY_ENV_MAP: asConst("APPLY_ENV_MAP"),

    GRAVITY: asConst("GRAVITY"),

    PLAYER_SPEED: asConst("PLAYER_SPEED"),

    BACKGROUND_TYPE: asConst("BACKGROUND_TYPE"),

    SKY_ENABLED: asConst("SKY_ENABLED"),

    JUMP: asConst("JUMP"),

    MODE: asConst("MODE"),

    ELEVATION : asConst("ELEVATION"),

    AZIMUTH: asConst("AZIMUTH"),

    APPLY_BACKGROUND: asConst("APPLY_BACKGROUND"),

    // UP: asConst("UP"),

    NEAR_FOG: asConst("NEAR_FOG"),

    FAR_FOG: asConst("FAR_FOG"),

    RAYLEIGH: asConst("RAYLEIGH"),

    TURBIDITY: asConst("TURBIDITY"),

    // SUNPOSITION: asConst("SUNPOSITION"),

    CUSTOMENV: asConst("CUSTOMENV"),

    SHOW_PLACEHOLDERS: asConst("SHOW_PLACEHOLDERS"),

    MIECOEFFICIENT: asConst("MIECOEFFICIENT"),

    MIEDIRECTIONALG: asConst("MIEDIRECTIONALG"),

    FOG_ENABLED: asConst("FOG_ENABLED"),

    ENVIRONNEMENT_TYPE: asConst("ENVIRONNEMENT_TYPE"),

    ENVIRONNEMENT_POSITION: asConst("ENVIRONNEMENT_POSITION"),

    FLOOR_WATER_SCALE: asConst("FLOOR_WATER_SCALE"),

    FLOOR_WATER_COLOR: asConst("FLOOR_WATER_COLOR"),

    FLOOR_WATER_OPACITY: asConst("FLOOR_WATER_OPACITY"),

    FLOOR_WATER_POSITION: asConst("FLOOR_WATER_POSITION"),

    FLOOR_REFLECTOR_SCALE: asConst("FLOOR_REFLECTOR_SCALE"),

    FLOOR_REFLECTOR_POSITION: asConst("FLOOR_REFLECTOR_POSITION"),

    FLOOR_ENABLE_WATER: asConst("FLOOR_ENABLE_WATER"),

    FLOOR_ENABLE_REFLECTOR: asConst("FLOOR_ENABLE_REFLECTOR"),

    FLOOR_REFLECTOR_OPACITY: asConst("FLOOR_REFLECTOR_OPACITY"),

    FLOOR_REFLECTOR_COLOR: asConst("FLOOR_REFLECTOR_COLOR"),

    FLOOR_REFLECTOR_BLUR: asConst("FLOOR_REFLECTOR_BLUR"),

    FLOOR_REFLECTOR_ENABLE_NORMAL_MAP: asConst("FLOOR_REFLECTOR_ENABLE_NORMAL_MAP"),

    FLOOR_REFLECTOR_NORMAL_MAP_STRENGTH: asConst("FLOOR_REFLECTOR_NORMAL_MAP_STRENGTH"),

    FLOOR_REFLECTOR_NORMAL_MAP_IMAGE: asConst("FLOOR_REFLECTOR_NORMAL_MAP_IMAGE"),

    FLOOR_REFLECTOR_NORMAL_MAP_TILING: asConst("FLOOR_REFLECTOR_NORMAL_MAP_TILING"),

    // LIGHTING : asConst("LIGHTING"),


}


/**
 * DRAG_MIMES is defined in shellconstants.js and re-exported above; its
 * types live there too.
 *
 * @typedef { import("./shellconstants").DRAG_MIME_TYPES } DRAG_MIME_TYPES
 */





export const AVATAR_MODES = {

    COIN : 'COIN',

    VRM  : 'VRM'
}

export var CURRENT_AVATAR_MODE = AVATAR_MODES.VRM

// export const SET_CURRENT_AVATAR_MODE = function( val ){

//     CURRENT_AVATAR_MODE = val
//     // CURRENT_AVATAR_MODE = AVATAR_MODES.COIN
// }

export const VRM_MODE_HEIGHT  = 3

// export const COIN_MODE_HEIGHT = 2.4

export const GET_BASE_HEIGHT = function(){

    return VRM_MODE_HEIGHT
}

export const LOD_VRM = "https://cyber.mypinata.cloud/ipfs/QmZVVaaYNqsZKDi3fNohAWmS3dDa4gtwu7w636TXowCdmg?filename=LOD_y6soy1.glb"
// 'https://res.cloudinary.com/ugc-oo-oo/image/upload/v1702573181/oo-ugc/LOD_y6soy1.glb'

export const MID_LOD_VRM = "https://cyber.mypinata.cloud/ipfs/QmX7XfjWmKPXYe6eX9Kr719JtgiGMJe8iNt1YEJDdpTMhG?filename=square.glb"
// "https://res.cloudinary.com/ugc-oo-oo/image/upload/v1702573992/oo-ugc/square.glb"

export const LOD_VRM_DISTANCE   = 150

export const LOD_VRM_VISIBILITY = 300

export const LOD_MESHES_MAX     = 30

export const MAX_INSTANCES = IS_MOBILE ? 300 : 300


export const ERROR_CODES = {
    //
    INVALID_MODEL : 1,

    INVALID_TRANSFORM: 2,

    INVALID_JSON_CINEMATIC : 3,

    INVALID_VRM_COUNT_MESH : 4,

    INVALID_VRM_BONES : 5,

    INVALID_VRM_FILE : 6,

    VRM_GENERAL_ERROR : 7,

    VRM_MESHES_OVERCOUNT_ERROR : 8
}

export var PIPE_LINE_STATE = {

    STENCIL : false,

    OCCLUSION : false,

    MIRROR : false
}

export const PERF_SCORES = {

    LOW: "low",

    MEDIUM: "medium",

    HIGH: "high",

    EXTREME : "extreme"
}

export var COMPRESSED_SUPPORT = false

export var SET_COMPRESSED_SUPPORT = function( values ){

    var support = false

    for (const property in values) {

        support = support || values[property]
    }

    COMPRESSED_SUPPORT = support

    console.log( 'COMPRESSED_SUPPORT', COMPRESSED_SUPPORT )
}

export const MINIMUM_VRM_BOX = 1.0
export const MAXIMUM_VRM_BOX = 4.5

export const MINIMUM_MIX_RATIO = (1 * MINIMUM_VRM_BOX ) / MAXIMUM_VRM_BOX

export const CAMERA_LAYERS = {

    CONTROLS : 31,

    SITTING_ZONE : 31,

    EDIT_MODE: 31,
}

/**
 * @typedef { typeof PERF_SCORES  } PERF_SCORES
 *
 * @typedef { PERF_SCORES[keyof PERF_SCORES]  } PERF_SCORE
 */

export const OLD_ALTS_MAPPING = {
    "https://res.cloudinary.com/oncyber-io/image/upload/v1675086718/hdrs/day2_q7id12.jpg": "https://cyber.mypinata.cloud/ipfs/QmTFbaXfVrYmT9EsePMAgtq5yadNWJSax8tFQGfeeLfVfq?filename=day2_q7id12.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1675086717/hdrs/day_agpnmv.jpg": "https://cyber.mypinata.cloud/ipfs/QmNq5gNsXYDqyMqxKfFfQEwwVA6g4phWqSoEayWezquvxF?filename=day_agpnmv.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1675086718/hdrs/orbit_rhujez.jpg": "https://cyber.mypinata.cloud/ipfs/QmddtwopJZK9JgrhbgbiP7sEM3xsHSmZjnbtu4tx1p7RMf?filename=orbit_rhujez.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1675086719/hdrs/orbit2_l8v5ig.jpg" : "https://cyber.mypinata.cloud/ipfs/QmSvq6CdTVSj4AeVKA3VENDmVyR9C1YxQY6WRD6h8hz6Uu?filename=orbit2_l8v5ig.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1675086717/hdrs/space_osu6ba.jpg" : "https://cyber.mypinata.cloud/ipfs/QmXgKdYcA5wpK8BxVXDxF2covwVa7x8wA57oMuBnr9k7Xo?filename=space_osu6ba.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1675086717/hdrs/mountains_jc9nsc.jpg" : "https://cyber.mypinata.cloud/ipfs/QmNqB9zL5XVXELBp8NxTJyuJRzhy8GERLAekq7bSNzKGfy?filename=mountains_jc9nsc.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1675086723/hdrs/night_ugrau6.jpg" : "https://cyber.mypinata.cloud/ipfs/QmUzP7VNX2zyQKmnHn27q2vXhxJXKiZVsq2iFiALFceqdJ?filename=night_ugrau6.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1674471467/assets/bump-floor_fxrdig.jpg": "https://cyber.mypinata.cloud/ipfs/QmNxCXG9yrCoyQG8HdgC86wwakxYkGq3eNGS87GZAKQy1v?filename=bump-floor_fxrdig.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1674471467/assets/waternormals_ij5wyx.jpg": "https://cyber.mypinata.cloud/ipfs/QmSvG7p86tDnFcXrTHLTGkzPST8BWHaUbhYz41VMiUj4nv?filename=waternormals_ij5wyx.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1647539922/assets/envmaps/studio_nrfv4q.png" : "https://cyber.mypinata.cloud/ipfs/QmdsiCH8sZqaMhqVCwPWNGn22adEwKMVXGFxFo4panQQoa?filename=studio_nrfv4q.png",
    "https://res.cloudinary.com/oncyber-io/raw/upload/v1647539775/assets/envmaps/studio_lvbl2a.hdr": "https://cyber.mypinata.cloud/ipfs/Qmf36ZrHWzbgjvBM1MpvueR6sLaJb1zDTy7tHCjQD1RfKS?filename=studio_lvbl2a.hdr",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1647539923/assets/envmaps/vig_xpruc1.png" : "https://cyber.mypinata.cloud/ipfs/QmNjkuw4dveRC79BxqtQvwx2dCjqEvraK64T4u6dq4J9wU?filename=vig_xpruc1.png",
    "https://res.cloudinary.com/oncyber-io/raw/upload/v1647539792/assets/envmaps/vig2_iezgt4.hdr" : "https://cyber.mypinata.cloud/ipfs/QmWAXFsbv6DoyU2U5vTYffHvm8dy9fUxJWtLYMRRSMDj4t?filename=vig2_iezgt4.hdr",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1647539922/assets/envmaps/klop_g5aedd.png" : "https://cyber.mypinata.cloud/ipfs/QmTw5BDU2RdMBVXGXDkiGkSrkXwwNrQPYdvzbPs2tcyhR9?filename=klop_g5aedd.png",
    "https://res.cloudinary.com/oncyber-io/raw/upload/v1647539747/assets/envmaps/klop1_bevmhh.hdr" : "https://cyber.mypinata.cloud/ipfs/QmR64qF4jNSEszDg7iMXVUfhgvksfwrzxW9S93yJFu97N4?filename=klop1_bevmhh.hdr",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690985237/background/night_ugrau6_4_1_f828rd.jpg": "https://cyber.mypinata.cloud/ipfs/QmSYPrqZBAzH6rtJNvGzijAJcRfEL5QDUVGRMTteDSxJqC?filename=night_ugrau6_4_1_f828rd.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690875949/icons/mud_road_vckhof.jpg" : "https://cyber.mypinata.cloud/ipfs/QmZoTx5riP7W9oVoqMaDRQ8zdmU5zZDDsukTSswHn1S1by?filename=mud_road_vckhof.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690980061/normalMaps/holeTextureNormalMap_pfirrt.png": "https://cyber.mypinata.cloud/ipfs/QmQfnHCAkX82XCcao7cF9JTWYtWqw3mm34A7Z26CfEhLwm?filename=holeTextureNormalMap_pfirrt.png",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690980795/normalMaps/176_norm_plaudy.jpg" : "https://cyber.mypinata.cloud/ipfs/QmdQKsYHCXBdQFuqYsYya76vSkdB8uvEMG5HSquyMpwZUq?filename=176_norm_plaudy.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690980809/normalMaps/154_norm_kleqsk.jpg" : "https://cyber.mypinata.cloud/ipfs/QmYuytYhhVzGxDU2dSvifG6ueJ4fqMdN3Fn4dPmnGQHWTA?filename=154_norm_kleqsk.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690980732/normalMaps/199_norm_hxmuel.jpg" : "https://cyber.mypinata.cloud/ipfs/QmbN1F5m1dhSLhoyHh4AXgs9GkCjUckPXKw8by3r5gGPgz?filename=199_norm_hxmuel.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690971475/textures/ground_grass_gen_01_mrbton.jpg" : "https://cyber.mypinata.cloud/ipfs/QmfURY8crGAHcyWh5fi3iZ3QojqL5zHdKa2NbyBf6X18c2?filename=ground_grass_gen_01_mrbton.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690971446/textures/beach_sand_owyhwn.jpg" : "https://cyber.mypinata.cloud/ipfs/QmZAXXjPDXSfmw13HatNakNas67fY8qKTxKYvihQToYd8r?filename=beach_sand_owyhwn.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690971668/textures/snow01_tybt2w.jpg" : "https://cyber.mypinata.cloud/ipfs/QmStSrtwDyRN4f2DXRgV2h1UtjLzZu4HeCybxDsnpUWFed?filename=snow01_tybt2w.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690975656/textures/rustyiron_oydyj6.jpg" : "https://cyber.mypinata.cloud/ipfs/QmQp4HpQucZ1EQ8p94BpURfScse5bhYUB9iWMFLhS4TQYQ?filename=rustyiron_oydyj6.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690975866/textures/whitemarble_auawpy.jpg" : "https://cyber.mypinata.cloud/ipfs/QmdTcQBqSK7HgNC1osBaAuqD2NgSkVwczgWAYfQpSbpWpk?filename=whitemarble_auawpy.jpg",
    "https://res.cloudinary.com/oncyber-io/image/upload/v1690976354/textures/redbrick_glkhyh.jpg" : "https://cyber.mypinata.cloud/ipfs/QmW417q8tck2knu6bAnhVdeRHmmCqfuTVcMoiKESQ34MEX?filename=redbrick_glkhyh.jpg"
}