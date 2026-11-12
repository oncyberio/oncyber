import { physicsGUI as gui } from "../globals/physicsgui"
import { ENVMAPS } from "@components/_3DExhibit-v2/utils/envmaps";
import { BACKGROUNDMAPS } from "@components/_3DExhibit-v2/utils/backgroundmaps";
import { NORMALMAPS } from "@components/_3DExhibit-v2/utils/normalMaps";
import { POST_PROCESSINGS, LUTMAPS } from "./index.js";
import { CURRENT_SPACE, UPLOADER_TYPES, CYBER_CITY } from "@components/_3DExhibit-v2/three/constants";

import {

    IS_FUTURE_GUI

} from '@3constants'

const uploaderTypes = {
    jump: UPLOADER_TYPES.JUMP,
    rayleigh: UPLOADER_TYPES.RAYLEIGH,
    gravity: UPLOADER_TYPES.GRAVITY,
    far_fog: UPLOADER_TYPES.FAR_FOG,
    near_fog: UPLOADER_TYPES.NEAR_FOG,
    turbidity: UPLOADER_TYPES.TURBIDITY,
    customEnv: UPLOADER_TYPES.CUSTOMENV,
    background: UPLOADER_TYPES.BACKGROUND,
    elevation: UPLOADER_TYPES.ELEVATION,
    azimuth: UPLOADER_TYPES.AZIMUTH,
    playerSpeed: UPLOADER_TYPES.PLAYER_SPEED,
    apply_env_map: UPLOADER_TYPES.APPLY_ENV_MAP,
    mieCoefficient: UPLOADER_TYPES.MIECOEFFICIENT,
    mieDirectionalG: UPLOADER_TYPES.MIEDIRECTIONALG,
    apply_background: UPLOADER_TYPES.APPLY_BACKGROUND,
    showPlaceholders: UPLOADER_TYPES.SHOW_PLACEHOLDERS,
    environnement_type: UPLOADER_TYPES.ENVIRONNEMENT_TYPE,
    environnement_position: UPLOADER_TYPES.ENVIRONNEMENT_POSITION
};

const fileSettings = {
    // MB
    maxSize: 6,
    dimensions: {
        width: 4096,
        height: 2048
    },
    extension: ['.png', '.hdr']
}

const saveSettings = {

    draco : true,

    geometrySimplifier: true,

    weld : true
}

export async function PhysicsGUI(uploaderSetRoomParameters) {

    let roomParameters = CURRENT_SPACE?.roomParameters

    const isFuture = roomParameters?.isFuture

    let tempCustomEnvMap = { ...roomParameters?.envMap };
    let tempCustomBackgroundMap = { ...roomParameters?.backgroundMap };
    let tempReflectionNormalMap = { ...roomParameters?.reflectorOptions?.normalmap?.images };

    const envmap = [
        ...Object.values(ENVMAPS)
            .filter((envmap) => envmap?.name)
            .map(({ id, name }) => ({ name, id })),
    ];

    if (!isFuture) {


        const background = gui.addFolder("Background").group(true);

        const colorFolder = background
            .addFolder("Color")
            .setVisible(roomParameters?.background_type === "color")
            .onVisibleChange((visible) => {
                const payload = CURRENT_SPACE?.roomParameters

                payload.background_type = visible ? "color" : "texture";

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.BACKGROUND_TYPE,
                    roomParameters: payload,
                });

                textureFolder.setVisible(!visible, false);

            });

        colorFolder
            .add(roomParameters, "background")
            .label("Color")
            .addColor(roomParameters?.background)
            .onUpdate((background) => {

                const payload = CURRENT_SPACE?.roomParameters;

                payload.enableSky = false;
                payload.background = background.toString()

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.BACKGROUND,
                    roomParameters: payload,
                });

            }).label("Set Color");

        const textureFolder = background
            .addFolder("Texture")
            .setVisible(roomParameters?.background_type !== "color")
            .onVisibleChange((visible) => {

                const payload = CURRENT_SPACE?.roomParameters;

                payload.background_type = visible ? "texture" : "color";

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.BACKGROUND_TYPE,
                    roomParameters: payload,
                });

                if (
                    Object.keys(roomParameters?.backgroundMap || {}).length === 0
                ) {
                    const backgroundMap = BACKGROUNDMAPS["day2"];

                    payload.backgroundMap = backgroundMap;
                    payload.applyEnvMapBackground = true;

                    uploaderSetRoomParameters({
                        type: UPLOADER_TYPES.APPLY_BACKGROUND,
                        roomParameters: payload,
                    });
                }

                colorFolder.setVisible(!visible, false);
            });

        const textureTypesList = {
            items: ["Sky", "Image"],
            textureType: roomParameters?.enableSky ? "Sky" : "Image"
        }

        textureFolder
            .add(textureTypesList, "textureType", textureTypesList.items)
            .label("Texture Type")
            .onChange(val => {
                const visible = val === "Sky"
                const payload = CURRENT_SPACE?.roomParameters

                payload.background_type = visible ? "texture" : "image"

                if (visible) {
                    payload.enableSky = true;
                } else {
                    payload.enableSky = false;
                }

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.SKY_ENABLED,
                    roomParameters: payload,
                });

                azimuth.setVisible(visible, false);
                rayleigh.setVisible(visible, false);
                turbidity.setVisible(visible, false);
                elevation.setVisible(visible, false);
                mieCoefficient.setVisible(visible, false);
                mieDirectionalG.setVisible(visible, false);

                presetBackgroundMap.setVisible(!visible, false);

                if (visible) {
                    textureImageEnvMap.setVisible(false, false);
                }

                if (val === "Image" && payload?.backgroundMap?.id === "custom") {
                    textureImageEnvMap.setVisible(true, false);
                } else {
                    textureImageEnvMap.setVisible(false, false);
                }

            });

        const onUpdateSkyOption = (name, value) => {
            const payload = CURRENT_SPACE?.roomParameters

            payload.skyOptions[name] = value

            uploaderSetRoomParameters({
                type: uploaderTypes[name],
                roomParameters: payload,
            });
        };

        const turbidity = textureFolder
            .add(roomParameters?.skyOptions, "turbidity")
            .min(0)
            .step(1)
            .max(12)
            .setVisible(roomParameters?.enableSky)
            .onUpdate((value) => onUpdateSkyOption("turbidity", value));

        const rayleigh = textureFolder
            .add(roomParameters?.skyOptions, "rayleigh")
            .min(0)
            .max(4)
            .step(0.01)
            .setVisible(roomParameters?.enableSky)
            .onUpdate((value) => onUpdateSkyOption("rayleigh", value));

        const mieCoefficient = textureFolder
            .add(roomParameters?.skyOptions, "mieCoefficient")
            .min(0)
            .max(0.1)
            .step(0.001)
            .setVisible(roomParameters?.enableSky)
            .onUpdate((value) => onUpdateSkyOption("mieCoefficient", value));

        const mieDirectionalG = textureFolder
            .add(roomParameters?.skyOptions, "mieDirectionalG")
            .min(0)
            .max(0.1)
            .step(0.001)
            .setVisible(roomParameters?.enableSky)
            .onUpdate((value) => onUpdateSkyOption("mieDirectionalG", value));

        const azimuth = textureFolder
            .add(roomParameters?.skyOptions, "azimuth")
            .min(-180)
            .max(180)
            .step(1)
            .setVisible(roomParameters?.enableSky)
            .onUpdate((value) => onUpdateSkyOption("azimuth", value));

        const elevation = textureFolder
            .add(roomParameters?.skyOptions, "elevation")
            .min(0)
            .max(90)
            .step(1)
            .setVisible(roomParameters?.enableSky)
            .onUpdate((value) => onUpdateSkyOption("elevation", value));



        const backgroundmap = [
            ...Object.values(BACKGROUNDMAPS)
                .filter((backgroundmap) => backgroundmap?.name)
                .map(({ id, name }) => ({ name, id })),
        ];

        const presetBackgroundMap = textureFolder
            .add(roomParameters, "backgroundMap", backgroundmap)
            .label("Preset Background")
            .setVisible(!roomParameters?.enableSky)
            .onUpdate((value) => {

                const payload = CURRENT_SPACE?.roomParameters

                payload.applyEnvMapBackground = value !== "none"

                const backgroundMap = value !== "none"
                    ? Object.values(BACKGROUNDMAPS).find(
                        (_backgroundmap) => _backgroundmap?.id == value
                    )
                    : null

                if (backgroundMap.id === "custom" && tempCustomBackgroundMap?.id === "custom") {
                    payload.backgroundMap = tempCustomBackgroundMap;
                } else {
                    payload.backgroundMap = backgroundMap;
                }

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.APPLY_BACKGROUND,
                    roomParameters: payload,
                });

                textureImageEnvMap.setVisible(
                    payload?.backgroundMap?.id === "custom", false
                );

            });

        const options = {
            customBackgroundMap:
                tempCustomBackgroundMap?.id === "custom" ? tempCustomBackgroundMap : {}
        };

        const textureImageEnvMap = textureFolder
            .add(options, "customBackgroundMap")
            .component("FileInput")
            .setFileSettings(fileSettings)
            .setVisible(
                roomParameters?.backgroundMap?.id === "custom" && !roomParameters?.enableSky
            )
            .onUpdate(({ blobURL, format, mimeType, name, action }) => {

                const payload = CURRENT_SPACE?.roomParameters

                payload.applyEnvMapBackground = true

                if (action === "delete") {

                    payload.backgroundMap = {
                        id: 'custom',
                        name: "Custom"
                    }

                } else {

                    payload.backgroundMap = {
                        name,
                        format,
                        mimeType,
                        id: "custom",
                        path: blobURL,
                        image: blobURL,
                    }

                }

                tempCustomBackgroundMap = payload.backgroundMap;
                options.customBackgroundMap = payload.backgroundMap;

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.APPLY_BACKGROUND,
                    roomParameters: payload,
                });

            });

        const floorFolder = gui
            .addFolder("Floor").group(true);

        const floorWaterFolder = floorFolder
            .addFolder("Water")
            .setVisible(roomParameters?.enableWater)
            .onVisibleChange((checked) => {

                const payload = CURRENT_SPACE?.roomParameters

                CURRENT_SPACE.roomParameters.enableWater = checked

                CURRENT_SPACE.roomParameters.enableReflector = false;

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_ENABLE_WATER,
                    roomParameters: payload,
                });

                floorReflectorFolder.setVisible(false, false);

            });

        const floorReflectorFolder = floorFolder
            .addFolder("Reflector")
            .setVisible(roomParameters?.enableReflector)
            .onVisibleChange((checked) => {

                const payload = CURRENT_SPACE.roomParameters

                CURRENT_SPACE.roomParameters.enableReflector = checked

                CURRENT_SPACE.roomParameters.enableWater = false

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_ENABLE_REFLECTOR,
                    roomParameters: payload,
                });

                floorWaterFolder.setVisible(false, false);

            });

        floorWaterFolder
            .add(roomParameters?.waterOptions, "color")
            .label("Color")
            .addColor(roomParameters?.waterOptions?.color)
            .onUpdate((color) => {

                const payload = CURRENT_SPACE.roomParameters

                payload.color = color.toString()

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_WATER_COLOR,
                    roomParameters: payload,
                });
            });

        floorWaterFolder
            .add(roomParameters?.waterOptions, "opacity")
            .label("Opacity")
            .min(0)
            .max(1)
            .step(0.01)
            .onUpdate((opacity) => {

                const payload = CURRENT_SPACE.roomParameters

                payload.waterOptions.opacity = opacity

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_WATER_OPACITY,
                    roomParameters: payload,
                });
            });

        floorWaterFolder
            .add(roomParameters?.waterOptions, "scale")
            .label("Scale")
            .min({ x: 1, z: 1 })
            .max({ x: 1000, z: 1000 })
            .step({ x: 0.1, z: 0.1 })
            .onUpdate((scale) => {

                const payload = CURRENT_SPACE.roomParameters

                payload.waterOptions.scale = scale

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_WATER_SCALE,
                    roomParameters: payload,
                });
            });

        floorWaterFolder
            .add(roomParameters?.waterOptions, "position")
            .label("Position")
            .step({ x: 0.1, y: 0.1, z: 0.1 })
            .onUpdate((position) => {

                const payload = CURRENT_SPACE.roomParameters

                payload.waterOptions.position = position

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_WATER_POSITION,
                    roomParameters: payload,
                });
            });

        floorReflectorFolder
            .add(roomParameters?.reflectorOptions, "color")
            .label("Color")
            .addColor(roomParameters?.reflectorOptions?.color)
            .onUpdate((color) => {
                const payload = CURRENT_SPACE?.roomParameters
                payload.reflectorOptions.color = color.toString()

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_COLOR,
                    roomParameters: payload,
                });
            });

        floorReflectorFolder
            .add(roomParameters?.reflectorOptions, "opacity")
            .label("Opacity")
            .min(0)
            .max(1)
            .step(0.01)
            .onUpdate((opacity) => {

                const payload = CURRENT_SPACE?.roomParameters

                payload.reflectorOptions.opacity = opacity

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_OPACITY,
                    roomParameters: payload,
                });
            });

        floorReflectorFolder
            .add(roomParameters?.reflectorOptions, "scale")
            .label("Scale")
            .min({ x: 1, z: 1 })
            .max({ x: 1000, z: 1000 })
            .step({ x: 0.1, z: 0.1 })
            .onUpdate((scale) => {

                const payload = CURRENT_SPACE?.roomParameters
                payload.reflectorOptions.scale = scale

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_SCALE,
                    roomParameters: payload,
                });
            });

        floorReflectorFolder
            .add(roomParameters?.reflectorOptions, "position")
            .label("Position")
            .step({ x: 0.1, y: 0.1, z: 0.1 })
            .onUpdate((position) => {

                const payload = CURRENT_SPACE?.roomParameters
                payload.reflectorOptions.position = position

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_POSITION,
                    roomParameters: payload,
                });
            });

        floorReflectorFolder
            .add(roomParameters?.reflectorOptions, "blur")
            .label("Blur")
            .onUpdate((checked) => {

                const payload = CURRENT_SPACE?.roomParameters
                // payload.reflectorOptions.blur = checked

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_BLUR,
                    roomParameters: payload,
                });
            });

        const normalMaps = [
            ...Object.values(NORMALMAPS)
                .filter((envmap) => envmap?.name)
                .map(({ id, name }) => ({ name, id })),
        ];

        floorReflectorFolder
            .add(roomParameters?.reflectorOptions?.normalmap, "enabled")
            .label("Normal Map")
            .onUpdate((checked) => {

                const payload = CURRENT_SPACE?.roomParameters

                payload.reflectorOptions.normalmap.enabled = checked

                reflectorStrength.setVisible(checked, false);
                reflectorTiles.setVisible(checked, false);
                imagesReflector.setVisible(checked, false);

                if (checked) {
                    uploaderSetRoomParameters({
                        type: UPLOADER_TYPES.FLOOR_REFLECTOR_BLUR,
                        roomParameters: payload,
                    });
                }

                if (
                    Object.keys(
                        payload?.reflectorOptions?.normalmap?.images || {}
                    ).length === 0
                ) {
                    const normalMap = NORMALMAPS["bump"];

                    payload.reflectorOptions.normalmap.images =
                        normalMap;

                    uploaderSetRoomParameters({
                        type: UPLOADER_TYPES.FLOOR_REFLECTOR_NORMAL_MAP_IMAGE,
                        roomParameters: payload,
                    });
                }

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_ENABLE_NORMAL_MAP,
                    roomParameters: payload,
                });

            });

        const reflectorStrength = floorReflectorFolder
            .add(roomParameters?.reflectorOptions?.normalmap, "strength")
            .setVisible(roomParameters?.reflectorOptions?.normalmap?.enabled)
            .label("Strength")
            .min(0.01)
            .max(1)
            .step(0.01)
            .onUpdate((strength) => {

                const payload = CURRENT_SPACE?.roomParameters

                payload.reflectorOptions.strength = strength

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_NORMAL_MAP_STRENGTH,
                    roomParameters: payload,
                });
            });

        const reflectorTiles = floorReflectorFolder
            .add(roomParameters?.reflectorOptions?.normalmap, "tiles")
            .setVisible(roomParameters?.reflectorOptions?.normalmap?.enabled)
            .label("Tiles")
            .min(0.1)
            .max(20)
            .step(0.1)
            .onUpdate((tiles) => {

                const payload = CURRENT_SPACE?.roomParameters

                payload.reflectorOptions.tiles = tiles

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_NORMAL_MAP_TILING,
                    roomParameters: payload,
                });
            });

        floorReflectorFolder
            .add(roomParameters?.reflectorOptions, "collision")
            .label("Collision")
            .onUpdate((checked) => {

                // const payload = CURRENT_SPACE?.roomParameters
                // payload.reflectorOptions.blur = checked

                // uploaderSetRoomParameters({
                //     type: UPLOADER_TYPES.FLOOR_REFLECTOR_BLUR,
                //     roomParameters: payload,
                // });
            });


        const imagesReflector = floorReflectorFolder
            .add(
                roomParameters?.reflectorOptions?.normalmap,
                "images",
                normalMaps
            )
            .setVisible(roomParameters?.reflectorOptions?.normalmap?.enabled)
            .label("Image")
            .onUpdate((value) => {

                const payload = CURRENT_SPACE.roomParameters

                const normalMaps = Object.values(NORMALMAPS).find(
                    (_normalMap) =>
                        _normalMap?.id == value
                )

                if (normalMaps.id === "custom" && tempReflectionNormalMap?.id === "custom") {
                    payload.reflectorOptions.normalmap.images = tempReflectionNormalMap;
                } else {
                    payload.reflectorOptions.normalmap.images = normalMaps;
                }

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_NORMAL_MAP_IMAGE,
                    roomParameters: payload,
                });

                floorCustomNormalMap.setVisible(
                    payload?.reflectorOptions?.normalmap?.images?.id === "custom", false
                )

            });

        const optionNormalMap = {
            normalMap2: tempReflectionNormalMap?.id === "custom" ? tempReflectionNormalMap : {},
        };

        const floorCustomNormalMap = floorReflectorFolder
            .add(optionNormalMap, "normalMap2")
            .label("Custom Image")
            .component("FileInput")
            .setFileSettings(fileSettings)
            .setVisible(roomParameters?.reflectorOptions?.normalmap?.images?.id === "custom")
            .onUpdate(({ blobURL, format, mimeType, name, action }) => {

                const payload = CURRENT_SPACE.roomParameters

                if (action === "delete") {

                    payload.reflectorOptions.normalmap.images = {
                        id: 'custom',
                        name: "Custom"
                    }

                } else {

                    payload.reflectorOptions.normalmap.images = {
                        name,
                        format,
                        mimeType,
                        id: "custom",
                        path: blobURL,
                        image: blobURL,
                    }

                }

                tempReflectionNormalMap = payload.reflectorOptions.normalmap.images;
                optionNormalMap.normalMap2 = payload.reflectorOptions.normalmap.images;

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FLOOR_REFLECTOR_NORMAL_MAP_IMAGE,
                    roomParameters: payload,
                });
            });


        const fogFolder = gui.addFolder("Fog");

        fogFolder
            .add(roomParameters?.fog, "enabled")
            .label("Enable")
            .onUpdate((checked) => {
                const payload = CURRENT_SPACE?.roomParameters
                payload.fog.enabled = checked

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FOG_ENABLED,
                    roomParameters: payload,
                });

                farFolder.setVisible(checked, false);
                nearFolder.setVisible(checked, false);
                far.setVisible(!checked, false);

            });

        const farFolder = fogFolder
            .add(roomParameters?.fog, "far")
            .label("Far")
            .min(0)
            .max(700)
            .step(1)
            .setVisible(roomParameters?.fog?.enabled)
            .onUpdate((far) => {
                const payload = CURRENT_SPACE?.roomParameters
                payload.fog.far = far;

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.FAR_FOG,
                    roomParameters: payload,
                });
            });

        const nearFolder = fogFolder
            .add(roomParameters?.fog, "near")
            .label("Near")
            .min(-100)
            .max(700)
            .step(20)
            .setVisible(roomParameters?.fog?.enabled)
            .onUpdate((near) => {
                const payload = CURRENT_SPACE?.roomParameters
                payload.fog.near = near;

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.NEAR_FOG,
                    roomParameters: payload,
                });

            });
    }

    // build list of postprocessings

    // add general folder


    // console.log("IS_FUTURE_GUI", IS_FUTURE_GUI)

    // console.log(CURRENT_SPACE?.roomParameters)
    // console.log(CURRENT_SPACE?.roomParameters)
    // console.log(CURRENT_SPACE?.roomParameters)

    // if (IS_FUTURE_GUI) {

    /*


        const isCyberCity = CURRENT_SPACE?.roomParameters.cybercity || CYBER_CITY

        const postProFolder = gui.addFolder("Post Processing")

        var postpros = [
            ...Object.values(POST_PROCESSINGS)
                .filter((postname) => postname?.name)
                .map(({ id, name }) => name),
        ];


        if(isCyberCity != true ){

            postpros = postpros.filter(element => !['CyberCity'].includes(element))

        }

        let configPostProFolders = {}

        postProFolder
            .add(roomParameters?.usePostProcessing, "enabled")
            .label("Enable")

            .onUpdate((checked) => {

                const payload = CURRENT_SPACE?.roomParameters
                payload.usePostProcessing.enabled = checked

                postProType.setVisible(checked, false)

                if (roomParameters.usePostProcessing.type == null) {

                    roomParameters.usePostProcessing.type = postpros[0]
                }

                if (roomParameters.usePostProcessing.value == null) {

                    roomParameters.usePostProcessing.value = POST_PROCESSINGS[postpros[0]].values
                }

                for (const property in configPostProFolders) {

                    configPostProFolders[property].setVisible(roomParameters.usePostProcessing.type == property && roomParameters?.usePostProcessing?.enabled, false);
                }

            })


        // add each post pro folder type

        const postProType = postProFolder

            .add(roomParameters.usePostProcessing, "type", postpros)

            .label("Type")

            .setVisible(roomParameters?.usePostProcessing?.enabled)

            .onUpdate((value) => {

                const payload = CURRENT_SPACE?.roomParameters

                payload.usePostProcessing.type = value

                for (const property in configPostProFolders) {

                    configPostProFolders[property].setVisible(roomParameters.usePostProcessing.type == property, false)
                }

                console.log(POST_PROCESSINGS)
                console.log(value)
                console.log(POST_PROCESSINGS[value])
                console.log(POST_PROCESSINGS[value].values)

                payload.usePostProcessing.value = POST_PROCESSINGS[value].values

                console.log(payload.usePostProcessing)


            })

        // bloom

        const bloom = postpros[0]

        configPostProFolders[bloom] = postProFolder
            .addFolder(bloom)
            .setVisible(roomParameters?.usePostProcessing?.enabled && roomParameters?.usePostProcessing?.type == bloom, false);

        let defaultConfig = POST_PROCESSINGS[bloom].values

        for (const property in defaultConfig) {

            const val = defaultConfig[property]

            configPostProFolders[bloom]
                .add(defaultConfig, property)
                .label(property)
                .min(0)
                .max(1)
                .step(0.01)
                .onUpdate(() => {

                    roomParameters.usePostProcessing.value = defaultConfig

                })
        }

        // luts

        const lutmap = [
            ...Object.values(LUTMAPS)
                .filter((lutmap) => lutmap?.name)
                .map(({ id, name }) => name),
        ];

        const luts = postpros[1]

        configPostProFolders[luts] =
            postProFolder.addFolder(luts)
                .setVisible(roomParameters?.usePostProcessing?.enabled && roomParameters.usePostProcessing.type == luts, false)

        let defaultLutConfig = POST_PROCESSINGS[luts].values

        configPostProFolders[luts]
            .add(defaultLutConfig, "image", lutmap)
            .label("texture")
            .name("texture")
            .onChange((lutmap) => {

                const payload = CURRENT_SPACE?.roomParameters

                console.log("payload", payload)

                const lutData = LUTMAPS[lutmap]

                payload.usePostProcessing.value.image = lutData

                // const payload = CURRENT_SPACE?.roomParameters
                // payload.applyEnvMapBackground = envmap !== "none"
                // payload.envMap = envmap !== "none"
                //     ? Object.values(ENVMAPS).find(
                //         (_envmap) => _envmap.name === envmap
                //     )
                //     : null

                // uploaderSetRoomParameters({
                //     type: UPLOADER_TYPES.APPLY_ENV_MAP,
                //     roomParameters: payload,
                // });
                lutImageCustom.setVisible(lutData?.id === "custom", false)

            });

        const customLutMap = { customMap: roomParameters?.usePostProcessing?.values?.customLutMap || {} };

        const lutImageCustom = configPostProFolders[luts]
            .add(customLutMap, "customMap")
            .label("customMap")
            .component("FileInput")
            .setFileSettings(fileSettings)
            .setVisible(roomParameters?.usePostProcessing?.values?.id === "custom")
            .onUpdate(({ blobURL, format, mimeType }) => {

                const payload = CURRENT_SPACE?.roomParameters


                payload.usePostProcessing.value.image  = {
                    format,
                    mimeType,
                    id: "custom",
                    path: blobURL,
                    image: blobURL,
                    name: "Custom"
                }


                // uploaderSetRoomParameters({
                //     type: UPLOADER_TYPES.APPLY_ENV_MAP,
                //     roomParameters: payload,
                // });
            });


        if( isCyberCity == true ) {

            const cybercity = postpros[2]

            configPostProFolders[cybercity] = postProFolder.addFolder(cybercity).setVisible(roomParameters?.usePostProcessing?.enabled && roomParameters.usePostProcessing.type == cybercity, false);

            let cybercityDefaultConfig = POST_PROCESSINGS[cybercity].values

            for (const property in cybercityDefaultConfig) {

                const val = cybercityDefaultConfig[property]

                configPostProFolders[cybercity]
                    .add(cybercityDefaultConfig, property)
                    .label(property)
                    .min(0)
                    .max(1)
                    .step(0.01)
                    .onUpdate(() => {

                        roomParameters.usePostProcessing.value = cybercityDefaultConfig

                    })
            }

        }

        */

    /*
    // lighing is disponible as a component
    if (!isFuture) {

        // lighting

        const lightingFolder =
            gui.addFolder("Lighting")

        const configLightingFolders = {};

        lightingFolder.add(roomParameters?.lighting, "enabled").label("Enable").onUpdate(checked => {
            const payload = CURRENT_SPACE?.roomParameters
            payload.lighting.enabled = checked

            for (const property in configLightingFolders) {
                configLightingFolders[property].setVisible(checked, false)
            }

        })

        configLightingFolders.lightingPosition = lightingFolder
            .add(roomParameters?.lighting, "lightPosition")
            .label('position')
            .setVisible(roomParameters?.lighting?.enabled)

        configLightingFolders.lightDirection =
            lightingFolder
                .add(roomParameters?.lighting, "lightDirection")
                .label('direction')
                .min({ x: -1, y: -1, z: -1 })
                .max({ x: 1, y: 1, z: 1 })
                .step({ x: 0.01, y: 0.01, z: 0.01 })
                .setVisible(roomParameters?.lighting?.enabled)

        configLightingFolders.lightIntensity =
            lightingFolder
                .add(roomParameters?.lighting, "intensity")
                .label('intensity')
                .min(0)
                .max(1)
                .step(0.01)
                .setVisible(roomParameters?.lighting?.enabled)

        configLightingFolders.lightSize =
            lightingFolder
                .add(roomParameters?.lighting, "size")
                .label('size')
                .min(500)
                .max(2000)
                .step(0.01)
                .setVisible(roomParameters?.lighting?.enabled)


        configLightingFolders.lightNear =
            lightingFolder
                .add(roomParameters?.lighting, "near")
                .label('near')
                .min(0)
                .max(3000)
                .step(1)
                .setVisible(roomParameters?.lighting?.enabled)


        configLightingFolders.lightFar =
            lightingFolder
                .add(roomParameters?.lighting, "far")
                .label('far')
                .min(0)
                .max(3000)
                .step(1)
                .setVisible(roomParameters?.lighting?.enabled)

        configLightingFolders.lightHelper =
            lightingFolder
                .add(roomParameters?.lighting, "helper")
                .label('helper')
                .setVisible(roomParameters?.lighting?.enabled);
    }
    */

    // player

    if (!isFuture) {
        const player = gui.addFolder("Player");

        player
            .add(roomParameters, "gravity")
            .min(0)
            .max(15)
            .onUpdate((gravity) => {
                const payload = CURRENT_SPACE?.roomParameters
                payload.gravity = gravity

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.GRAVITY,
                    roomParameters: payload,
                });

            });

        player
            .add(roomParameters, "playerSpeed")
            .min(1)
            .max(200)
            .onUpdate((playerSpeed) => {
                const payload = CURRENT_SPACE?.roomParameters;
                payload.playerSpeed = playerSpeed

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.PLAYER_SPEED,
                    roomParameters: payload,
                });
            });

        player
            .add(roomParameters, "jump")
            .min(0)
            .max(250)
            .onUpdate((jump) => {
                const payload = CURRENT_SPACE?.roomParameters;
                payload.jump = jump;

                uploaderSetRoomParameters({
                    type: UPLOADER_TYPES.JUMP,
                    roomParameters: payload,
                });

            });
            const renderer = gui.addFolder("Renderer");
        
            const far = renderer
                .add(roomParameters, "far")
                .min(300)
                .step(1)
                .max(2000)
                .setVisible(!roomParameters?.fog?.enabled)
                .onUpdate((far) => {
                    const payload = CURRENT_SPACE?.roomParameters
                    payload.far = far;
        
                    uploaderSetRoomParameters({
                        type: UPLOADER_TYPES.FAR,
                        roomParameters: payload,
                    });
                });
        
            const environnementTypesList = {
                items: ["Scene", "Image"],
                environnementType: roomParameters?.environnement_type === "scene" ? "Scene" : "Image"
            }
        
            renderer
                .add(environnementTypesList, "environnementType", environnementTypesList.items)
                .label("Environnement")
                .onChange(val => {
        
                    const imageVisible = val === "Image"
        
                    const payload = CURRENT_SPACE?.roomParameters
                    payload.environnement_type = imageVisible ? "image" : "scene"
        
                    if (imageVisible && Object.keys(roomParameters?.envMap || {}).length === 0) {
                        const envMap = ENVMAPS["studio"];
        
                        payload.envMap = envMap;
                        payload.applyEnvMapBackground = true;
        
                        uploaderSetRoomParameters({
                            type: UPLOADER_TYPES.APPLY_ENV_MAP,
                            roomParameters: payload,
                        });
                    }
        
                    uploaderSetRoomParameters({
                        type: UPLOADER_TYPES.ENVIRONNEMENT_TYPE,
                        roomParameters: payload,
                    });
        
                    environnementPosition.setVisible(!imageVisible, false);
                    environnementImage.setVisible(imageVisible, false);
                    environnementImageCustomEnv.setVisible(
                        roomParameters?.envMap?.id === "custom" && imageVisible, false
                    );
        
                });
        
        
            const environnementPosition = renderer
                .add(roomParameters, "environnement_position")
                .step({ x: 0.1, y: 0.1, z: 0.1 })
                .setVisible(roomParameters?.environnement_type === "scene")
                .label("Position")
        
                .onUpdate((environnement_position) => {
                    const payload = CURRENT_SPACE?.roomParameters
                    payload.environnement_position = environnement_position
        
                    uploaderSetRoomParameters({
                        type: UPLOADER_TYPES.ENVIRONNEMENT_POSITION,
                        roomParameters: payload,
                    });
                });
        
            const environnementImage = renderer
                .add(roomParameters, "envMap", envmap)
                .setVisible(roomParameters?.environnement_type === "image")
                .label("Preset Image")
                .name("environment")
                .onChange((value) => {
        
                    const payload = CURRENT_SPACE?.roomParameters
                    payload.applyEnvMapBackground = value !== "none"
        
                    const envMap = value !== "none"
                        ? Object.values(ENVMAPS).find(
                            (_envmap) => _envmap.id === value
                        )
                        : null
        
                    if (envMap.id === "custom" && tempCustomEnvMap?.id === "custom") {
                        payload.envMap = tempCustomEnvMap;
                    } else {
                        payload.envMap = envMap;
                    }
        
                    uploaderSetRoomParameters({
                        type: UPLOADER_TYPES.APPLY_ENV_MAP,
                        roomParameters: payload,
                    });
        
                    environnementImageCustomEnv.setVisible(
                        payload?.envMap?.id === "custom", false
                    );
        
                });
        
            const optionEnvMap = {
                envMap2: tempCustomEnvMap?.id === "custom" ? tempCustomEnvMap : {}
            };
        
            const environnementImageCustomEnv = renderer
                .add(optionEnvMap, "envMap2")
                .component("FileInput")
                .setFileSettings(fileSettings)
                .setVisible(roomParameters?.envMap?.id === "custom" && roomParameters?.environnement_type === "image")
                .onUpdate(({ blobURL, format, mimeType, name, action }) => {
        
                    const payload = CURRENT_SPACE?.roomParameters
        
                    payload.applyEnvMapBackground = true
        
                    if (action === "delete") {
                        //
                        payload.envMap = {
                            id: 'custom',
                            name: "Custom"
                        }
        
                    } else {
        
                        payload.envMap = {
                            name,
                            format,
                            mimeType,
                            id: "custom",
                            path: blobURL,
                            image: blobURL,
                        }
        
                    }
        
                    tempCustomEnvMap = payload.envMap;
                    optionEnvMap.envMap2 = payload.envMap;
        
                    uploaderSetRoomParameters({
                        type: UPLOADER_TYPES.APPLY_ENV_MAP,
                        roomParameters: payload,
                    });
                });
    }


    const placeholdersFolder = gui.addFolder("Placeholders");

    placeholdersFolder
        .add(roomParameters, "showPlaceholders")
        .label("Visible")
        .onUpdate((visible) => {

            const payload = CURRENT_SPACE?.roomParameters
            payload.showPlaceholders = visible

            uploaderSetRoomParameters({
                type: UPLOADER_TYPES.SHOW_PLACEHOLDERS,
                roomParameters: payload,
            });
        });

   

    // save settings 


    CURRENT_SPACE.roomParameters.saveOptions = Object.assign({}, saveSettings)

    const saveOptions = gui.addFolder('Save options')

    saveOptions
        .add(roomParameters.saveOptions, "draco")
        .label("Draco Compression")
    
    saveOptions
        .add(roomParameters.saveOptions, "geometrySimplifier")
        .label("Geometry Simplifier")
    
    saveOptions
        .add(roomParameters.saveOptions, "weld")
        .label("Weld Geometry")
       


  
    // const cinematicFolder = gui.addFolder("Cinematic");

    // cinematicFolder
    //     .add(target, "handleCinematic")
    //     .name("Cinematic mode")
    //     .label("Switch");

}
