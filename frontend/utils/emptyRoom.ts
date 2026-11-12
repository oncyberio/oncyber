import { RoomParameters } from "@uitypes/roomParameters";
import { DefaultRoomParameters } from "@3utils/defaultroomparameters";
import { Destination } from "@uitypes/destinations";

// @ts-ignore
export const EMPTY_ROOM: RoomParameters = {
    ...structuredClone(DefaultRoomParameters),
    _id: "@@empty",
    isFuture: true,
    name: "Empty void",
    description: "Empty void",
    slug: "@@empty",
    //

    // enableSky: true,
    // applyEnvMapBackground: false,
    // // @ts-ignore
    // backgroundMap: {},
    // skyOptions: {
    //     turbidity: 10,
    //     rayleigh: 3,
    //     mieCoefficient: 0.005,
    //     mieDirectionalG: 0.7,
    //     elevation: 2,
    //     azimuth: 180,
    // },
    // //
    // background_type: "texture",
    // background: "#ff0000",

    // enableWater: false,
    // waterOptions: {
    //     id: "water",
    //     type: "water",
    //     color: "#4ce799",
    //     opacity: 1,
    //     scale: { x: 1000, z: 1000 },
    //     position: { x: 0, y: 0, z: 0 },
    // },

    // enableReflector: false,
    // reflectorOptions: {
    //     id: "reflector",
    //     type: "reflector",
    //     color: "#9fbada",
    //     opacity: 0.26,
    //     scale: { x: 1000, z: 1000 },
    //     position: { x: 0, y: 0.1, z: 0 },
    //     blur: true,
    //     normalmap: {
    //         enabled: false,
    //         strength: 0.5,
    //         tiles: 0.1,
    //         images: {
    //             id: "bump",
    //             name: "Bump",
    //             image: "https://cyber.mypinata.cloud/ipfs/QmNxCXG9yrCoyQG8HdgC86wwakxYkGq3eNGS87GZAKQy1v?filename=bump-floor_fxrdig.jpg",
    //             path: "https://cyber.mypinata.cloud/ipfs/QmNxCXG9yrCoyQG8HdgC86wwakxYkGq3eNGS87GZAKQy1v?filename=bump-floor_fxrdig.jpg",
    //             format: ".jpg",
    //         },
    //         customImage: null,
    //     },
    // },
};

export const GALAXY_ROOM: Destination = {
    _id: {
        $oid: "64bfebbbbe53490011be844a",
    },
    status: "tested",
    tag: ["free"],
    name: "Galaxy",
    thumbnail:
        "https://cyber.mypinata.cloud/ipfs/QmeiJtwg5kqooftFhfFbiAKHi1qaydpS1kEHARfKZgtMN6?filename=1690299322-galaxy-thumb.jpg",
    params: {
        user_height: 2.3,
        near: 0.5,
        far: 800,
        fog: {
            far: 400,
            near: 340,
            enabled: false,
        },
        enableSky: true,
        usePostProcessing: {
            enabled: false,
        },
        lighting: {
            enabled: false,
            lightDirection: {
                x: -1,
                y: -1,
                z: -1,
            },
            lightPosition: {
                x: 200,
                y: 200,
                z: 200,
            },
            bias: -0.002,
            near: 150,
            far: 500,
            intensity: 1,
            size: 500,
            helper: false,
        },
        gravity: 20,
        jump: 8,
        capsuleRadius: 0.85,
        playerSpeed: 70,
        background: "#000000",
        artworkScale: 150,
        showPlaceholders: true,
        applyEnvMapBackground: false,
        skyOptions: {
            turbidity: 10,
            rayleigh: 3,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.7,
            elevation: 2,
            azimuth: 180,
        },
        environnement_type: "scene",
        background_type: "color",
        environnement_position: {
            x: 0,
            y: 0,
            z: 0,
        },
        enableWater: false,
        waterOptions: {
            color: "#001E0F",
            opacity: 1,
            scale: {
                x: 1000,
                z: 1000,
            },
            position: {
                x: 0,
                y: 0,
                z: 0,
            },
        },
        enableReflector: false,
        reflectorOptions: {
            color: "#777777",
            scale: {
                x: 1000,
                z: 1000,
            },
            position: {
                x: 0,
                y: 0.1,
                z: 0,
            },
            normalmap: {
                enabled: false,
                strength: 0.5,
                tiles: 0.3,
            },
            blur: true,
            opacity: 1,
        },
        isFuture: true,
        initialPlayerPosition: {
            x: 0,
            y: 0,
            z: 0,
            reference: "head",
        },
        initialPlayerRotation: {
            x: 0,
            y: 0,
            z: 0,
        },
        capacity: 0,
    },
    author: {
        id: "0x04173063c0c491470b735954790f94ed307aae9d",
        userId: "0x04173063c0c491470b735954790f94ed307aae9d",
    },
    paths: {
        low: "https://cyber.mypinata.cloud/ipfs/QmRwtbHZbw3vc7XAps3H2z2MPbDfBtiChu3SU8qYMBcbVA?filename=1690299301-galaxy-low-.glb",
        mid: "https://cyber.mypinata.cloud/ipfs/QmcJ4egTaZEPuB6qkpxxQHbfmS3cfLKBCqatPieB4zVS66?filename=1690299303-galaxy-mid.glb",
        high: "https://cyber.mypinata.cloud/ipfs/QmcJ4egTaZEPuB6qkpxxQHbfmS3cfLKBCqatPieB4zVS66?filename=1690299307-galaxy-high.glb",
        original_path:
            "https://cyber.mypinata.cloud/ipfs/QmRtRx1siRLYb9LVKEvUXLJwJdL8rAXwkyPzXD23ZjzgCK?filename=1690299309-galaxy-origin.glb",
        low_compressed:
            "https://cyber.mypinata.cloud/ipfs/QmTcDuKWNGTmHZfc6vroCBVAGjNd3zPThViXaS9TCWtXgk?filename=1690299313-galaxy-low-compressed.glb",
    },
    slug: "galaxy",
    created_at: {
        $date: "2023-07-25T15:35:23.125Z",
    },
    updated_at: {
        $date: "2023-07-25T15:35:23.125Z",
    },
    __v: 0,
} as any;
