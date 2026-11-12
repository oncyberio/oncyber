// @ts-check

/**
 * @typedef { Color | Texture } Background
 */


import { BoxGeometry, Camera, Color, Group, MeshBasicMaterial, Texture } from "three";

import { disposeObject3D } from "@3/three/utils/three";

import BackgroundFactory from '@3factory/background'

import AugmentedGroup from "../../abstract/augmentedgroup";

import Renderer from "@3renderer";

// import { MObject } from "@gui/example";
// import { mount } from "@gui/GUI";




export const SPACE_EVENTS = {

    DISPOSE: "DISPOSE"
}


export class Space extends AugmentedGroup {

    constructor(opts) {

        super()

        this.roomTextureUpgrade = null

        this.spaceScene = opts.scene

        this._background = null

        this.add ( opts.scene )

        if(opts.background != null) {

            this.updateBackround(opts.background)
        }

        this.lighting = null

        this.fog = null

        // @ts-ignore
        // window.$$startGui = setupMockScene(this);
    }

    updateBackround(val) {

        const prevBg = this._background

        this.background = val

        if( prevBg?.material ) {

            prevBg.dispose?.()

            disposeObject3D(prevBg)
        }
    }


    get background() {

        return this._background
    }

    set background(val) {

        if (this._background ) {

            this.remove(this._background)
        }

        if( val == null || val.material == null ) {

            val = BackgroundFactory.get(val)
        }

        this._background = val

        if( this._background != null ) {

            this.add(this._background )

        }
    }

    getCurrentBackground(){

        return this._storedBackground ? this._storedBackground : this._background
    }

    _save(){

        if( this._background ) {

            this._storedBackground = this._background

            this._background = null

            this.remove(this._background )
        }

    }

    _restore(){

        if( this._storedBackground ) {

            this._background = this._storedBackground

            this.add(this._background )

            this._storedBackground = null
        }
    }

    /**
     *
     * @param {Camera} camera
     */
    renderBackground(camera) {

        if(this._background) {

            Renderer.render(this._background, camera)
        }
    }


    dispose() {

        if (this.wasDisposed) return;
        this.wasDisposed = true
        this.roomTextureUpgrade?.stop()

        disposeObject3D( this.spaceScene )

        if( this.background?.material ) {

            this.remove(this.background)

            disposeObject3D( this.background )

            this.background = null

        }

        for (const extra of [this.water, this.reflector]) {
            if (extra) { extra.removeFromParent(); disposeObject3D(extra); }
        }
        this.water = this.reflector = null;
        this.roomTextureUpgrade?.dispose()
        this.roomTextureUpgrade = null
        this.emit(SPACE_EVENTS.DISPOSE, {})

    }
}

/*
function setupMockScene(scene) {
    //

    let meshes = [];

    let selection = null;

    const addMesh = (mesh) => {
        //
        scene.add(mesh);

        meshes.push(mesh);

        selection = mesh;

        setTimeout(() => {
            //
            gui.update();
        }, 0);
    };

    const removeMesh = (mesh) => {
        //
        scene.remove(mesh);

        meshes = meshes.filter((m) => m !== mesh);

        selection = null;

        gui.update();
    };

    const getGUI = () => {
        //
        const sceneFolder = {
            type: "folder",
            label: "Scene",
            children: {
                select: {
                    type: "select",
                    label: "Select",
                    value: selection ? selection.name : "",
                    items: [""].concat(meshes.map((mesh) => mesh.name)),
                    onChange: (value) => {
                        //
                        if (value === "") {
                            //
                            if (selection) {
                                //
                                selection.material.wireframe = false;
                            }

                            selection = null;

                            gui.update();
                        }

                        const mesh = meshes.find((mesh) => mesh.name === value);

                        if (mesh) {
                            //
                            if (selection) {
                                //
                                selection.setSelected(false);
                            }

                            selection = mesh;

                            selection.setSelected(true);

                            gui.update();
                        }
                    },
                },
                addMesh: {
                    type: "button",
                    label: "Add Mesh",
                    onAction: () => {
                        //
                        const randomColor = Math.random() * 0xffffff;

                        const mesh = new MObject(
                            new BoxGeometry(1, 1, 1),
                            new MeshBasicMaterial({ color: randomColor })
                        );

                        mesh.data.position = [
                            Math.random() * 2 - 1,
                            Math.random() * 2 - 1,
                            Math.random() * 2 - 1,
                        ];

                        mesh.name = `Mesh ${meshes.length + 1}`;

                        return {
                            run: () => addMesh(mesh),
                            undo: () => removeMesh(mesh),
                        };
                    },
                },
                remove: {
                    type: "button",
                    label: "Remove",
                    disabled: !selection,
                    icon: "trash",
                    onAction: () => {
                        //
                        if (selection) {
                            //
                            return {
                                run: () => removeMesh(selection),
                                undo: () => removeMesh(selection),
                            };
                        }
                    },
                },
            },
        };

        return {
            //
            type: "group",
            children: {
                sceneFolder,
                selection: selection?.getGUI() || null,
            },
        };
    };

    const gui = mount(getGUI, { undo: true, title: "Editor in Editor" });

    const state = {
        meshes,
        selection,
        gui
    }

    // @ts-ignore
    window.$state = state

    return state

}
*/
