// @ts-check

export const fogPresets = [
    {
        name: "Far fog",
        image: "https://cyber.mypinata.cloud/ipfs/QmX3AerMRuGcnR4f1Vmr5CavXH2mXvDj2Bkz1ez2ckmfZ6?filename=Far_xarlbf.jpg",
        data: {
            enabled: true,
            near: 300,
            far: 500,
        },
    },
    {
        name: "Near fog",
        image: "https://cyber.mypinata.cloud/ipfs/Qmep7GC3xtvPqkt6f8H2E5vKJKXasAEB8gSmYj5DnP1xbE?filename=Near_xlfd6x.jpg",
        data: {
            enabled: true,
            near: -15,
            far: 125,
        },
    },
    {
        name: "Close fog",
        image: "https://cyber.mypinata.cloud/ipfs/QmcxgiiP1XxVMa6CyP6pbBhKMGW4X7v6JGJdhJanmQfbtn?filename=Close_pkhysw.jpg",
        data: {
            enabled: true,
            near: 0,
            far: 40,
        },
    },
    {
        name: "No fog",
        image: "https://cyber.mypinata.cloud/ipfs/QmcqQjXekasgNaYyQisVe82su2u5cffXRLkHN3kqQuiZXC?filename=nofog_hy7vbp.jpg",
        data: {
            enabled: false,
            near: 380,
            far: 500,
        },
    },
];


export function getDefaultFogData() {

    return {
        id: "fog",
        kit: "cyber",
        type: "fog",
        enabled: true,
        near: 300,
        far: 500,
    }
}

export function getFogDataFromRoom(room) {

    let data = getDefaultFogData()

    if (room.fog?.enabled) {
        //
        data = structuredClone( { ...data, ...room.fog } )
    }

    return data
}

export function updateRoomParamsFromFogData(params, data) {

    if (data == null) {

        return
    }

    if (params.fog == null) {

        params.fog = {}
    }

    const { id, kit, type, ...opts } = data

    Object.assign(params.fog, opts)
}
