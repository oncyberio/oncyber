import type Api from "@components/_3DExhibit-v2/three/api";
import { EDITOR_ACTION } from "@3factory/editor/actions";
import { EDITION_ACTIONS } from "@3constants";
import { Asset } from "@uitypes/Asset";
import { ArtworkData, Experience, PortalData } from "@uitypes/experience";
import { deepEqual, hasOwn, shallowEqual } from "@utils/js";
import {
    getTextProps,
    isText,
    isWebsite,
} from "@features/studio/EditWorldMenu/utils";
import { fromXYZ_, toScale } from "@components/_3DExhibit-v2/three/utils/three";
import {
    getMediaType,
    supportsAudio,
    supportsVideo,
    supportsBorder,
} from "@3utils/mediatype";
import { isNft } from "@utils/metadata/reformatAsset";

const EMPTY_OBJECT = {};

function xyzEq(a, b) {
    //

    // if only one is null, return false
    if ((a == null) !== (b == null)) return false;

    return (
        (a == null && b == null) ||
        (a._x != null
            ? a._x === b._x && a._y === b._y && a._z === b._z
            : a.x === b.x && a.y === b.y && a.z === b.z)
    );
}

export class ExhibitDiff {
    //
    constructor(public world: Api) {}

    diffExhibit(current: Experience, incoming: Experience, scope: any) {
        //
        const artCmds = this.diffArtworks(current, incoming, scope);

        const portalCmds = this.diffPortals(current, incoming, scope);

        const kitCmds = this.diffComponents(current, incoming, scope);

        console.log("editor diff", scope, artCmds, portalCmds, kitCmds);

        return { artCmds, portalCmds, kitCmds };
    }

    private isSameAsset(current: Asset, incoming: Asset) {
        //

        let same =
            current != null &&
            current.mime_type === incoming.mime_type &&
            current.cover_mime_type === incoming.cover_mime_type &&
            current.blockchain === incoming.blockchain &&
            current.token_address === incoming.token_address &&
            current.token_id === incoming.token_id;

        if (same && isNft(current)) {
            same =
                this.isSameMedia(current, incoming) &&
                current.token_metadata === incoming.token_metadata &&
                deepEqual(current.files, incoming.files);
        }

        if (!same) {
            //
            const diff = {};

            Object.keys(current).forEach((it) => {
                //
                if (current[it] !== incoming[it]) {
                    diff[it] = { old: current[it], new: incoming[it] };
                }
            });
            console.log("not sameAsset", current.id, diff);
        }

        return same;
    }

    private isSameMedia(current: Asset, incoming: Asset) {
        return (
            current.animation_url === incoming.animation_url &&
            current.image_url === incoming.image_url &&
            current.animation_original_url ===
                incoming.animation_original_url &&
            current.original_animation_url ===
                incoming.original_animation_url &&
            current.image_original_url === incoming.image_original_url
        );
    }

    pushCommands(
        map: Record<string, EDITOR_ACTION[]>,
        id: string,
        ...actions: EDITOR_ACTION[]
    ) {
        //
        if (actions.length === 0) return;

        let cmds = map[id];

        if (cmds == null) {
            //
            map[id] = cmds = [];
        }

        cmds.push(...actions);
    }

    private diffArtworks(
        current: Experience,
        incoming: Experience,
        scope: any
    ) {
        //
        if (scope.artworks == null) return null;

        const cmds: Record<string, EDITOR_ACTION[]> = {};

        const incomingArts = incoming.artworks || EMPTY_OBJECT;

        const currentArts = current.artworks || EMPTY_OBJECT;

        if (incomingArts == null) return null;

        const incomingIds = Object.keys(incomingArts);

        const currentIds = Object.keys(currentArts);

        incomingIds.forEach((id) => {
            //
            const currentArtwork = current.artworks[id];

            const incomingArtwork = incoming.artworks[id];

            if (
                currentArtwork == null ||
                !this.isSameAsset(currentArtwork.data, incomingArtwork.data)
            ) {
                //
                let targetMeshId =
                    currentArtwork != null || current.portals[id] != null
                        ? id
                        : incomingArtwork.data.placeholderId;

                const remotePayload = structuredClone(incomingArtwork);

                this.pushCommands(cmds, id, {
                    type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                    placeholderId: targetMeshId,
                    asset: remotePayload.data,
                    remotePayload: remotePayload,
                    realtime: true,
                    keepPlaceholder:
                        currentArtwork == null &&
                        current.portals[id] == null &&
                        remotePayload.data.placeholderId == null,
                });
            }
            //
            else {
                //

                //
                const artCmds = this.diffArtwork(
                    id,
                    current.artworks[id],
                    incoming.artworks[id]
                );

                this.pushCommands(cmds, id, ...artCmds);
            }
        });

        currentIds.forEach((id) => {
            //
            if (incoming.artworks[id] == null && incoming.portals[id] == null) {
                //
                this.pushCommands(cmds, id, {
                    type: EDITION_ACTIONS.EDITOR_REMOVE_ARTWORK,
                    artworkId: id,
                    realtime: true,
                });
            }
        });

        return cmds;
    }

    private diffArtwork(
        id: string,
        current: ArtworkData,
        incoming: ArtworkData
    ) {
        //
        const cmds: EDITOR_ACTION[] = [];

        const mediaType = getMediaType(current.data.mime_type);

        {
            let opts: EDITOR_ACTION = {
                type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM,
                updates: [
                    {
                        id,
                    },
                ],
            };

            const update = opts.updates[0];

            if (!xyzEq(current.position, incoming.position)) {
                //
                update.position = { ...incoming.position };
            }

            if (!xyzEq(current.rotation, incoming.rotation)) {
                //
                update.rotation = fromXYZ_(incoming.rotation);
            }

            if (mediaType === "MODEL_MEDIA") {
                //
                if (!xyzEq(current.scale, incoming.scale)) {
                    //
                    update.scale = { ...incoming.scale };
                }
            } else {
                //
                const oldScale = current.data.scale || 1;
                const newScale = incoming.data.scale || 1;

                if (oldScale !== newScale) {
                    //
                    update.scale = toScale(newScale);
                }
            }

            if (update.position || update.rotation || update.scale) {
                //
                cmds.push(opts);
            }
        }

        if (mediaType === "TEXT_MEDIA") {
            //
            let currentProps = getTextProps(current.data);

            let incomingProps = getTextProps(incoming.data);

            let cmd: EDITOR_ACTION = {
                type: EDITION_ACTIONS.UPDATE_CYBER_TEXT,
                meshId: id,
            };

            let hasChanges = false;

            for (let key in incomingProps) {
                //
                if (
                    !hasOwn(currentProps, key) ||
                    !deepEqual(currentProps[key], incomingProps[key])
                ) {
                    //
                    hasChanges = true;

                    cmd[key] = incomingProps[key];
                }
            }

            if (hasChanges) {
                //
                cmds.push(cmd);
            }
            //
        }

        if (mediaType === "MODEL_MEDIA") {
            //
            if (!deepEqual(current.animations, incoming.animations)) {
                //
                cmds.push({
                    type: EDITION_ACTIONS.EDITOR_SELECT_ANIMATION,
                    artworkId: id,
                    animations: structuredClone(incoming.animations),
                });
            }

            if (
                !deepEqual(current.envmap, incoming.envmap) ||
                !deepEqual(current.envmapIntensity, incoming.envmapIntensity)
            ) {
                //
                cmds.push({
                    type: EDITION_ACTIONS.EDITOR_CHANGE_ENVMAP,
                    artworkId: id,
                    envmap: incoming.envmap,
                    envmapIntensity: incoming.envmapIntensity,
                });
            }
        }

        if (
            supportsBorder(mediaType) &&
            !deepEqual(current.data.borderColor, incoming.data.borderColor)
        ) {
            //
            cmds.push({
                type: EDITION_ACTIONS.EDITOR_CHANGE_BORDER,
                artworkId: id,
                color: incoming.data.borderColor,
            });
        }

        if (
            supportsAudio(current.data.mime_type) &&
            (!deepEqual(current.audioType, incoming.audioType) ||
                !deepEqual(current.volume, incoming.volume))
        ) {
            //
            cmds.push({
                type: EDITION_ACTIONS.EDITOR_CHANGE_AUDIO,
                artworkId: id,
                audioType: incoming.audioType,
                volume: incoming.volume,
            });
        }

        if (
            supportsVideo(mediaType) &&
            !deepEqual(current.videoPlayback, incoming.videoPlayback)
        ) {
            //
            cmds.push({
                type: EDITION_ACTIONS.EDITOR_CHANGE_VIDEO_OPTS,
                artworkId: id,
                opts: {
                    videoPlayback: incoming.videoPlayback,
                },
            });
        }

        if (
            isWebsite(current.data) &&
            !deepEqual(current.data.dimensions, incoming.data.dimensions)
        ) {
            //
            cmds.push({
                type: EDITION_ACTIONS.EDITOR_CHANGE_DIMENSIONS,
                artworkId: id,
                dimensions: structuredClone(incoming.data.dimensions),
            });
        }

        if (
            mediaType === "HTML_MEDIA" &&
            !deepEqual(
                current.data.enableHTMLView,
                incoming.data.enableHTMLView
            )
        ) {
            //
            cmds.push({
                type: EDITION_ACTIONS.EDITOR_TOGGLE_HTML,
                artworkId: id,
                enableHTMLView: incoming.data.enableHTMLView,
            });
        }

        return cmds;
    }

    private isSamePortal(current: PortalData, incoming: PortalData) {
        //

        const same =
            !!current.spawn == !!incoming.spawn &&
            current.exhibitId === incoming.exhibitId;

        return same;
    }

    private diffPortals(current: Experience, incoming: Experience, scope: any) {
        //
        if (scope.portals == null) return null;

        const cmds: Record<string, EDITOR_ACTION[]> = {};

        const incomingPorts = incoming.portals || EMPTY_OBJECT;

        const currentPorts = current.portals || EMPTY_OBJECT;

        if (incomingPorts == currentPorts) return null;

        const incomingIds = Object.keys(incomingPorts);

        const currentIds = Object.keys(currentPorts);

        incomingIds.forEach((id) => {
            //
            if (
                current.portals[id] == null ||
                !this.isSamePortal(current.portals[id], incoming.portals[id])
            ) {
                //
                const portal = structuredClone(incoming.portals[id]);

                let targetMeshId =
                    current.artworks[id] != null || current.portals[id] != null
                        ? id
                        : portal.spawn?.placeholderId ?? portal.id;

                this.pushCommands(cmds, id, {
                    type: EDITION_ACTIONS.EDITOR_ADD_PORTAL,
                    placeholderId: targetMeshId,
                    exhibitId: portal.exhibitId,
                    coords: portal.coords,
                    realtime: true,
                    keepPlaceholder:
                        current.portals[id] == null &&
                        current.artworks[id] == null &&
                        portal.spawn?.placeholderId != null,
                    remotePayload: portal,
                });
            }
            //
            else {
                //

                //
                const artCmds = this.diffPortal(
                    id,
                    current.portals[id],
                    incoming.portals[id]
                );

                this.pushCommands(cmds, id, ...artCmds);
            }
        });

        currentIds.forEach((id) => {
            //
            if (incoming.artworks[id] == null && incoming.portals[id] == null) {
                //
                this.pushCommands(cmds, id, {
                    type: EDITION_ACTIONS.EDITOR_DELETE_PORTAL,
                    portalId: id,
                    realtime: true,
                });
            }
        });

        return cmds;
    }

    private diffPortal(id: string, current: PortalData, incoming: PortalData) {
        //
        const cmds: EDITOR_ACTION[] = [];

        if (current.spawn) {
            //
            let opts: EDITOR_ACTION = {
                type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM,
                updates: [{ id }],
            };

            const update = opts.updates[0];

            if (
                !shallowEqual(current.spawn.position, incoming.spawn.position)
            ) {
                //
                update.position = { ...incoming.spawn.position };
            }

            if (
                !shallowEqual(current.spawn.rotation, incoming.spawn.rotation)
            ) {
                //
                update.rotation = fromXYZ_(incoming.spawn.rotation);
            }

            //
            if (!shallowEqual(current.spawn.scale, incoming.spawn.scale)) {
                //
                update.scale = { ...incoming.spawn.scale };
            }

            if (update.position || update.rotation || update.scale) {
                //
                cmds.push(opts);
            }
        }

        return cmds;
    }

    private isSameComponent(current: any, incoming: any) {
        //

        const same =
            current.id === incoming.id &&
            current.type === incoming.type &&
            current.kit === incoming.kit;

        return same;
    }

    private diffComponents(
        current: Experience,
        incoming: Experience,
        scope: any
    ) {
        //
        if (scope.kitbash == null) return null;

        const cmds: Record<string, EDITOR_ACTION[]> = {};

        const incominComps = incoming.kitbash || EMPTY_OBJECT;

        const currentComps = current.kitbash || EMPTY_OBJECT;

        if (incominComps == currentComps) return null;

        const incomingIds = Object.keys(incominComps);

        const currentIds = Object.keys(currentComps);

        incomingIds.forEach((id) => {
            //
            const data = incoming.kitbash[id];

            const target = current.kitbash[id];

            if (target == null || !this.isSameComponent(target, data)) {
                //
                const payload = structuredClone(data);

                this.pushCommands(cmds, id, {
                    type: EDITION_ACTIONS.EDITOR_ADD_KITBASH,
                    ctype: payload.type,
                    id: target?.id,
                    kit: payload.kit,
                    realtime: true,
                    payload,
                    preset: null,
                });
            }
            //
            else {
                //

                //
                const kitCmd = this.diffComponent(id, target, data);

                if (kitCmd != null) {
                    //
                    this.pushCommands(cmds, id, kitCmd);
                }
            }
        });

        currentIds.forEach((id) => {
            //
            if (incoming.kitbash[id] == null) {
                //
                this.pushCommands(cmds, id, {
                    type: EDITION_ACTIONS.EDITOR_REMOVE_KITBASH,
                    id,
                });
            }
        });

        return cmds;
    }

    private diffComponent(id: string, current: any, incoming: any) {
        //
        if (current._version == incoming._version) return null;

        let cmd: EDITOR_ACTION = {
            type: EDITION_ACTIONS.EDITOR_UPDATE_KITBASH,
            id,
            payload: structuredClone(incoming),
        };

        return cmd;
    }
}
