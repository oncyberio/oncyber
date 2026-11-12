// @ts-check

import { ENVMAPS } from "@components/_3DExhibit-v2/utils/envmaps";

export const envmaps = ENVMAPS

export const envmapPresets = [
    {
        name: "Scene",
        image: "/components/envmap.png",
        data: {
            envmapType: "scene",
            sceneOpts: {
                position: { x: 0, y: 0, z: 0 },
            },
        }
    },
    {
        name: "Studio",
        image: envmaps.studio.image,
        data: {
            envmapType: "image",
            imageOpts: {
                image: envmaps.studio,
            },
        }
    },
    {
        name: "Fields",
        image: envmaps.fields.image,
        data: {
            envmapType: "image",
            imageOpts: {
                image: envmaps.fields,
            },
        }
    },
    {
        name: "Village",
        image: envmaps.vig.image,
        data: {
            envmapType: "image",
            imageOpts: {
                image: envmaps.vig,
            },
        }
    }
];

export function getDefaultEnvmapData() {

    return {
        id: "envmap",
        kit: "cyber",
        type: "envmap",
        envmapType: "scene", // "Scene" | "Image"
        sceneOpts: {
            position: { x: 0, y: 0, z: 0 },
        },
        imageOpts: {
            image: ENVMAPS.studio,
        },
    }
}

export function getEnvmapDataFromRoom(room) {

    let data = getDefaultEnvmapData()

    data.envmapType = room.environnement_type

    if (data.envmapType === "scene") {

        data.sceneOpts.position = structuredClone(room.environnement_position)
    }
    else if (data.envmapType === "image") {

        data.imageOpts.image = structuredClone(room.envMap)
    }

    return data
}

export function updateRoomParamsFromEnvmapData(params, data) {

    if (data == null) {

        return
    }

    if (data.envmapType === "scene") {

        params.environnement_type = "scene"

        params.environnement_position = structuredClone(data.sceneOpts.position)
    }
    else if (data.envmapType === "image") {

        params.environnement_type = "image"

        params.envMap = structuredClone(data.imageOpts.image)
    }
}
