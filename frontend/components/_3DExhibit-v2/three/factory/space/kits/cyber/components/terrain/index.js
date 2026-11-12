// @ts-check

import {
    PlaneGeometry,
    BoxGeometry,
    MeshBasicMaterial,
    Mesh,
    SRGBColorSpace,
    BufferGeometry,
    BufferAttribute,
    MeshStandardMaterial,
    LinearFilter,
    LinearMipmapLinearFilter,
    RepeatWrapping,
} from "three";

import PipeLineMesh from "@3abstract/pipelinemesh";

import { Component3D } from "@3factory/space/kits/abstract";

import {
    getDefaultData,
    textureOpts,
    MODES,
    SHADERS,
    presetImages,
    terrainPresets,
} from "./data";

import gsap from "gsap";

const THROTTLE_SPEED = 0.5;

import WorkerFloor from "./floor.worker.js";

import Scene from "@3scene";

import Loader from "@3loader";

import Emitter from "@3emitter";

import GridMaterial from "./shaders/grid/diffuse.js";

import GridMaterialLighting from "./shaders/grid/lighting.js";

import { capitalize } from "@utils/js";

import BiplanarMaterial from './shaders/biplanar/diffuse.js'
import BiplanarLightingMaterial from './shaders/biplanar/lighting.js'

import {

    SET_SHADOW_NEEDS_UPDATE

} from '@3constants'


export const SHADERS_MATERIALS = {
    grid: {
        diffuse: GridMaterial,

        lighting: GridMaterialLighting
    },

    biplanar: {

        diffuse: BiplanarMaterial,

        lighting: BiplanarLightingMaterial
    }
};



export class TerrainComponent extends Component3D {
    static getInfo() {
        return {
            type: "terrain",
            title: "Terrain",
            image: "/components/terrain.png",
            help: {
                desc: "Build a terrain",
            },
        };
    }

    // static getDataFromRoom(room) {

    //     return getSpawnDataFromRoom(room)
    // }

    static getDefaultData() {
        return getDefaultData();
    }

    static isSingleton() {
        return false;
    }

    static isRequired() {
        return false;
    }

    static getPresets() {
        return terrainPresets;
    }

    constructor(opts = {}) {
        super(opts);

        this.opts = opts;

        this.data = opts.data;

        this.isNoised = false;

        this.worker = new WorkerFloor();

        const meta = {
            position: {
                type: "xyz",
                value: [this.data, "position"],
            },
            rotation: {
                type: "xyz",
                value: [this.data, "rotation"],
            },
            scale: {
                type: "xyz",
                value: [this.data, "scale"],

                onChange: () => {
                    this.geometryNeedsUpdate = true;

                    // this.update3D()

                    // this.updateTexturing()

                    this.textureNeedsUpdate = true;
                },
            },

            color: {
                type: "color",
                value: [this.data, "color"],
                onChange: () => {
                    // this.update3D()
                },
            },

            noise: {
                type: "checkbox",
                value: [this.data, "noiseEnabled"],

                onChange: () => {
                    this.geometryNeedsUpdate = true;

                    // this.update3D()
                },
            },

            noiseOptions: {
                type: "group",
                visible: () => this.data.noiseEnabled,
                children: {
                    definition: {
                        type: "number",
                        step: 1,
                        min: 10,
                        max: 200,
                        value: [this.data, "definition"],
                        onChange: (val) => {
                            // gsap.delayedCall(THROTTLE_SPEED, ()=>{

                            // if( val == this.data.definition ) {

                            this.geometryNeedsUpdate = true;

                            // this.update3D()
                            // }

                            // })
                        },
                    },

                    smoothCenter: {
                        type: "number",
                        step: 0.01,
                        min: 0,
                        max: 1,
                        value: [this.data, "smoothCenter"],
                        onChange: (val) => {
                            // gsap.delayedCall(THROTTLE_SPEED, ()=>{

                            // if( val == this.data.smoothCenter ) {

                            this.geometryNeedsUpdate = true;

                            // this.update3D()
                            // }

                            // })
                        },
                    },
                    seed: {
                        type: "number",
                        step: 1,
                        min: 0,
                        max: 65536,
                        value: [this.data, "seed"],
                        onChange: (val) => {
                            // gsap.delayedCall(THROTTLE_SPEED, ()=>{

                            // if( val == this.data.seed ) {

                            this.geometryNeedsUpdate = true;

                            // this.update3D()
                            // }
                            // })
                        },
                    },
                    noiseDomain: {
                        type: "number",
                        step: 0.1,
                        min: 0.1,
                        max: 10,
                        value: [this.data, "noiseDomain"],
                        onChange: (val) => {
                            // gsap.delayedCall(THROTTLE_SPEED, ()=>{

                            // if( val == this.data.noiseDomain ) {

                            this.geometryNeedsUpdate = true;

                            // this.update3D()
                            // }
                            // })
                        },
                    },
                },
            },

            mode: {
                type: "select",
                items: () => {
                    return Object.keys(MODES);
                },
                label: "Mode",
                value: [this.data, "mode"],
                onChange: () => {
                    // this.updateTexturing()

                    this.textureNeedsUpdate = true;
                },
            },

            shader: {
                type: "select",
                visible: () => this.data.mode === MODES.shader,
                items: () => {
                    return Object.keys(SHADERS);
                },
                label: "Shader",
                value: [this.data, "shader"],
                onChange: () => {
                    // this.updateTexturing()

                    this.textureNeedsUpdate = true;
                },
            },

            imageOpts: {
                type: "group",
                visible: () => this.data.mode === MODES.texture || ( this.data.mode == MODES.shader && this.data.shader == SHADERS.biplanar ),
                children: {
                    tiles: {
                        type: "number",
                        step: 0.5,
                        min: 1,
                        max: 500,
                        value: [this.data, "tiles"],
                        onChange: (val) => {

                            this.textureNeedsUpdate = true;
                        },
                    },
                    image: {
                        type: "select",
                        label: "Image",
                        value: [this.data, "textureOpts"],
                        items: textureOpts,
                        onChange: () => {
                            // this.updateTexturing()

                            this.textureNeedsUpdate = true;
                        },
                    },
                    customImage: {
                        visible: () => this.data.textureOpts.id === "custom",
                        type: "image",
                        label: "Custom Image",
                        value: [this.data, "textureOpts"],
                        action: "upload",
                        accept: "image/png, image/jpeg, image/jpg",
                        onChange: () => {
                            // this.updateTexturing()

                            this.textureNeedsUpdate = true;
                        },
                    },
                },
            },

            
            imageSideOpts: {
                type: "group",
                visible: () =>  ( this.data.mode == MODES.shader && this.data.shader == SHADERS.biplanar ),
                children: {
                  
                    image: {
                        type: "select",
                        label: "Side Image",
                        value: [this.data, "textureSideOpts"],
                        items: textureOpts,
                        onChange: () => {
                            // this.updateTexturing()

                            this.textureNeedsUpdate = true;
                        },
                    },
                    customImage: {
                        visible: () => this.data.textureSideOpts.id === "custom",
                        type: "image",
                        label: "Custom Image",
                        value: [this.data, "textureSideOpts"],
                        action: "upload",
                        accept: "image/png, image/jpeg, image/jpg",
                        onChange: () => {
                            // this.updateTexturing()

                            this.textureNeedsUpdate = true;
                        },
                    },
                },
            },
         

            griddiv: {
                type: "number",
                visible: () =>
                    this.data.mode === MODES.shader &&
                    this.data.shader == SHADERS.grid,
                step: 1,
                min: 10,
                max: 200,
                value: [this.data, "griddiv"],
                onChange: (val) => {
                    // this.updateTexturing()

                    this.textureNeedsUpdate = true;
                },
            },

            edgeTransition: {
                type: "number",
                visible: () =>
                    this.data.mode === MODES.shader &&
                    this.data.shader == SHADERS.biplanar,
                step: 0.1,
                min: 0.01,
                max: 8,
                value: [this.data, "edgeTransition"],
                onChange: (val) => {
                    // this.updateTexturing()

                    this.textureNeedsUpdate = true;
                },
            },

            smoothAngle: {
                type: "number",
                visible: () =>
                    this.data.mode === MODES.shader &&
                    this.data.shader == SHADERS.biplanar,
                step: 0.01,
                min: 0.,
                max: 1,
                value: [this.data, "smoothAngle"],
                onChange: (val) => {
                    // this.updateTexturing()

                    this.textureNeedsUpdate = true;
                },
            },


            noTileDisplacement: {
                type: "number",
                visible: () =>
                    this.data.mode === MODES.shader &&
                    this.data.shader == SHADERS.biplanar,
                step: 0.01,
                min: 0.,
                max: 50,
                value: [this.data, "noTileDisplacement"],
                onChange: (val) => {
                    // this.updateTexturing()

                    this.textureNeedsUpdate = true;
                },
            },

            collision: {
                type: "checkbox",
                value: [this.data, "collision"],
            },
        };

        this.setProps(meta);

        this.presets = this.props.getPresets(terrainPresets);

    }

    async init() {
        this.geometry = new PlaneGeometry(1, 1, 1, 1);

        const occlusionMaterial = new MeshBasicMaterial({
            color: 0x000000,
            side: 2,
            fog: false
        });

        this.materials = {

            diffuse: new MeshBasicMaterial({ color: 0xff0000, fog: true }),

            lighting: new MeshStandardMaterial({ fog: true }),
        };

        this.mesh = new PipeLineMesh(
            this.geometry,

            this.materials.diffuse,

            {
                occlusionMaterial: occlusionMaterial,

                lightingOcclusionMaterial: occlusionMaterial,

                lightingMaterial: this.materials.lighting,

                mirrorMaterial  :  this.materials.diffuse
            }
        );

        this.mesh.castShadow = true;

        this.mesh.receiveShadow = true;

        this.mesh.name = "floor collision";

        this.add(this.mesh);

        this.geometryNeedsUpdate = true;

        this.textureNeedsUpdate = true;

        await this.update3D();

        this.selectionMesh = this.mesh;

        this.setCollisionMesh(this.mesh);

        this.collisionMesh.userData._disabled = !this.data.collision;

    }

    getBBox(box) {
        box.expandByObject(this.mesh);
    }

    async update3D() {
        console.log(this.data.mode);

        const { position, rotation, scale } = this.data;

        this.position.set(position.x, position.y, position.z);

        this.rotation.set(rotation.x, rotation.y, rotation.z);

        if(this.data.noiseEnabled){

            this.scale.set(1,1,1)
        }
        else {

            this.scale.set(scale.x, scale.y, scale.z);   
        }
       

        // this.selectionMesh.position.copy(this.position)
        // this.selectionMesh.quaternion.copy(this.quaternion)
        // this.selectionMesh.scale.copy(this.scale)
        // this.selectionMesh.updateMatrixWorld()

        this.mesh.material.color.set(this.data.color);

        if (this.mesh.lightingMaterials.material) {
            this.mesh.lightingMaterials.material.color.set(this.data.color);
        }

        if (this.collisionMesh) {
            this.collisionMesh.userData._disabled = !this.data.collision;
        }

        if (!this.props.isProgress) {
            let ps = [];

            if (this.geometryNeedsUpdate) {
                ps.push(
                    this.computeGeometry().then(() => {
                        this.emit(this.EVENTS.COLLISON_CHANGED, this);
                    })
                );
            }

            if (this.textureNeedsUpdate) {
                ps.push(this.updateTexturing());
            }

            await Promise.all(ps);
        }
    }

    async updateTexturing() {
        this.textureNeedsUpdate = false;

        this.texAbort?.abort();

        this.texAbort = new AbortController();

        const signal = this.texAbort.signal;

        if (this.data.mode == MODES.texture) {
            this.mesh.diffuseMaterials.material = this.materials.diffuse;

            this.mesh.lightingMaterials.material = this.materials.lighting;

            this.mesh.diffuseMaterials.material.color.set(this.data.color);


            if (this.mesh.lightingMaterials.material) {
                this.mesh.lightingMaterials.material.color.set(this.data.color);
            }


        } else if (this.data.mode == MODES.color) {
            this.mesh.diffuseMaterials.material = this.materials.diffuse;

            this.mesh.lightingMaterials.material = this.materials.lighting;

            this.textureMap = null;

            this.mesh.diffuseMaterials.material.map =
            this.mesh.lightingMaterials.material.map = null;

            this.mesh.diffuseMaterials.material.needsUpdate =
            this.mesh.lightingMaterials.material.needsUpdate = true;

            
            
            this.mesh.diffuseMaterials.material.color.set(this.data.color);

            if (this.mesh.lightingMaterials.material) {
                this.mesh.lightingMaterials.material.color.set(this.data.color);
            }



        } else if (this.data.mode == MODES.shader) {
            if (this.materials[this.data.shader] == null) {
                this.materials[this.data.shader] = {
                    diffuse: new SHADERS_MATERIALS[this.data.shader].diffuse(
                        this.data
                    ),

                    lighting: new SHADERS_MATERIALS[this.data.shader].lighting(
                        this.data
                    ),
                };
            }

            this.mesh.diffuseMaterials.material =
                this.materials[this.data.shader].diffuse;

            this.mesh.lightingMaterials.material =
                this.materials[this.data.shader].lighting;

            this.materials[this.data.shader].diffuse.color.set(this.data.color);

            this.materials[this.data.shader].lighting.color.set(
                this.data.color
            );


            if (this.mesh.diffuseMaterials.material.uniforms.div) {
                this.mesh.diffuseMaterials.material.uniforms.div.value =
                    this.mesh.lightingMaterials.material.uniforms.div.value =
                        this.data.griddiv;
            }

            if (this.mesh.diffuseMaterials.material.edgeTransition != null ) {
                this.mesh.diffuseMaterials.material.edgeTransition =  this.data.edgeTransition
                this.mesh.lightingMaterials.material.edgeTransition =  this.data.edgeTransition
                    // this.mesh.lightingMaterials.material.uniforms.div.value =
                    //     this.data.griddiv;
            }

           

            if (this.mesh.diffuseMaterials.material.noTileDisplacement != null ) {
                this.mesh.diffuseMaterials.material.noTileDisplacement =  this.data.noTileDisplacement
                this.mesh.lightingMaterials.material.noTileDisplacement =  this.data.noTileDisplacement
                    // this.mesh.lightingMaterials.material.uniforms.div.value =
                    //     this.data.griddiv;
            }

            if (this.mesh.diffuseMaterials.material.smoothAngle != null ) {
                this.mesh.diffuseMaterials.material.smoothAngle =  this.data.smoothAngle
                this.mesh.lightingMaterials.material.smoothAngle =  this.data.smoothAngle
                    // this.mesh.lightingMaterials.material.uniforms.div.value =
                    //     this.data.griddiv;
            }

            

            this.mesh.diffuseMaterials.material.needsUpdate = true;

            this.mesh.lightingMaterials.material.needsUpdate = true;
        }



        // texturing 
        if( this.data.mode === MODES.texture || ( this.data.mode == MODES.shader && this.data.shader == SHADERS.biplanar ) ) {


            // path = actual , image = default when custom is null
            const image =
                this.data.textureOpts.path || this.data.textureOpts.image;

            if (image) {
                this.textureMap = await Loader.loadImageTexture(image);

                if (signal.aborted) return;

                this.textureMapRatio =
                    this.textureMap.source.data.width /
                    this.textureMap.source.data.height;

                this.textureMap.colorSpace = SRGBColorSpace;
                this.textureMap.minFilter = LinearMipmapLinearFilter;
                this.textureMap.magFilter = LinearFilter;
                this.textureMap.generateMipmaps = true;
                this.textureMap.wrapS = RepeatWrapping;
                this.textureMap.wrapT = RepeatWrapping;
                this.textureMap.needsUpdate = true;

                var ratio;

                if (this.data.scale.x < this.data.scale.z) {
                    ratio = this.data.scale.x / this.data.scale.z;

                    this.textureMap.repeat.set(1 * ratio, this.textureMapRatio);
                } else {
                    ratio = this.data.scale.z / this.data.scale.x;

                    this.textureMap.repeat.set(1, this.textureMapRatio * ratio);
                }

                this.textureMap.repeat.x *= this.data.tiles;

                this.textureMap.repeat.y *= this.data.tiles;

                this.mesh.diffuseMaterials.material.map =
                    this.mesh.lightingMaterials.material.map = this.textureMap;

                this.mesh.diffuseMaterials.material.needsUpdate =
                this.mesh.lightingMaterials.material.needsUpdate = true;


            }


            const image2 =
                this.data.textureSideOpts.path || this.data.textureSideOpts.image;

            if (image) {
                this.textureSideMap = await Loader.loadImageTexture(image2);

                if (signal.aborted) return;

                this.textureSideMapRatio =
                    this.textureSideMap.source.data.width /
                    this.textureSideMap.source.data.height;

                this.textureSideMap.colorSpace = SRGBColorSpace;
                this.textureSideMap.minFilter = LinearMipmapLinearFilter;
                this.textureSideMap.magFilter = LinearFilter;
                this.textureSideMap.generateMipmaps = true;
                this.textureSideMap.wrapS = RepeatWrapping;
                this.textureSideMap.wrapT = RepeatWrapping;
                this.textureSideMap.needsUpdate = true;

                var ratio;

                if (this.data.scale.x < this.data.scale.z) {
                    ratio = this.data.scale.x / this.data.scale.z;

                    this.textureSideMap.repeat.set(1 * ratio, this.textureSideMapRatio);
                } else {
                    ratio = this.data.scale.z / this.data.scale.x;

                    this.textureSideMap.repeat.set(1, this.textureSideMapRatio * ratio);
                }

                this.textureSideMap.repeat.x *= this.data.tiles;

                this.textureSideMap.repeat.y *= this.data.tiles;

                this.mesh.diffuseMaterials.material.sideMap =
                    this.mesh.lightingMaterials.material.sideMap = this.textureSideMap;

                this.mesh.diffuseMaterials.material.needsUpdate =
                this.mesh.lightingMaterials.material.needsUpdate = true;


            }
        }

        if ( this.mesh.diffuseMaterials.mirrorMaterial ){

            this.mesh.diffuseMaterials.mirrorMaterial =   this.mesh.diffuseMaterials.material

            this.mesh.lightingMaterials.mirrorMaterial =  this.mesh.lightingMaterials.material
        }
    }

    computeGeometry() {
        this.geometryNeedsUpdate = false;

        return new Promise((resolve) => {
            this.geoAbort?.abort();

            this.geoAbort = new AbortController();

            const signal = this.geoAbort.signal;

            if (this.data.noiseEnabled == false) {
                this.geometry = new PlaneGeometry(1, 1, 1, 1);

                this.geometry.rotateX(-Math.PI * 0.5);

                this.mesh.geometry = this.geometry;

                this.geometry.needsUpdate = true;

                resolve();
            } else if (this.data.noiseEnabled) {
                this.worker.postMessage(this.data);

                this.worker.onmessage = (e) => {
                    if (signal.aborted) return;

                    this.geometry = new BufferGeometry();

                    this.geometry.setAttribute(
                        "position",
                        new BufferAttribute(e.data.position, 3)
                    );

                    this.geometry.setAttribute(
                        "normal",
                        new BufferAttribute(e.data.normal, 3)
                    );

                    this.geometry.setAttribute(
                        "uv",
                        new BufferAttribute(e.data.uv, 2)
                    );

                    this.geometry.setIndex(
                        new BufferAttribute(e.data.index, 1)
                    );


                    this.mesh.geometry = this.geometry;

                    this.geometry.needsUpdate = true;

                    this.worker.onmessage = null;

                    this.mesh.rotation.x = 0;

                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)
                    console.log(this.mesh)

                    console.log(this.geometry.attributes.normal)
                    console.log(this.geometry.attributes.normal)
                    console.log(this.geometry.attributes.normal)

                    SET_SHADOW_NEEDS_UPDATE(true)

                    resolve();
                };
            }
        });
    }

    showSelected() {}

    getGUI() {
        return {
            type: "group",
            children:  {
                presets: {
                    type: "presets",
                    items: this.presets,
                },
                ...this.props.meta,
            },
        };
    }

    get hint() {
        if (this.data.mode == MODES.color) {
            return "Solid Color";
        } else if (this.data.mode == MODES.shader) {
            //
            return capitalize(this.data.shader);
        } else if (this.data.mode == MODES.texture) {
            return this.data.textureOpts.name + " Texture";
        }
    }

    onDispose() {
        if (this.worker) {
            this.worker.terminate();
        }
    }
}