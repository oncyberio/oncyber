
export const presetImages = {
    day2: {
        id: "day2",
        name: "Day2",
        image: "https://cyber.mypinata.cloud/ipfs/QmTFbaXfVrYmT9EsePMAgtq5yadNWJSax8tFQGfeeLfVfq?filename=day2_q7id12.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmTFbaXfVrYmT9EsePMAgtq5yadNWJSax8tFQGfeeLfVfq?filename=day2_q7id12.jpg",
        format: ".jpg",
    },
    day: {
        id: "day",
        name: "Day",
        image: "https://cyber.mypinata.cloud/ipfs/QmNq5gNsXYDqyMqxKfFfQEwwVA6g4phWqSoEayWezquvxF?filename=day_agpnmv.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmNq5gNsXYDqyMqxKfFfQEwwVA6g4phWqSoEayWezquvxF?filename=day_agpnmv.jpg",
        format: ".jpg",
    },

    orbit: {
        id: "orbit",
        name: "Orbit",
        image: "https://cyber.mypinata.cloud/ipfs/QmddtwopJZK9JgrhbgbiP7sEM3xsHSmZjnbtu4tx1p7RMf?filename=orbit_rhujez.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmddtwopJZK9JgrhbgbiP7sEM3xsHSmZjnbtu4tx1p7RMf?filename=orbit_rhujez.jpg",
        format: ".jpg",
    },
    orbit2: {
        id: "orbit2",
        name: "Orbit2",
        image: "https://cyber.mypinata.cloud/ipfs/QmSvq6CdTVSj4AeVKA3VENDmVyR9C1YxQY6WRD6h8hz6Uu?filename=orbit2_l8v5ig.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmSvq6CdTVSj4AeVKA3VENDmVyR9C1YxQY6WRD6h8hz6Uu?filename=orbit2_l8v5ig.jpg",
        format: ".jpg",
    },
    space: {
        id: "space",
        name: "Space",
        image: "https://cyber.mypinata.cloud/ipfs/QmXgKdYcA5wpK8BxVXDxF2covwVa7x8wA57oMuBnr9k7Xo?filename=space_osu6ba.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmXgKdYcA5wpK8BxVXDxF2covwVa7x8wA57oMuBnr9k7Xo?filename=space_osu6ba.jpg",
        format: ".jpg",
    },
    moutains: {
        id: "mountains",
        name: "Mountains",
        image: "https://cyber.mypinata.cloud/ipfs/QmNqB9zL5XVXELBp8NxTJyuJRzhy8GERLAekq7bSNzKGfy?filename=mountains_jc9nsc.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmNqB9zL5XVXELBp8NxTJyuJRzhy8GERLAekq7bSNzKGfy?filename=mountains_jc9nsc.jpg",
        format: ".jpg",
    },
    night: {
        id: "night",
        name: "Night",
        image: "https://cyber.mypinata.cloud/ipfs/QmSYPrqZBAzH6rtJNvGzijAJcRfEL5QDUVGRMTteDSxJqC?filename=night_ugrau6_4_1_f828rd.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmSYPrqZBAzH6rtJNvGzijAJcRfEL5QDUVGRMTteDSxJqC?filename=night_ugrau6_4_1_f828rd.jpg",
        format: ".jpg",
    },
    mud_road: {
        id: "mud_road",
        name: "Mud Road",
        image: "https://cyber.mypinata.cloud/ipfs/QmZoTx5riP7W9oVoqMaDRQ8zdmU5zZDDsukTSswHn1S1by?filename=mud_road_vckhof.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmZoTx5riP7W9oVoqMaDRQ8zdmU5zZDDsukTSswHn1S1by?filename=mud_road_vckhof.jpg",
        format: ".jpg",
    },
    custom: {
        id: "custom",
        name: "Custom",
    },
};

export function getDefaultBackgroundData() {
    return {
        id: "background",
        kit: "cyber",
        type: "background",
        // Color or Texture
        backgroundType: "Color",
        colorOpts: {
            color: "#000000",
        },
        textureOpts: {
            // Sky or Image
            textureType: "Image",
            skyOpts: {
                turbidity: 10,
                rayleigh: 3,
                mieCoefficient: 0.005,
                mieDirectionalG: 0.7,
                azimuth: 180,
                elevation: 2,
            },
            imageOpts: {
                image: presetImages.day2
            }
        }

    }
}

export function getBackgroundDataFromRoom(room) {

    const  data = getDefaultBackgroundData()

    if (room.background_type === "color") {

        data.colorOpts.color = room.background
    }
    else if( room.background_type == 'texture' ||   room.background_type == 'image')  {

        data.backgroundType = "Texture"

        if (room.enableSky) {

            data.textureOpts.textureType = "Sky"

            data.textureOpts.skyOpts = structuredClone(room.skyOptions)
        }
        else {

            data.textureOpts.textureType = "Image"

            data.textureOpts.imageOpts.image = structuredClone(room.backgroundMap)
        }
    }

    return data
}

export function updateRoomParamsFromBackgroundData(params, data) {

    if (data == null) {

        // background data should never be null
        // debugger

        return
    }

    const type = data.backgroundType

    if(type == "Color") {

        params.background_type = "color"

        params.background = data.colorOpts.color
    }
    else if(type == "Texture") {

        if(data.textureOpts.textureType == "Sky") {

            params.background_type = "texture"

            params.enableSky = true

            params.skyOptions = structuredClone(data.textureOpts.skyOpts)
        }

        else if(data.textureOpts.textureType == "Image") {

            const defPath = params.backgroundMap?.path || presetImages.day2.path

            params.background_type = "image"

            params.enableSky = false

            params.backgroundMap =  structuredClone( data.textureOpts.imageOpts.image )

            if(data.textureOpts.imageOpts.image.id == "custom" && !data.textureOpts.imageOpts.image.path) {

                params.backgroundMap.path = defPath
            }

            params.backgroundMap.image = params.backgroundMap.path
        }
    }
}

