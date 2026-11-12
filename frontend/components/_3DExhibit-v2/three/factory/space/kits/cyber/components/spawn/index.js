// @ts-check


import { CircleGeometry, Color, CylinderGeometry, DoubleSide, MeshBasicMaterial } from "three";

import { NodeMaterial } from "three/webgpu";

import { distance, float as tslFloat, mix, sRGBTransferEOTF, smoothstep, uniform, uv, vec2, vec4 } from "three/tsl";

import PipeLineMesh from "@3abstract/pipelinemesh";

import { Component3D } from '@3factory/space/kits/abstract'

import { getDefaultSpawnData, getSpawnDataFromRoom, updateRoomParamsFromSpawnData } from "./data";

import VRMS from "@3factory/player/vrms.json";

import GLTF from '@3gltf'

import Players from '@3factory/player'

import Scene from "@3scene";

import { CURRENT_SPACE, DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";
import { delay } from "@utils/js";
import { UPDATE_USERNAME, UPDATE_CHAT } from "@components/_3DExhibit-v2/three/factory/player/constants";



export class SpawnComponent  extends Component3D {

    static getInfo() {
        return {
            type: "spawn",
            title: "Spawn",
            image: "/components/spawn.png",
            help: {
                desc: "Define where visitors will enter your World.",
            }
        }
    }

    static getDataFromRoom(room) {

        return getSpawnDataFromRoom(room)
    }

    static getDefaultData() {

        return getDefaultSpawnData()
    }

    static isSingleton() {
        return true
    }

    static isRequired() {
        return true
    }

    static isDraggable() {
        return true
    }

    constructor(opts = {}) {

        super(opts)

        this.opts = opts

        this.data = opts.data

        const meta = {
            position: {
                type: "xyz",
                value: [this.data, "position"],
                min: { y: 0 },
            },
            rotation: {
                type: "xyz",
                value: [this.data, "rotation"],
            },
        }

        this.setProps(meta)
    }

    async init() {

        // const shape = new Shape()
		// shape.moveTo( 0.5, -1 )
        // shape.lineTo( 0.5, 0 )
        // shape.lineTo( 1, 0 )
        // shape.lineTo( 0, 1 )
        // shape.lineTo( -1, 0 )
        // shape.lineTo( -0.5, 0 )
        // shape.lineTo( -0.5, -1 )
        // shape.lineTo( 0.5, -1 )

        // const geo = new ShapeGeometry(shape)
        // geo.scale(1.5, 2, 1)
        // geo.rotateX(-Math.PI / 2)


        // const dirMesh = new PipeLineMesh(
        //     geo,
        //     new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }),
        // )

        const height = 3

        const radius = 1

        const occlusionMaterial = new MeshBasicMaterial({color:0x0000})

        // The WebGL shaders wrote their colours straight out (no conversion),
        // hence the sRGBTransferEOTF before the node output conversion.

        const baseMaterial = new NodeMaterial()

        baseMaterial.transparent = true

        baseMaterial.side = DoubleSide

        baseMaterial.fog = false

        baseMaterial.uniforms = {
            vcolor1: uniform( new Color('#7BB5FD') ),
            vcolor2: uniform( new Color('#041b36') ),
        }

        {
            const t = smoothstep( 0.0, 1.0, distance( uv(), vec2( 0.5, 0.5 ) ) )

            const c1 = vec4( baseMaterial.uniforms.vcolor1, 1.0 )

            const c2 = vec4( baseMaterial.uniforms.vcolor2, 1.0 )

            // radial_grad( c1, c2, 0.302083, t )
            const s = tslFloat( 0.302083 )

            const gradient = mix( mix( c1, c2, smoothstep( 0.0, s, t ) ), c2, smoothstep( s, 1.0, t ) )

            baseMaterial.colorNode = vec4( sRGBTransferEOTF( gradient.rgb ), gradient.a )
        }

        const base = new PipeLineMesh(
            new CircleGeometry(radius).rotateX(-Math.PI / 2),
            baseMaterial,
            {

                occlusionMaterial,
                visibleOnMirror: false
            }
        )

        base.translateY(-height / 2)


        const material = new NodeMaterial()

        material.transparent = true

        material.fog = false

        material.uniforms = {
            color: uniform( new Color('#328DFD') ),
            height: uniform( height )
        }

        material.colorNode = sRGBTransferEOTF( material.uniforms.color )

        material.opacityNode = tslFloat( 1.0 ).sub( smoothstep( 0.0, 0.7, uv().y ) )

        this.mesh = new PipeLineMesh(
            new CylinderGeometry(radius, radius, 3, 32, 1, true),
            material,
            {
                occlusionMaterial,
                visibleOnMirror: false
            }
        )

        this.mesh.renderOrder = 1_000_000

        this.mesh.add(base)

        this.mesh.translateY(1.5)

        // this.mesh.add(dirMesh)

        // dirMesh.position.y = 0.1

        this.add(this.mesh)

        this.selectionMesh = this.mesh

        await this.loadAvatar()

        this.update3D()

        this.setEditMode(!!this.opts.isEditMode)
    }

    showSelected() {

        //
    }

    async loadAvatar() {

        const VRM = VRMS.sunshine.url;

        if (GLTF[VRM] == null) {
            //
            console.log("vrm does not exists yet ");

            await GLTF.loadOnce({
                name: VRM,
                url: VRM,
            });
        }

        const playerAvatar = Players.get({
            userData: {
                avatar: DEFAULT_PLAYER_AVATAR_PICTURE,
                username: "hello",
                walletId: "world",
                isAdmin: false,
                VRM: VRM,
            },
            exhibit: {
                id: this.opts.exhibit.id,
            },
            user: {
                id: "hello",
            },
            roomParameters: {
                user_height: 2.8,
            },
            sessionId: "hello",
            isDummy: true,
            animation: 0,
        });

        playerAvatar.updatePlayer({
            type: UPDATE_USERNAME,
            payload: "Where visitors will spawn",
            textOnly: true,
        });


        // playerAvatar.updatePlayer({
        //     type: UPDATE_CHAT,
        //     payload: {
        //         text: "Where all visitors will enter your World.",

        //         date: "",

        //         acc_date: "",

        //         username: "",

        //         sessionId: "hello",
        //     },
        //     // 1h
        //     tiemout: 1000 * 60 * 60,
        // });

        this.avatar = playerAvatar;

        this.avatar.visible = true;

        this.avatar.username.wrapper["ignoreLOD"] = true;

        this.avatar.avatar3D["ignoreLOD"] = true;

        this.updateAvatarCoords();
    }

    updateAvatarCoords() {

        if (!this.avatar) return;

        const { position, rotation } = this.data

        this.avatar.position.set(position.x, position.y, position.z)

        this.avatar.rotation.set(0, rotation.y, 0)
    }

    update3D () {

        const { position, rotation, scale } = this.data

        this.position.set(position.x, position.y, position.z)

        this.rotation.set(rotation.x, rotation.y, rotation.z)

        this.updateAvatarCoords()

        updateRoomParamsFromSpawnData(this.opts.roomParameters, this.data)
    }

    setEditMode(isEditMode) {

        isEditMode = !!isEditMode

        super.setEditMode(isEditMode)

        this.mesh.visible = isEditMode

        if (isEditMode) {

            this.avatar?.show()
        }
        else {

            this.avatar?.hide()
        }
    }


    getGUI() {

        return {
            type: "folder",
            title: "Spawn coordinates",
            children: this.props.meta
        }
    }



    onDispose() {

        if (this.avatar) {

            Scene.remove(this.avatar)

            this.avatar.dispose()
        }

        updateRoomParamsFromSpawnData(this.opts.roomParameters, {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
        })
    }
}
