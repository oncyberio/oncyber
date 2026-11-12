import {
    EXPERIENCE_DATA_UPDATED,
    UserContextState,
} from "@components/context/UserContext";

import {
    addAsset,
    deleteAsset,
    DeleteField,
    pathUpdate,
    updatePortal,
    deletePortal,
    replaceAsset,
    SetField,
    updateAsset,
    updateExhibit,
    resetKitBash,
    updateKitBash,
    deleteKitBash,
} from "@utils/saveToDb";
import { EDITOR_ACTION } from "@3factory/editor/actions";
import { sendEditorAction, sendEvent } from "./realtime";

export class DatabaseHandler {
    constructor(public userState: UserContextState) {}

    static _instance = null;

    static getInstance(userState: UserContextState) {
        if (this._instance == null) {
            this._instance = new DatabaseHandler(userState);
        } else {
            this._instance.userState = userState;
        }

        return this._instance;
    }

    update = async (action: any, editorAction?: EDITOR_ACTION) => {
        await this.doUpdate(action);

        if (editorAction) {
            try {
                sendEditorAction(
                    this.userState.exhibit.id,
                    this.userState.user.id,
                    editorAction
                );
            } catch (err) {
                console.error("Failed to send realtime action", err);
            }
        }
    };

    doUpdate = async (action) => {
        const { exhibit, user, dispatch, token } = this.userState;

        const { type, payload } = action;
        // We check if the user is still an editor
        if (
            exhibit.editors.every(
                (id) => id.toLowerCase() !== user?.id?.toLowerCase()
            )
        ) {
            console.error("you have been kicked out of this exhibit.");
            return;
        }

        if (type === "ADD_ARTWORK") {
            let assetId = action.payload.data.id;

            const newArtworks = { ...exhibit.artworks };

            let newPortals = exhibit.portals;

            const isReplace = newArtworks?.[assetId] || newPortals?.[assetId];

            // If it's a replace
            if (newPortals?.[assetId]) {
                newPortals = { ...newPortals };

                delete newPortals[assetId];
            }

            newArtworks[assetId] = {
                ...action.payload,
            };

            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    artworks: newArtworks,
                    portals: newPortals,
                },
            });

            await updateExhibit(
                exhibit.id,
                isReplace
                    ? replaceAsset(assetId, action.payload)
                    : addAsset(assetId, action.payload),
                token
            )
                .then((response) => response.json())
                .then((result) => {
                    if (!result.success) {
                        throw new Error(`Failed to add/replace asset!`);
                    }
                });
        } else if (type === "DELETE_ARTWORK") {
            let assetId = action.payload.id;
            const newArtworks = { ...exhibit.artworks };

            delete newArtworks[assetId];

            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    artworks: newArtworks,
                },
            });

            await updateExhibit(exhibit.id, deleteAsset(assetId), token)
                .then((response) => response.json())
                .then((result) => {
                    if (!result.success) {
                        throw new Error(
                            result.message || "Failed to delete asset!"
                        );
                    }
                });
        } else if (type === "SET_PORTAL") {
            //
            let id = action.payload.id;

            const portals = { ...exhibit.portals };

            let artworks = exhibit.artworks;

            if (artworks?.[id]) {
                artworks = { ...artworks };

                delete artworks[id];
            }

            const payload = {
                ...portals[id],
                ...action.payload,
            };

            portals[id] = payload;

            // console.log(newArtworks);
            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    portals,
                    artworks,
                },
            });

            await updateExhibit(exhibit.id, updatePortal(id, payload), token);
            //
        } else if (type === "DELETE_PORTAL") {
            let id = action.payload.id;
            const portals = { ...exhibit.portals };

            delete portals[id];

            // console.log(newArtworks);
            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    portals,
                },
            });

            await updateExhibit(exhibit.id, deletePortal(id), token);
        } else if (
            type === "UPDATE_ARTWORK_DATA" ||
            type === "SET_ARTWORK_DATA" ||
            type === "UPDATE_CYBER_TEXT"
        ) {
            const assetId = action.payload.id;
            const newArtworks = { ...exhibit.artworks };

            if (!newArtworks[assetId]?.data) return;

            newArtworks[assetId] = {
                ...newArtworks[assetId],
                data: {
                    ...newArtworks[assetId].data,
                    ...action.payload,
                },
            };

            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    artworks: newArtworks,
                },
            });

            const update =
                type === "SET_ARTWORK_DATA"
                    ? SetField(action.payload)
                    : action.payload;

            await updateExhibit(
                exhibit.id,
                updateAsset(assetId, {
                    data: update,
                }),
                token
            )
                .then((response) => response.json())
                .then((result) => {
                    if (!result.success) {
                        throw new Error("Failed to update asset!");
                    }
                });
        } else if (type === "UPDATE_ARTWORK") {
            const { id: assetId, ...data } = action.payload;
            const newArtworks = { ...exhibit.artworks };

            if (!newArtworks[assetId]) return;

            newArtworks[assetId] = {
                ...newArtworks[assetId],
                ...data,
            };

            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    artworks: newArtworks,
                },
            });

            await updateExhibit(exhibit.id, updateAsset(assetId, data), token);
        } else if (type === "SELECT_ANIMATION") {
            const { id, name, isActive } = payload;

            const newArtworks = { ...exhibit.artworks };

            if (!newArtworks[id]?.data) return;

            newArtworks[id] = {
                ...newArtworks[id],
                animations: {
                    ...(newArtworks?.[id]?.animations || {}),
                    [name]: {
                        name,
                    },
                },
            };

            if (isActive) {
                delete newArtworks?.[id]?.animations?.[name];
            }

            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    artworks: newArtworks,
                },
            });

            await updateExhibit(
                exhibit.id,
                updateAsset(id, {
                    animations: {
                        [name]: isActive ? DeleteField : { name },
                    },
                }),
                token
            );
        } else if (type === "OBJECT_CHANGED") {
            const { position, rotation, scale, id } = payload;

            if (action.isKitBash) {
                const kitbash = exhibit.kitbash?.[id];

                if (kitbash) {
                    return this.doUpdate({
                        type: "UPDATE_KITBASH",
                        payload: {
                            id,
                            ...kitbash,
                            position,
                            rotation,
                        },
                    });
                } else {
                    throw new Error("KitBash not found " + id);
                }
            }
            if (action.isPortal) {
                // @REFACTOR : remove once portal are made part of exhibit.artworks

                const portal = exhibit.portals[id];

                if (portal) {
                    return this.doUpdate({
                        type: "SET_PORTAL",
                        payload: {
                            id,
                            spawn: {
                                ...portal.spawn,
                                position,
                                rotation,
                            },
                        },
                    });
                } else {
                    throw new Error("Portal not found " + id);
                }
            }

            let update;

            const newArtworks = { ...exhibit.artworks };

            let artwork = newArtworks[id];

            if (!artwork?.data) return;

            // 3D Objects use `scale` property on the top level `artwork`, while artworks use the `scale` property
            // of the `artwork.data` property. Since this event can be called now both for 3D objects and artworks
            // we need to save the `scale` also in the top level `artwork`
            if (artwork.data.mime_type?.startsWith("model/gltf")) {
                newArtworks[id] = {
                    ...artwork,
                    position,
                    rotation,
                    scale,
                };
                update = { position, rotation, scale };
            } else {
                newArtworks[id] = {
                    ...artwork,
                    position,
                    rotation,
                    data: {
                        ...artwork.data,
                        scale: scale.x,
                    },
                };
                update = {
                    position,
                    rotation,
                    data: {
                        scale: scale.x,
                    },
                };
            }
            // console.log(newArtworks);
            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    artworks: newArtworks,
                },
            });

            await updateExhibit(exhibit.id, updateAsset(id, update), token);
        } else if (type === "RESET_KITBASH") {
            //
            const kitbash = action.payload;

            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    kitbash,
                },
            });

            await updateExhibit(exhibit.id, resetKitBash(kitbash), token);
        } else if (type === "UPDATE_KITBASH") {
            const id = action.payload.id;

            const newData = { ...(exhibit.kitbash || {}) };

            newData[id] = {
                ...newData[id],
                ...action.payload,
            };

            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    kitbash: newData,
                },
            });

            await updateExhibit(
                exhibit.id,
                updateKitBash(id, action.payload),
                token
            );
        } else if (type === "DELETE_KITBASH") {
            const id = action.payload.id;

            const newData = { ...(exhibit.kitbash || {}) };

            delete newData[id];

            dispatch({
                type: EXPERIENCE_DATA_UPDATED,
                payload: {
                    kitbash: newData,
                },
            });

            await updateExhibit(exhibit.id, deleteKitBash(id), token);
        } else {
            console.error("Unkown DB command", type);
        }
    };
}
