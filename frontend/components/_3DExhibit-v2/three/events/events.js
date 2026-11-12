var eventList = {

    COLLISION : 'collision',

    PORTAL : 'portal',

    SCROLL: "mousewheel",

    MOUSE_MOVE: "mousemove",

    TOUCH_MOVE: "touchmove",

    TOUCH_START: "touchstart",

    TOUCH_END: "touchend",

    TOUCH_CANCEL: "touchcancel",

    DBL_CLICK: "dblclick",

    MIRROR: "mirror",

    CAMERA_SWITCH: "camera_switch",


    //
    // POINTER_DOWN: "pointerdown",

    // POINTER_MOVE: "pointermove",

    // POINTER_UP: "pointerup",

    // POINTER_CANCEL: "pointercancel",

    // POINTER_LEAVE: "pointerleave",

    // POINTER_OUT: "pointerout",

    //
    WHEEL: "wheel",

    RESIZE: "resize",

    POST_RESIZE: "post_resize",

    UPDATE: "update",

    DAWN_UPDATE: "dawn_update",

    PRE_UPDATE: "pre_update",

    POST_UPDATE: "post_update",

    DUSK_UPDATE : 'dusk_update',

    MOUSE_DOWN: "mousedown",

    MOUSE_UP: "mouseup",

    PINCH_ZOOM: "pinchzoom",

    PINCH_START: "pinchstart",

    PINCH_END: "pinchend",

    KEY_DOWN: "keydown",

    KEY_UP: "keyup",

    CLICK: "click",

    TAP: "tap",

    DEBUG_VIEW: "debugview",

    MOUSE_ENTER: "mouseenter",

    MOUSE_LEAVE: "mouseleave",

    CUSTOM: "custom",

    RAYCAST : "raycast",

    STATE_END : "state_end",

    WORLD_STATE_CHANGED: "world_state_changed",

    CURRENT_USER_CHANGED: "current_user_changed",

    //
    ARTWORK_LOADED : "artwork_loaded",

    ARTWORK_ADDED: "artwork_added",

    ARTWORK_REMOVED: "artwork_removed",

    PORTAL_ADDED: "portal_added",

    PORTAL_REMOVED: "portal_removed",

    COMPONENT_ADDED: "component_added",

    COMPONENT_REMOVED: "component_removed",

    STREAM_ADDED: "stream_added",

    STREAM_REMOVED: "stream_removed",

    //

    CURRENT_ARTWORK_CHANGED: "current_artwork_changed",

    CURRENT_LABEL_HOVERED: "current_label_hovered",

    CURRENT_LABEL_CLICKED: "current_label_clicked",

    LOCAL_PLAYING_CHANGED: 'local_playing_changed',

    MEDIA_PLAYER_READY: "media_player_ready",


    // Editor events
    SELECTED_ARTWORK_CHANGED: "selected_artwork_changed",

    SELECTED_ARTWORK_CLICKED: "selected_artwork_clicked",

    ARTWORK_COORDS_CHANGED : "artwork_coords_changed",

    TEXT_ARTWORK_FONT_WIDTH_CHANGED: "TEXT_ARTWORK_FONT_WIDTH_CHANGED",

    FLOOR_INTERSECTED: "floor_intersected",


    // Portal events
    CURRENT_PORTAL_CHANGED: "current_portal_changed",



    // PORTAL_OPEN_REQUEST : 'portal_open_request',

    POINTER_LOCK: "pointerlockchange",

    PORTAL_TELEPORT_REQUEST : 'portal_teleport_request',

    PORTAL_SELECT_EXHIBIT: 'portal_select_exhibit',

    TRANSITION : 'transition',

    VR_SESSION_START: "vr_session_start",

    VR_SESSION_END: "vr_session_end",

    CINEMATIC_RENDER : 'cinematic_render',

    RECORD_TICK      : 'recorder_tick',

    PLAY: "play",

    PAUSE: "pause",

    PLAYER_LEAVE: "player_leave",

    PLAYER_JOINED: "player_joined",

    SEND_PACKET: "send_packet",

    MULTIPLAYER_INIT: "multiplayer_init",

    MULTIPLAYER_PACKET: "multiplayer_packet",

    VOICE_CHANGE: "voice_change",

    PLAYER_LOCATION_CHANGED: "player_location_changed",

    HTML_HAS_CANVAS: "html_has_canvas",

    HTML_PAUSED: "html_paused",

    HTML_PLAYING: "html_playing",

    UPDATE_PLAYERS: "update_players",

    PORTAL_OPENED: "portal_opened",

    OCCLUSION : "occlusion",

    LIGHTING : "lighting",

    EDITOR_DROP: "editor_drop",


    CREATE_DEFAULT_STYLEKIT: "create_default_stylekit",

    // AVATAR_MODE : 'avatar_mode',

    CAMERA_SWITCH_MODE: 'camera_switch_mode',

    SEND_FPS: "send_fps",

    PANORAMA_OPENING : "panorama_opening",

    PANORAMA_CLOSING : "panorama_closing",


    KITBASH_ADD: "kitbash_add",

    KITBASH_UPDATE: "kitbash_update",

    KITBASH_REMOVE: "kitbash_remove",

    KITBASH_DUPLICATE: "kitbash_duplicate",

    KITBASH_DATA_CHANGED: "kitbash_data_changed",

    KITBASH_DEFAULT_DATA: "kitbash_default_data",


    ERROR : 'error',

    ERROR_UPLOADER : 'error_uploader',

    UI_PROMPT : 'ui_prompt',

    // Stream events
    STREAM_COORDS_CHANGED: "stream_coords_changed",

    STENCIL : "stencil",

    PRE_RENDER : "pre_render",

    TUNNEL_TRANSITION_DONE: "tunnel_transition_done",

    TUNNEL_TRANSITION_START: "tunnel_transition_start",

    EDIT_MODE_CAMERA_MODE_SWITCH_DONE: "edit_mode_camera_mode_switch",

    EDIT_MODE_CAMERA_MODE_SWITCH_START: "edit_mode_camera_mode_switch_start",
}

export default eventList;
