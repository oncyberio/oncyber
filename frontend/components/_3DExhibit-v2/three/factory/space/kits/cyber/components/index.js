// @ts-check

import { Component3D } from "@3factory/space/kits/abstract";
import { BackgroundComponent } from "./backrground";
import { FogComponent } from "./fog";
// import { GridComponent } from "./grid";
import { MeshComponent } from "./mesh";
import { ReflectorComponent } from "./reflector";
import { WaterComponent } from "./water";
import { RainComponent } from "./rain";
import { SpawnComponent } from "./spawn";
import { LightingComponent } from "./lighting";
import { TerrainComponent } from './terrain';
import { PostProcessingComponent } from "./postprocessing";
import { PhysicsComponent } from "./physics";
import { EnvmapComponent } from "./envmap";
import { CameraComponent } from "./camera";
import { PlaceholderComponent } from "./placeholder";

/**
 *
 * @type { Array<typeof Component3D> }
 **/
export const components = [
    BackgroundComponent,
    //GridComponent,
    WaterComponent,
    ReflectorComponent,
    TerrainComponent,
    SpawnComponent,
    LightingComponent,
    PostProcessingComponent,
    FogComponent,
    RainComponent,
    EnvmapComponent,
    CameraComponent,
    PhysicsComponent,
    MeshComponent,
    PlaceholderComponent,
]

/**
 * @typedef { Array<import("@3factory/space/kits/types").FactoryOption> } FactoryOptions
 * 
 * @type { { scene: FactoryOptions, triggerZone: FactoryOptions } }
 **/
export const factoryOptions = {
    scene: [],
    triggerZone: [],
}


components.forEach(c => {

    const info = c.getInfo()

    const group = info.group || "scene"

    let groupOptions = factoryOptions[group]

    if(groupOptions == null) {
        //
        groupOptions = factoryOptions[group] = []
    }

    // const presets = c.getPresets()

    // if(presets.length === 0) {
        groupOptions.push({
            type: "@@Component",
            factory: c,
        })
    // }

    // return {
    //     type: "@@Group",
    //     name: c.getInfo().title,
    //     image: c.getInfo().image,
    //     components: presets.map(p => ({
    //         type: "@@Component",
    //         factory: c,
    //         preset: p,
    //     }))
    // }

})
