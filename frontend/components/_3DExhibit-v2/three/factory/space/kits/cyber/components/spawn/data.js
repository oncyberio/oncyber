// @ts-check

// Three-free modules: the room-data defaults are reached from the app shell.
import { EDIT_MODE, UPLOADER_MODE, CINEMATIC } from "@3gl/shellconstants"

import conf from "@3utils/params"

import { CoordsReference } from "@3utils/spacecoords"

import { parseLocation } from "@utils/js"



export function getDefaultSpawnData() {
    return {
        id: "spawn",
        kit: "cyber",
        type: "spawn",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
    }
}

export function getSpawnDataFromRoom(room) {

    const  data = getDefaultSpawnData()

    if (room.initialPlayerPosition) {

        data.position = { ...room.initialPlayerPosition }

        data.position.y = 0
    }

    if (room.initialPlayerRotation) {

        data.rotation = { ...room.initialPlayerRotation }
    }

    return data
}

export function updateRoomParamsFromSpawnData(params, data) {

    if (data == null) {

        return
    }

    const useUrlCoords = conf.coords && !EDIT_MODE && !UPLOADER_MODE && !CINEMATIC

    if (useUrlCoords) {

        const location = parseLocation(conf.coords);

        if (location == null) return;

        params.initialPlayerPosition = {
            ...location.position,
            reference: CoordsReference.HEAD,
        };

        params.initialPlayerRotation = {
            x: 0,
            y: location._y,
            z: 0,
        };

        return;

    }

    if (data == null) return

    const { id, kit, type, ...opts } = data

    params.initialPlayerPosition = { ...opts.position, reference: CoordsReference.HEAD }

    params.initialPlayerRotation = { ...opts.rotation }
}
