// @ts-check



export function getDefaultCameraData() {

    return {
        id: "camera",
        kit: "cyber",
        type: "camera",

        far: 800,
    }
}

export function getCameraDataFromRoom(room) {

    let data = getDefaultCameraData()

    if(room.far) {

        data.far = room.far
    }

    return data
}

export function updateRoomParamsFromCameraData(params, data) {

    if (data == null) {

        return
    }

    params.far = data.far
}
