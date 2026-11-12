// @ts-check


export function getDefaultWaterData() {

    return {
        id: "water",
        kit: "cyber",
        type: "water",
        color: "#001E0F",
        opacity: 1,
        scale: { x: 1000, z: 1000 },
        position: { x: 0, y: 1, z: 0 },
        collision: true
    }
}

export function getWaterDataFromRoom(room) {

    let data = getDefaultWaterData()

    if (room.enableWater) {
        //
        data = structuredClone( { ...data, ...room.waterOptions } )
    }

    return data
}


export function updateRoomParamsFromWaterData(params, data) {

    if (data == null) {

        return
    }

    const { id, kit, type, ...opts } = data

    params.enableWater = true

    params.enableReflector = false

    //
    params.waterOptions = {
        ...params.waterOptions,
        ...structuredClone( opts ),
    }
}
