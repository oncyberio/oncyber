// @ts-check

export const lightPresets = [
    {
        name: "Light",
        image: "https://cyber.mypinata.cloud/ipfs/QmNhr8SLftVXgnFb98u36fdCh38v93g5SiShAPjfTWEmuA?filename=Light_jgxnco.png",
        data: {
            enabled: true,
            lightDirection: { x: -1, y: -1, z: -1 },
            lightPosition: { x: 200, y: 200, z: 200 },
            bias: -0.002,
            near: 139.4,
            far: 513,
            intensity: 1,
            size: 500,
        },
    },
    {
        name: "No Shadows",
        image: "https://cyber.mypinata.cloud/ipfs/Qmcfhdzt1sSFcVna3G5rqz24X9YzAvdLPqZ5YWFcedhcDo?filename=NoLight_1_hoxsxv.jpg",
        data: {
            enabled: false,
            lightDirection: { x: -1, y: -1, z: -1 },
            lightPosition: { x: 200, y: 200, z: 200 },
            bias: -0.002,
            near: 139.4,
            far: 513,
            intensity: 1,
            size: 500,
        },
    },
];

export function getDefaultLightingData() {

    return {
        id: "lighting",
        kit: "cyber",
        type: "lighting",

        enabled: true,
        lightDirection: { x: -1, y: -1, z: -1 },
        lightPosition: { x: 200, y: 200, z: 200 },
        bias: -0.002,
        near: 139.4,
        far: 513,
        intensity: 1,
        size: 500,
    }
}

export function getLightingDataFromRoom(room) {

    let data = getDefaultLightingData()

    if (room.lighting?.enabled) {
        //
        data = structuredClone( { ...data, ...room.lighting } )
    }

    return data
}

export function updateRoomParamsFromLightingData(params, data) {

    if (data == null) {

        return
    }

    if (params.lighting == null) {

        params.lighting = {}
    }

    const { id, kit, type, ...opts } = data

    Object.assign(params.lighting, opts)
}
