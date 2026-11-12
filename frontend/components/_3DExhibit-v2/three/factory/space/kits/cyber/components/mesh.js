// @ts-check

import { Component3D } from '@3factory/space/kits/abstract'
import { BoxGeometry, Mesh, MeshLambertMaterial } from "three";
import PipeLineMesh from "@3abstract/pipelinemesh";


export class MeshComponent extends Component3D {

    static getInfo() {

        return {
            type: "mesh",
            title: "Mesh",
            image: "/components/mesh.png",
        }
    }

    static getDefaultData() {

        const pos  = Component3D.getInitDefaultPosition()

        return {
            kit: "cyber",
            type: "mesh",
            color: "#ffffff",
            opacity: 1,
            scale: { x: 1, y: 1, z: 1 },
            position: { x: pos.x, y: pos.y, z: pos.z },
            rotation: { x: 0, y: 0, z: 0 },
        }
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
            scale: {
                type: "xyz",
                value: [this.data, "scale"],
            }
        }

        this.setProps(meta)
    }

    async init() {

        this.mesh = new PipeLineMesh(
            new BoxGeometry(1, 1, 1),
            new MeshLambertMaterial({ color: 0xff0000 })
        )

        this.add(this.mesh)

        this.selectionMesh = this.mesh

        this.update3D()
    }

    update3D () {

        const { position, rotation, scale } = this.data

        this.position.set(position.x, position.y, position.z)

        this.rotation.set(rotation.x, rotation.y, rotation.z)

        this.scale.set(scale.x, scale.y, scale.z)
    }

    
    getGUI() {
            
        return {
            type: "folder",
            title: "Transform",
            children: this.props.meta
        }
    }

}