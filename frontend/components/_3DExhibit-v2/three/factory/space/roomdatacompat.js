// @ts-check
import { getBackgroundDataFromRoom, getDefaultBackgroundData, updateRoomParamsFromBackgroundData } from "./kits/cyber/components/backrground/data"
import { getCameraDataFromRoom, getDefaultCameraData, updateRoomParamsFromCameraData } from "./kits/cyber/components/camera/data"
import { getDefaultEnvmapData, getEnvmapDataFromRoom, updateRoomParamsFromEnvmapData } from "./kits/cyber/components/envmap/data"
import { getFogDataFromRoom, updateRoomParamsFromFogData } from "./kits/cyber/components/fog/data"
import { getDefaultGridData } from "./kits/cyber/components/grid/data"
import { getLightingDataFromRoom, updateRoomParamsFromLightingData } from "./kits/cyber/components/lighting/data"
import { getDefaultPhysicsData, getPhysicsDataFromRoom, updateRoomParamsFromPhysicsData } from "./kits/cyber/components/physics/data"
import { getPostProcessingDataFromRoom, updateRoomParamsFromPostProcessingData } from "./kits/cyber/components/postprocessing/data"
import { getReflectorDataFromRoom, updateRoomParamsFromReflectorData } from "./kits/cyber/components/reflector/data"
import { getDefaultSpawnData, getSpawnDataFromRoom, updateRoomParamsFromSpawnData } from "./kits/cyber/components/spawn/data"
import { getDefaultGridTerrain } from "./kits/cyber/components/terrain/data"
import { getWaterDataFromRoom, updateRoomParamsFromWaterData } from "./kits/cyber/components/water/data"


export function getDefaultCyberkitDataFromRoom(room, data) {
    //
    const defData = {}

    if(data.background == null) {

        defData.background = getBackgroundDataFromRoom(room)
    }

    if(data.spawn == null) {

        defData.spawn = getSpawnDataFromRoom(room)
    }

    if (data.physics == null) {

        defData.physics = getPhysicsDataFromRoom(room)
    }

    if (data.envmap == null) {

        defData.envmap = getEnvmapDataFromRoom(room)
    }

    if (data.camera == null) {

        defData.camera = getCameraDataFromRoom(room)
    }

    if(data.reflector == null && data.water == null ) {

        if(room.enableWater) {

            defData.water = getWaterDataFromRoom(room)
        }
        else if(room.enableReflector) {

            defData.reflector = getReflectorDataFromRoom(room)
        }
    }

    if (data.fog == null && room.fog?.enabled) {

        defData.fog = getFogDataFromRoom (room)
    }

    if (data.lighting == null && room.lighting?.enabled) {

        defData.lighting = getLightingDataFromRoom(room)
    }

    if (data.postprocessing == null && room.usePostProcessing?.enabled) {

        defData.postprocessing = getPostProcessingDataFromRoom(room)
    }

    return defData
}

export function updateRoomFromData(room, data) {

    updateRoomParamsFromBackgroundData(room, data.background)

    updateRoomParamsFromFogData(room, data.fog)

    updateRoomParamsFromWaterData(room, data.water)

    updateRoomParamsFromReflectorData(room, data.reflector)

    updateRoomParamsFromLightingData(room, data.lighting)

    updateRoomParamsFromPostProcessingData(room, data.postprocessing)

    updateRoomParamsFromSpawnData(room, data.spawn)

    updateRoomParamsFromPhysicsData(room, data.physics)

    updateRoomParamsFromEnvmapData(room, data.envmap)

    updateRoomParamsFromCameraData(room, data.camera)
}


export function getDefaultEmptyRoomData() {
    //

    const terrain = getDefaultGridTerrain()
    
    return {
        [terrain.id]: terrain,
        background: getDefaultBackgroundData(),
        spawn: getDefaultSpawnData(),
        physics: getDefaultPhysicsData(),
        envmap: getDefaultEnvmapData(),
        camera: getDefaultCameraData(),
    };
}
