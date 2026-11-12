export const SNACKBAR_DURATION = 5000;

export const ACTION_MESSAGES = {
    GIF_CONVERTING: "Optimizing GIF for future uses…",
    COMPRESSING: "Optimizing Artwork…",
    MODEL_FIXING: "Upgrading mode…",
    AUTOGRAPH_INFO:
        "You can use the `Select Assets` dropdown to switch to your Autograph Assets",
};

export const ACTION_SUCCESS_MESSAGES = {
    REMOVE: "Successfully removed asset.",
    UPDATE: "Successfully updated asset.",
    ADD: "Successfully saved.",
    CHANGE_SCALE: "Successfully changed asset size.",
    CHANGE_OBJECT_SCALE: "Successfully changed asset scale.",
    CHANGE_AUDIO_VOLUME: "Successfully changed asset audio.",
    SET_VIDEO_POSITIONAL: "Successfully changed video positional.",
    CHANGE_TEXT_COLOR: "Successfully changed text color.",
    CHANGE_TEXT_FONT: "Successfully changed text font.",
    CHANGE_TEXT: "Successfully changed text.",
    CHANGE_TEXT_ALIGN: "Successfully changed text align.",
    CHANGE_TEXT_LINE_HEIGHT: "Successfully changed text height.",
    CHANGE_BORDER_COLOR: "Successfully changed border color.",
    CHANGE_TEXT_WIDTH: "Successfully changed text width.",
    CHANGE_HTML_PLAY_STATE: "Successfully saved.",
    CHANGE_ANIMATION: "Successfully changed animation.",
    REMOVED_BORDER_COLOR: "Successfully removed border.",
    CHANGE_OBJECT_POSITION_AND_ROTATION:
        "Successfully changed object position/rotation.",
    CHANGED_CURATOR_NOTES: "Successfully saved notes.",
    CHANGED_CURATOR_TITLE: "Successfully saved title.",
    CHANGED_CURATOR_DESCRIPTION: "Successfully saved description.",
    CHANGED_MODEL_ENVMAP: "Successfully changed model envmap",
    UPDATE_TEXT: "Successfully updated text",
    UPDATED_SPACE_INFO: "Successfully updated space info.",
    UPDATE_WEBSITE_DIMENSIONS: "Successfully updated dimensions"
};

export const ACTION_FAIL_MESSAGES = {
    UNDO: "Failed to undo",
    UPDATE: "Failed to update asset",
    ADD: "Failed to add asset.",
    UPLOAD_PORTAL_IMG:
        "Failed to set Exhibit portal (Preview image upload failed).",
    DELETE: "Failed to delete asset",
    INVALID_SIZE: "Invalid size number",
    INVALID_VOLUME: "Invalid volume number",
    UNAUTHORIZED_REPLACE:
        "You do not have the permissions to update or delete this asset",
    PLACEHOLDER_IN_USE: "This placeholder was used by another user",
    GIF_CONVERSION:
        "Failed to convert GIF into a Video. Please remove the asset and try to add it again",
    COMPRESSION: "Failed to optimize artwork",
    REFETCH: "Failed to fetch asset data",
    MEDIA_NOT_FOUND: "Failed to fetch media info of this asset",
    MEDIA_UNSUPPORTED:
        "Format not supported. We currently support images, videos and GLTF/GLB 3D models",
    CHANGED_MODEL_ENVMAP: "Failed to change model envmap",
};

export const SNACKBAR_TYPES = {
    success: "success",
    fail: "fail",
};
