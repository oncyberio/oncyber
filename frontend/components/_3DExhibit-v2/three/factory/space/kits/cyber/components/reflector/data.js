// @ts-check

import { merge } from '@utils/js';

export const normalMaps = {
    bump: {
        id: "bump",
        name: "Bump",
        image: "https://cyber.mypinata.cloud/ipfs/QmNxCXG9yrCoyQG8HdgC86wwakxYkGq3eNGS87GZAKQy1v?filename=bump-floor_fxrdig.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmNxCXG9yrCoyQG8HdgC86wwakxYkGq3eNGS87GZAKQy1v?filename=bump-floor_fxrdig.jpg",
        format: ".jpg",
    },
    ice: {
        id: "ice",
        name: "Ice",
        format: ".jpg",
        image: "https://cyber.mypinata.cloud/ipfs/QmSvG7p86tDnFcXrTHLTGkzPST8BWHaUbhYz41VMiUj4nv?filename=waternormals_ij5wyx.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmSvG7p86tDnFcXrTHLTGkzPST8BWHaUbhYz41VMiUj4nv?filename=waternormals_ij5wyx.jpg",
    },
    holes: {
        id: "holes",
        name: "Holes",
        format: ".jpg",
        image: "https://cyber.mypinata.cloud/ipfs/QmQfnHCAkX82XCcao7cF9JTWYtWqw3mm34A7Z26CfEhLwm?filename=holeTextureNormalMap_pfirrt.png",
        path: "https://cyber.mypinata.cloud/ipfs/QmQfnHCAkX82XCcao7cF9JTWYtWqw3mm34A7Z26CfEhLwm?filename=holeTextureNormalMap_pfirrt.png",
    },
    ancient: {
        id: "ancient",
        name: "Ancient",
        format: ".jpg",
        image: "https://cyber.mypinata.cloud/ipfs/QmdQKsYHCXBdQFuqYsYya76vSkdB8uvEMG5HSquyMpwZUq?filename=176_norm_plaudy.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmdQKsYHCXBdQFuqYsYya76vSkdB8uvEMG5HSquyMpwZUq?filename=176_norm_plaudy.jpg",
    },
    bricks: {
        id: "bricks",
        name: "Bricks",
        format: ".jpg",
        image: "https://cyber.mypinata.cloud/ipfs/QmYuytYhhVzGxDU2dSvifG6ueJ4fqMdN3Fn4dPmnGQHWTA?filename=154_norm_kleqsk.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmYuytYhhVzGxDU2dSvifG6ueJ4fqMdN3Fn4dPmnGQHWTA?filename=154_norm_kleqsk.jpg",
    },
    metalsheet: {
        id: "metalsheet",
        name: "Metal Sheet",
        format: ".jpg",
        image: "https://cyber.mypinata.cloud/ipfs/QmbN1F5m1dhSLhoyHh4AXgs9GkCjUckPXKw8by3r5gGPgz?filename=199_norm_hxmuel.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmbN1F5m1dhSLhoyHh4AXgs9GkCjUckPXKw8by3r5gGPgz?filename=199_norm_hxmuel.jpg",
    },
    custom: {
        id: "custom",
        name: "Custom",
    }
};

export const reflectorPresets = [
    {
        name: "Mirror",
        image: "https://cyber.mypinata.cloud/ipfs/QmeGoooJdmp9CwwvFQezpYPbyXgVzqzyd3PWjDWRSnrsUq?filename=mirror_scbiel.jpg",
        data: {
            color: "#9fbada",
            opacity: 1,
            blur: true,
            normalmap: {
                enabled: false,
                strength: 0.5,
                tiles: 0.3,
                images: normalMaps.bump,
                customImage: null,
            },
            collision: true,
        },
    },
    {
        name: "Ice",
        image: "https://cyber.mypinata.cloud/ipfs/QmRQzP197oCfMnMBA4tHWP3EPYrdkRxMMii7bqxzeDuAzW?filename=ice_ieywss.jpg",
        data: {
            color: "#bff3ff",
            opacity: 1,
            blur: true,
            normalmap: {
                enabled: true,
                strength: 0.33,
                tiles: 0.1,
                images: normalMaps.ice,
                customImage: null,
            },
            collision: true,
        },
    },
    {
        name: "Glass",
        image: "https://cyber.mypinata.cloud/ipfs/QmP8RdHfTRrcq3TxhjdURvXTgUMWycu9BNc4V8wci2nxEX?filename=glass_r0qsrg.jpg",
        data: {
            color: "#838383",
            opacity: 0.5,
            blur: false,
            normalmap: {
                enabled: false,
                strength: 0.5,
                tiles: 0.3,
                images: normalMaps.bump,
                customImage: null,
            },
            collision: true,
        },
    },
    {
        name: "Tiles",
        image: "https://cyber.mypinata.cloud/ipfs/QmSnDr4De2CWE9P1u9yaE6owaKkhUHEUmk6brwfgAE1Pf9?filename=Tiles_ymajxq.jpg",
        data: {
            color: "#e411e6",
            opacity: 1,
            blur: true,
            normalmap: {
                enabled: true,
                strength: 0.5,
                tiles: 0.3,
                images: normalMaps.bump,
                customImage: null,
            },
            collision: true,
        },
    },
    {
        name: "Holes",
        image: "https://cyber.mypinata.cloud/ipfs/QmUan8YJKmU5azA9LL3qx9AtniswKsfryD7qjnvvCbaArm?filename=holes_cerfxu.jpg",
        data: {
            color: "#3d3d3d",
            opacity: 1,
            blur: true,
            normalmap: {
                enabled: true,
                strength: 1,
                tiles: 0.5,
                images: normalMaps.holes,
                customImage: null,
            },
            collision: true,
        },
    },
    {
        name: "Metal Sheet",
        image: "https://cyber.mypinata.cloud/ipfs/QmZT6ziS69ag4QUuK5zbcFnubXCNHy4u4dmLB12RyNG2fm?filename=metalsheet_kvavxx.jpg",
        data: {
            color: "#838383",
            opacity: 1,
            blur: true,
            normalmap: {
                enabled: true,
                strength: 0.5,
                tiles: 0.3,
                images: normalMaps.metalsheet,
                customImage: null,
            },
            collision: true,
        },
    },
    {
        name: "Bricks",
        image: "https://cyber.mypinata.cloud/ipfs/Qmb4nxAUNWdjWzVxgZUWe6CBiR38ooM4znMUeZYi4LBNYn?filename=brick_lqutbu.jpg",
        data: {
            color: "#a1460f",
            opacity: 1,
            blur: true,
            normalmap: {
                enabled: true,
                strength: 0.5,
                tiles: 0.3,
                images: normalMaps.bricks,
                customImage: null,
            },
            collision: true,
        },
    },
    {
        name: "Ancient",
        image: "https://cyber.mypinata.cloud/ipfs/Qmd4jkLa3aTJYYUMRvTm1fTgzLZ62i5Cu4eZiV3RttCwR2?filename=ancient_ahalcd.jpg",
        data: {
            color: "#e0ce3c",
            opacity: 1,
            blur: true,
            normalmap: {
                enabled: true,
                strength: 0.5,
                tiles: 0.3,
                images: normalMaps.ancient,
                customImage: null,
            },
            collision: true,
        },
    },
];

export function getDefaultReflectorData() {

    return {
        id: "reflector",
        kit: "cyber",
        type: "reflector",
        color: "#9fbada",
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1000, z: 1000 },
        opacity: 1,
        blur: true,
        normalmap: {
            enabled: false,
            strength: 0.5,
            tiles: 0.3,
            images: normalMaps.bump,
            customImage: null,
        },
        collision: true,
    };
}

export function getReflectorDataFromRoom(room) {

    let data = getDefaultReflectorData()

    if (room.enableReflector) {
        //
        data = merge( data, room.reflectorOptions )
    }

    return data
}


export function updateRoomParamsFromReflectorData(params, data) {

    if (data == null) {

        return
    }

    const { id, kit, type, ...opts } = data

    params.enableWater = false

    params.enableReflector = true

    //
    params.reflectorOptions = {
        ...params.reflectorOptions,
        ... structuredClone( opts ),
    }

    if(opts.normalmap.images.id == "custom") {
        //
        params.reflectorOptions.normalmap.images = {
            ...opts.normalmap.images,
            ... opts.normalmap.customImage
        }
    }
}
