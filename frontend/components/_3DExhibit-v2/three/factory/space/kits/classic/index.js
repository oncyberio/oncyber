// @ts-check

import { AnimationMixer, Box3, Object3D } from 'three'

import Loader from '@3loader'
import { prepareRoomTextureUpgrade } from '@3utils/roomTextureUpgradeController'
import { selectRoomModelSource, publishRoomModelSource, classicRoomModelOptions, roomModelFallbacks } from '@3utils/roomModelSource'
import { loadRoomModel } from '@3utils/loadRoomModel'

import { EDIT_MODE, ERROR_CODES, GPU_TIER } from '@3constants'

import { PortalPlaceholderFactory } from '@3portal/index'

import { Space } from '@3factory/space/space'

import Reflector from '@3factory/reflector'


import {

    UPLOADER_MODE,

    
    
    DISABLE_REFLECTOR,

    IS_MOBILE,

    COMPRESSED_SUPPORT

} from '@3constants'

import { SpaceFloor } from '@3factory/space/spacefloor'

import WaterFactory from '@3factory/water'


import BackgroundFactory from '@3factory/background'
import { applyWorldMod } from '@features/worldMods'


import {

    BillboardYMaterial,

} from '@3xtend'

import Events from "@components/_3DExhibit-v2/three/events/events";

import Emitter from "@3emitter";

import LightFactory from '@3factory/lighting'

import SpaceFactoryAbstract from '@3factory/abstract/spacefactory.js'


function getFirstChildrenNode(scene, name){

    let i = 0

    let node = null

    while( i < scene.children.length ) {

        if( scene.children[i].name.toLowerCase() == name ){

            node = scene.children[i]
        }

        i++
    }

    return node
}


class ClassicSpaceFactory extends SpaceFactoryAbstract {

    /**
     *
     * @param { import('@gltypes').World3DOptions } opts
     * @returns { Promise<import('@gltypes').SpaceData> }
     */
     get(opts) {

        return new Promise( async (resolve, reject)=>{

            const modelOptions = classicRoomModelOptions({
                preferLowResolution: opts.preferLowResolution,
                gpuTier: GPU_TIER.path,
                isMobile: IS_MOBILE,
                compressedSupport: COMPRESSED_SUPPORT,
                skin: opts.exhibit.info?.currentSkin,
                editing: EDIT_MODE || UPLOADER_MODE,
            })
            let modelSource = selectRoomModelSource(opts.roomParameters, modelOptions)
            var url = modelSource.url
            publishRoomModelSource(modelSource)
            const isEditMode = opts.roomParameters.uPath?.fileURL == null
            if (modelSource.source === "skin") opts.roomParameters.background = modelSource.background

            // The background (sky, image or HDR) needs nothing from the model:
            // load it while the model downloads and parses.
            const backgroundReady = this.getBackgroundDisplay( opts )
            void backgroundReady.catch(() => {})

            if( UPLOADER_MODE && isEditMode == false  ) {

                try{

                    const { default: Optimiser } = await import('@3modules/optimiser')
                    url = await Optimiser.fetchAndReorder(url)

                } catch(err) {

                    console.error(err)

                    reject({
                        code: ERROR_CODES.INVALID_MODEL,
                        value: err
                    })
                    return;
                }
            }


            let textureUpgrade = null
            // An uploaded (or re-optimised) file has no alternatives to fall back to.
            const fallbacks = url === modelSource.url ? roomModelFallbacks(opts.roomParameters, modelOptions, modelSource) : []
            loadRoomModel(fileUrl => Loader.loadGLTF( fileUrl, true ), { ...modelSource, url }, fallbacks).then(async ({ result: res, source })=>{
                if (source.url !== url) {
                    modelSource = source
                    publishRoomModelSource(modelSource)
                }
                textureUpgrade = prepareRoomTextureUpgrade(opts, modelSource, res.scene)

                 // add debug if there is
                this.addDebug( res )
                
          
                let background = await backgroundReady

                let backgroundMesh = BackgroundFactory.get( background )

                // This world's own code, if it has any (features/worldMods)
                applyWorldMod( opts.roomParameters?.slug, { background: backgroundMesh, mobile: IS_MOBILE } )



                const colliderMeshes = []

                const placeholders = []

                const floorMeshes = []

                let portalMeshes = {};

                res.scene.traverse((mesh) => {

                    if (mesh.name.includes("Portal_Mesh_") || mesh.name.includes("Portal_Door_")) {

                        portalMeshes[mesh.name] = mesh;
                    }
                })




                const grassNode          = getFirstChildrenNode( res.scene, 'grass' )

                grassNode?.traverse?.( ( child ) => {

                   if( child.material ){

                       child.material = new BillboardYMaterial(child.material)
                   }
                })


                const displayNode             = getFirstChildrenNode( res.scene, 'display')

                // ====> FLOOR NODE

                const floorNode               = getFirstChildrenNode( res.scene, 'floor')

                const floorInvisibleNode      = getFirstChildrenNode( res.scene, 'floor_invisible' )



                let visibleFloors = []

                floorNode?.traverse?.( ( child ) => {

                   if( child.material ){

                       floorMeshes.push( child )

                       visibleFloors.push(child)

                       colliderMeshes.push(child)
                    }
                })


                // ===> INVISIBLE FLOOR NODE

                floorInvisibleNode?.traverse?.( ( child ) => {

                    if( child.material ){

                        floorMeshes.push( child )

                        colliderMeshes.push( child )

                        child.visible = false
                    }

                })

                res.scene.remove(floorInvisibleNode)



                // ====> COLLISION NODE\

                const collisionNode  = getFirstChildrenNode(res.scene, 'collision')

                collisionNode?.traverse( ( child ) => {

                    if( child.material ){

                        colliderMeshes.push(child)

                    }
                })


                // ====> COLLISION INVISIBLE NODE

                const collisionInvisibleNode  = getFirstChildrenNode(res.scene, 'collision_invisible')

                collisionInvisibleNode?.traverse( ( child ) => {

                    if( child.material ){

                        colliderMeshes.push(child)

                    }

                    child.visible = false
                })


                // ====> PLACEHOLDER NODE

                const placeholderNode         = getFirstChildrenNode(res.scene, 'placeholder')

                if(UPLOADER_MODE && !(this.isSafeSpace([displayNode,floorNode,floorInvisibleNode,placeholderNode,collisionInvisibleNode,collisionNode]))){

                    Emitter.emit(Events.CUSTOM, {

                        type: Events.ERROR,

                        value:  { code:ERROR_CODES.INVALID_TRANSFORM }

                    })
                }

                placeholderNode?.traverse?.( ( child ) => {

                    if( child.material ){

                        placeholders.push( child )
                    }

                })


                placeholders.forEach(p => {

                    p.parent.remove(p)
                })


                if(UPLOADER_MODE && !(this.isSafeSpace([displayNode,floorNode,floorInvisibleNode,placeholderNode,collisionInvisibleNode,collisionNode]))){
                    Emitter.emit(Events.ERROR_UPLOADER, {code:ERROR_CODES.INVALID_TRANSFORM})
                }


                let cubeMap = await this.setupPBR( res.scene , opts, backgroundMesh )

                // }

                const portalPlaceholders = PortalPlaceholderFactory.get(res, portalMeshes)

                portalMeshes = null

                res.scene.animations = res.animations;
                const mixer = new AnimationMixer(res.scene);

                res.animations.forEach((animation) => {
                    const action = mixer.clipAction(animation);
                    action.play();
                });

                let floors = floorMeshes.map(mesh => {

                    let floor = new SpaceFloor({
                        ...opts,
                        // @ts-ignore
                        raycastMesh: mesh
                    })

                    floor.add(mesh)

                    return floor

                })

                let spaceFloorContainer = new Object3D()

                spaceFloorContainer.name = 'floor'

                if(floors?.length) {

                    spaceFloorContainer.add(...floors)

                    res.scene.add(spaceFloorContainer)
                }

                let far =  opts.roomParameters?.far || this.getFarValue(res.scene)

                /** @type { Space & Record<string, any> } */
                const scene = new Space({ scene: res.scene, background: backgroundMesh })

                if( !DISABLE_REFLECTOR && opts.roomParameters && opts.roomParameters.enableWater == true ){

                    const water = WaterFactory.get( opts )

                    scene.add(water)

                    scene.water = water

                }

                if( !DISABLE_REFLECTOR && opts.roomParameters && opts.roomParameters.enableReflector == true ){

                    const reflector = Reflector.getRaw( opts )

                    if( opts.roomParameters.reflectorOptions.collision == true ) {

                        colliderMeshes.push( reflector )

                    }

                    scene.add(reflector)

                    scene.reflector = reflector

                }

                const lighting = LightFactory.get( opts.roomParameters?.lighting, scene )

                scene.add( lighting )

                scene.lighting = lighting

                const cameras = res.cameras || []

                let fog = this.getFog( background, far, opts )

                scene.fog = fog

                textureUpgrade?.attach(scene)

                resolve ({
                    scene,
                    mixer,
                    colliders: colliderMeshes,
                    placeholders,
                    portalPlaceholders,
                    background,
                    cubeMap,
                    floors,
                    far,
                    bbox    : new Box3().setFromObject(res.scene),
                    cameras : cameras,
                    fog     : fog,
                    // Which file arrived (tier, day/night): load timings report it.
                    modelSource,
                })
            }).catch(error => {
                textureUpgrade?.dispose()
                reject(error)
            })
        })
    }

}

export default new ClassicSpaceFactory()
