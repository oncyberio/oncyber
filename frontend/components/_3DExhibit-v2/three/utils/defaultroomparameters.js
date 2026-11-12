// import DefaultRoomParameters from '@3utils/defaultroomparameters.js'

export const DefaultRoomParameters = {
    user_height: 2.3,
    near: 0.5,
    far: 400,
    fog: {
        far: 200,
        near: 170,
        enabled: false,
    },
    enableSky: true,
    // outputEncoding: SRGBColorSpace,
    // @ts-ignore
    envMap: {},
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

        near: 130,

        far: 500,

        intensity: 1,

        size: 500,

        helper: false,
    },
    // usesPhysicallyCorrectLights: false,
    // isPointerLockControls: true,
    // bloomEnabled: false,
    // exposure: 1,
    // bloomStrength: 0.5,
    // bloomThreshold: 0,
    // bloomRadius: 0,
    gravity: 20,
    jump: 8,
    capsuleRadius: 0.85,
    playerSpeed: 70,
    background: "#000000",
    artworkScale: 15,
    // cursorRadius: 0.5,
    showPlaceholders: true,
    applyEnvMapBackground: false,
    // @ts-ignore
    backgroundMap: {},
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
        collision: true,
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
            images: {},
        },
        blur: true,
        opacity: 1,
    },
};
