// @ts-check

import { AnimationMixer, Box3, BoxHelper, Mesh, MeshStandardMaterial, Texture, Vector2, Vector3, MeshBasicMaterial, Skeleton } from "three"

import loader from "@3loader"

import Camera from "@3camera"

import { disposeObject3D, upgradeObject } from "@3utils/three"

import { getScaleCorrection, shouleCenterModel } from "./utils"

import { toNum } from "@utils/js"

import { COMPRESSED_SUPPORT, DEBUG, IS_MOBILE, SET_IS_LEGACYGLTF_LOADER, USER_HEIGHT, PERF_SCORES, EDITION_TRANSFORM_CONTROL } from "@3constants"


import {

    MODEL_MEDIA
}
from "@3utils/mediatype"


import { SpaceArtwork } from "../../abstract"

import { PlayController } from "../../controllers/PlayController"

import ModelFactoryManager from './modelmanager'
import { selectModelVariant } from './selectModelVariant'
import { AVATAR_ANIMATIONS, getAvatarAnimation, getAvatarSource } from './avatarAnimations'


const MAX_TEXTURE_SIZE = 2048 * 2048

export class ModelSpaceArtwork extends SpaceArtwork {

    /**
     * @param { import("@gltypes").SpaceArtworkOptions } opts
     */
    constructor(opts) {

        super({ 
            ...opts,
            mixer: {
                // @ts-ignore
                update: (dt) => {
                    this.mixer?.update(dt)
                }
            }
        })

        this.item = opts.item

        this.paused = true

        this.scene = null

        this.isAvatarModel = false
        this.avatarAnimationOptions = []

        /** @type { Record<string, any> } */
        this.activeAnimations = { ...this.item.animations }

        this.playController = new PlayController({
            ...opts,
            media: this,
            artwork: this,
            isGlobal: false
        })

        this.add(this.raycastMesh)

        this.actions = {}


        this.isModelSpaceArtwork = true

        this.prefTransformControls = EDITION_TRANSFORM_CONTROL.TRANSFORM_3D
    }

    get renderMesh() {

        return this.scene
    }

    get isVisibleToCamera() {

        return Camera.isObjectVisible(this.raycastMesh)
    }

  

    async load() {

        const srcUrl = this.getModelUrl()

        this.srcUrl = srcUrl

        const res = (await ModelFactoryManager.load( srcUrl, this.opts ))

        this.sourceGltf = res
        this.isAvatarModel = !!res.userData?.vrm?.humanoid
        this.avatarAnimationOptions = this.isAvatarModel ? AVATAR_ANIMATIONS : []
        if (this.isAvatarModel && this.item.animations == null) {
            this.activeAnimations = { "avatar:idle": true }
        }
        const avatarClips = this.isAvatarModel
            ? (await Promise.all(Object.keys(this.activeAnimations).map(name => getAvatarAnimation(res, name)))).filter(Boolean)
            : []
        const object = this.cloneGltf(res.scene, [...res.animations, ...avatarClips])
        
     
        // let clonedMats = {}
        object.scene.traverse((child)=>{

            if( child.material ) {

                const uuid = child.material.uuid

                child.material =  child.material.clone()

            }
        })

        upgradeObject(object.scene)

        this.object = object
    
        if (this.wasDisposed) return

        if (this.scene != null) {

            this.disposeScene()
        }

        // object
        if (this.wasDisposed) return

        object.scene.updateMatrixWorld()

        let box = new Box3().setFromObject(object.scene, true)

        let localSize = new Vector3();

        box.getSize(localSize)

        const scaleCorrection = getScaleCorrection(this.userData);

        object.scene.scale.set(scaleCorrection, scaleCorrection, scaleCorrection)


        if(shouleCenterModel(this.opts.item)) {

            box.setFromObject(object.scene);

            const center = new Vector3()

            box.getCenter(center);

            object.scene.position.x -= center.x;
            object.scene.position.y -= center.y;
            object.scene.position.z -= center.z;
        }
        this.raycastMesh.scale.set(localSize.x, localSize.y, localSize.z).multiplyScalar(scaleCorrection)

        if( object.animations.length > 0 || this.isAvatarModel ) {

            this.mixer = new AnimationMixer(object.scene)
            this.mixer.timeScale = 0
        }

        this.scene = object.scene

        // @ts-ignore
        this.scene.mediaType = MODEL_MEDIA


        this.add(object.scene)

        this.animations = object.animations.slice()

        this.add(this.scene)

        // adjust the default ui to scale factor
        let adjFactor = (USER_HEIGHT / localSize.y) * 1 / scaleCorrection

        this.uiScaleFactor *= 1 / adjFactor

        const scale = this.userData.scale

       if(scale?.x) {

            this.scale.set(
                toNum(scale?.x, 1),
                toNum(scale?.y, 1),
                toNum(scale?.z, 1)
            );

       }
       else {
            // set the initial scale of the model to match user height
            this.scale.set(adjFactor, adjFactor, adjFactor)
       }

       // Evaluate the initial pose before showing the mesh or measuring its feet.
       this.syncAnimations()
       this.mixer?.update(0)
       this.scene.updateMatrixWorld(true)
       this.update3D()

       if (process.env.NODE_ENV === "development") {
        
            this.getPerfScore()
       }
    }

    update3D() {


        this.update()

        this.updateEnvMap()
    }

    
    getModelUrl() {
      //
      let asset = this.userData

      // General model optimization strips VRM humanoid metadata. Library avatars
      // must keep their rigged source so saved motions can be retargeted on reload.
      const avatarSource = getAvatarSource(asset)
      if (avatarSource) return avatarSource

      const srcUrl = selectModelVariant(asset.d_optimized_files, {
        isMobile: IS_MOBILE,
        compressedSupport: COMPRESSED_SUPPORT,
        preferLowResolution: this.opts.preferLowResolution,
        fromEdit: this.opts.fromEdit,
      }) ||
        this.opts.overrideUrl ||
        this.fileStoredUrl(asset) ||
        asset.dcompressed_animation_url ||
        asset.compressed_animation_url ||
        asset.animation_url ||
        asset.animation_original_url ||
        asset.original_animation_url

      return srcUrl
    }

    fileStoredUrl(asset) {

      return asset?.files?.find?.(({ type, compressed_url, url }) => {
          if (type === asset.mime_type) {
              return true
          }
      })?.url
    }

    update () {

        let shouldPlay = this.isVisibleToCamera &&  this.inPlayRange()

        if(shouldPlay) {

            this.play()
        }
        else {

            this.pause()
        }

        this.raycastMesh.visible = this.userData.isCollider === true ? Camera.isEditing : false

    }


    async prepareAnimations(selection) {
        if (!this.isAvatarModel) return
        const prepared = await Promise.all(Object.keys(selection)
            .filter(name => selection[name] && !this.animations.some(clip => clip.name === name))
            .map(name => getAvatarAnimation(this.sourceGltf, name)))
        if (this.wasDisposed) return
        for (const clip of prepared.filter(Boolean)) {
            if (!this.animations.some(existing => existing.name === clip.name)) this.animations.push(clip)
        }
    }

    syncAnimations() {
        for (const animation of this.animations || []) {
            const name = animation.name
            if (this.activeAnimations[name]) {
                this.actions[name] ||= this.mixer.clipAction(animation)
                this.actions[name].play()
            } else {
                this.actions[name]?.stop()
            }
        }
    }

    play() {
        if (!this.paused) return
        this.paused = false
        if (this.mixer) this.mixer.timeScale = 1
        this.syncAnimations()
    }

    pause() {
        if (this.paused) return
        this.paused = true
        if (this.mixer) this.mixer.timeScale = 0
    }

    playAnimation(name) {
        this.activeAnimations[name] = true
        this.syncAnimations()
    }

    stopAnimation(name) {
        delete this.activeAnimations[name]
        this.syncAnimations()
    }

    _perfScore = null

    _stats = null

    /**
     * @return { import("@3constants").PERF_SCORE }
     * */
    getPerfScore() {

        if(this._perfScore == null) {

            let nbVertices = 0

            let pbrMaterials = 0

            let nbTextures = 0

            let maxTextureSize = 0


            let drawCalls = 0

            this.scene.traverse(obj => {
                
                if(obj instanceof Mesh) {

                    drawCalls++

                    const geometry = obj.geometry;
                    const material = obj.material
                    // @ts-ignore
                    const texture = material?.map;
                    const animations = obj.animations;

                    if(geometry) {

                        nbVertices += obj.geometry.attributes.position.count
                    }

                    if(material) {

                        // @ts-ignore
                        if(material.type == 'MeshStandardMaterial') {

                            pbrMaterials++
                        }

                        // @ts-ignore
                        [material.map, material.emissiveMap, material.normalMap].forEach(texture => {

                            if(texture) {

                                nbTextures ++

                                const width = texture.source.data.width || 0

                                const height = texture.source.data.height || 0

                                maxTextureSize = Math.max(width * height, maxTextureSize)
                            }
                        })
                    }
                }
            })

            const nbActiveAnimations = Object.keys(this.item.animations || {}).reduce((acc, key) => {

                return this.item.animations[key] ? 1 : 0
            }, 0)

            this._perfScore = PERF_SCORES.LOW

            if(pbrMaterials > 1 || nbVertices > 10000 || nbTextures > 1) {

                this._perfScore = PERF_SCORES.MEDIUM
            }

            if(pbrMaterials > 3 || drawCalls > 5 || nbVertices > 20000 || nbActiveAnimations > 0 || nbTextures > 2 || maxTextureSize > MAX_TEXTURE_SIZE) {

                this._perfScore = PERF_SCORES.HIGH
            }

            this._stats = {

                nbVertices,

                pbrMaterials,

                nbTextures,

                maxTextureSize,

                drawCalls
            }


        }

        return this._perfScore
    }

    updateEnvMap() {

        if(this.opts.space.cubeMap == null) return

        this.traverse((child) => {

            this._updateChildeMaterial(child, this.userData.envmapIntensity)
        })
    }

    _updateChildeMaterial(child, envmapIntensity) {


        if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
            // child.material.map.colorSpace = SRGBColorSpace;

            if(envmapIntensity == 0) {

                child.material.envMap = null;

                child.material.envMapIntensity = 1;
            }
            else {

                child.material.envMap = this.opts.space.cubeMap;

                child.material.envMapIntensity = envmapIntensity;
            }

            child.material.needsUpdate = true;
        }
    }

    disposeScene() {

        if (this.scene == null) return

        this.playController.dispose()
        this.mixer?.stopAllAction()
        this.mixer?.uncacheRoot(this.scene)
        this.sourceGltf = null

        const materials = new Set()
        this.scene.traverse(child => {
            if (child.isSkinnedMesh) child.skeleton.dispose()
            if (child.material) {
                for (const material of (Array.isArray(child.material) ? child.material : [child.material])) materials.add(material)
            }
        })
        const disposable = ModelFactoryManager.dispose(this.scene, this.srcUrl, this.opts )

        // set as disposable ressource if last occurence

        if( disposable ) {

            this.resources[1] = this.object.scene

        }

        if (!disposable) {
            // Materials belong to this clone; textures and geometry remain shared.
            materials.forEach(material => material.dispose())
        }
        this.remove(this.scene)
    }

    dispose() {

        if (this.wasDisposed) return

        this.disposeScene()

        super.dispose()
    }

    cloneGltf(scene, animations) {
      const clone = {
        animations: animations,
        scene: scene.clone(true)
      };

      const skinnedMeshes = {};

      scene.traverse(node => {
        if (node.isSkinnedMesh) {
          skinnedMeshes[node.name] = node;
        }
      });

      const cloneBones = {};
      const cloneSkinnedMeshes = {};

      clone.scene.traverse(node => {
        if (node.isBone) {
          cloneBones[node.name] = node;
        }

        if (node.isSkinnedMesh) {
          cloneSkinnedMeshes[node.name] = node;
        }
      });

      for (let name in skinnedMeshes) {
        const skinnedMesh = skinnedMeshes[name];
        const skeleton = skinnedMesh.skeleton;
        const cloneSkinnedMesh = cloneSkinnedMeshes[name];

        const orderedCloneBones = [];

        for (let i = 0; i < skeleton.bones.length; ++i) {
          const cloneBone = cloneBones[skeleton.bones[i].name];
          orderedCloneBones.push(cloneBone);
        }

        cloneSkinnedMesh.bind(
            new Skeleton(orderedCloneBones, skeleton.boneInverses),
            cloneSkinnedMesh.matrixWorld);
      }

      return clone;
    }
}
