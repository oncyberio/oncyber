// @ts-check

import Camera from "@3camera"

import { disposeObject3D } from "@components/_3DExhibit-v2/three/utils/three"

import { SpaceComponent } from "@3factory/abstract/spacecomponent"

import { deepEqual, hasOwn, isObject } from "@utils/js"

import { getDefaultAssetPosition, getDefaultAssetRotation } from "@components/_3DExhibit-v2/three/utils/spaceutils"

import { Props } from "@components/_3DExhibit-v2/gui2/props"

import worldEmitter from "@3emitter"

import worldEvents from "@3events"

import PipeLineMesh from "@3abstract/pipelinemesh"
import { Box3 } from "three"
import { EDITION_TRANSFORM_CONTROL } from "@components/_3DExhibit-v2/three/constants"





function upgradeData(data, defData) {

    if(data == null) debugger

    for (let key in defData) {

        if ( !hasOwn(data, key) ) {

            data[key] = defData[key];

            continue;
        }

        if (isObject(data[key])) {

            upgradeData(data[key], defData[key]);
        }
    }
}


const eventSources = ["data", "ui", "3d"];

export const DefaultScope = {
    space: {
        classic: true,
        future: true,
    },
    mode: {
        uploader: true,
        edit: true,
    }
}

export class Component3D extends SpaceComponent {

    /**
     * @typedef { { desc?: string, tip?: string } } ComponentHelp
     * 
     * @returns { { type: string, title: string, help?: ComponentHelp, image: string, imageXL?: string, group?: string } }
     */
    static getInfo() {
        return {
            type: "--Abstract--",
            title: "--Abstract--",
            image: "",
        }
    }

    /**
     *
     * @returns { typeof DefaultScope }
     */
    static getScope() {

        return DefaultScope
    }

    static getDefaultData() {
        return {}
    }

    /** 
     * @param { any } config
     * @returns { { success: boolean, message?: string } }
     */
    static validateCreation(config) {

        return { success: true }
    }

    static isSingleton() {
        return false
    }

    static isRequired() {
        return false
    }

    static isDraggable() {
        return false
    }

    static getPresets() {

        return []
    }

    constructor(opts) {

        super(opts)

        this.isComponent3D = true

        this.isEditMode = opts.isEditMode

        this._selectionMesh = null

        // @ts-ignore
        upgradeData(opts.data, this.constructor.getDefaultData())

        this.data = opts.data

        this.userData = this.data

        // @ts-ignore
        this._info = this.constructor.getInfo()

        /** @type { Props } */
        this.props = null

        this.on("3d", this.$$handle3DUpdate)
    }

    async init(){
        
    }

    setProps(config) {
        //
        if(this.props) this.props.dispose()

        this.props = new Props(config, { data: this.data });

         this.props.on("change", this.$$onPropsChange)
    }


    $$onPropsChange = (opts) => {
        //
        let source = opts?.source ?? "unknown"

        this.props.isProgress = opts?.isProgress ?? this.props.isProgress

        for(let i = 0; i < eventSources.length; i++) {

            let event = eventSources[i]

            if(source == event) continue

            if(event === "data") {

                opts.component = this

                worldEmitter.emit(

                    worldEvents.CUSTOM,

                    {
                        type: worldEvents.KITBASH_DATA_CHANGED,

                        value: opts
                    }
                )
            }
            else {

                this.emit(event, opts)
            }
        }
    }

    $$handle3DUpdate = () => {

        if(this.$$hasUpdate) return

        this.$$hasUpdate = true

        worldEmitter.once(worldEvents.PRE_UPDATE, this.$$onPreUpdate)

    }

    $$onPreUpdate = () => {

        this.$$hasUpdate = false

        this.update3D()
    }

    get selectionMesh() {

        return this._selectionMesh
    }

    set selectionMesh(mesh) {

        this._selectionMesh = mesh

        this.setRaycastMesh(mesh)

        if (this.prefTransformControls == null) {

            this.prefTransformControls = EDITION_TRANSFORM_CONTROL.TRANSFORM_3D
        }
    }

    /** @type { string } */
    get title() {

        return this._info.title
    }

    /** @type { ComponentHelp } */
    get help() {

        return this._info.help
    }

    /** @type { string } */
    get hint() {

        return ""
    }

    /** @type { string } */
    get image() {

        return this._info.image
    }

    /** @type { string } */
    get componentType() {

        return this._info.type
    }

    /** @type { boolean } */
    get isSingleton() {
        // @ts-ignore
        return this.constructor.isSingleton()
    }

    /** @type { boolean } */
    get isRequired() {
        // @ts-ignore
        return this.constructor.isRequired()
    }

    /** @type {string} */
    get group() {

        return this._info.group
    }

    onDispose() {

    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.emit(this.EVENTS.DISPOSED)

        this.onDispose()

        disposeObject3D(this)
    }


    getGUI() {

        return null
    }

    onData(payload) {
        //
        this.props?.updateData(payload, "data" );
    }

    update(payload, source = "unknown") {

        this.props?.updateData(payload, source);
    }

    update3D() {}

    // following methods are used by components with selection meshÒ

    updateCoords(opts = {}) {
        
        this.props?.update(
            {
                position: { x: this.position.x, y: this.position.y, z: this.position.z },
                rotation: { x: this.rotation.x, y: this.rotation.y, z: this.rotation.z },
            },
            {
                isProgress: this.isDragging,
                ...opts
            }
        )
    }

    dragStart(opts = {}) {
        //
        this.isDragging = true;

        if (opts.isMulti) return
        
        this.selStartCoords = {
            position: this.position.toArray(),
            rotation: this.rotation.toArray(),
        }
    }

    dragEnd(opts = {}) {
        //
        this.isDragging = false;

        if (opts.isMulti) return

        const start = this.selStartCoords;

        const end = {
            position: this.position.toArray(),
            rotation: this.rotation.toArray(),
        };

        if(deepEqual(start, end)) return;

        this.updateCoords();

        const cmd = this.createUndoTransformCmd(start, end);

        this.emit("command", cmd);
    }

    /**
     * @returns { () => typeof this }
     */
    elLocator() {

        return elLocator(this.parent, this.data.id)
    }

    createUndoTransformCmd (start, end)  {
        //
        /**
         * Why do we need this
         * Because the command can't simply use `this` reference, in case the element was 
         * deleted and recreated (using undo/redo), the reference will be invalid (along with memory leak)
         */
        const getEl = this.elLocator();

        return {

            info: "Change transform",

            start,

            end,

            run: () => {},

            undo: () => {
                //
                const el = getEl();
                
                el.position.fromArray(start.position);

                el.rotation.fromArray(start.rotation);

                el.updateCoords();
            },

            redo: () => {
                //
                const el = getEl();

                el.position.fromArray(end.position);

                el.rotation.fromArray(end.rotation);

                el.updateCoords();
            },
        };
    };

    setEditMode(isEditMode) {

        this.isEditMode = isEditMode
    }

    static getInitDefaultPosition(distance = 4) {

        return getDefaultAssetPosition(Camera.current, distance)
    }

    static getInitDefaultRotation() {

        return getDefaultAssetRotation(Camera.current)
    }

    /**
     * 
     * @param {Box3} box 
     */
    getBBox( box ) {

        if(this.selectionMesh) {

            box.expandByObject(this.selectionMesh)
        }
    }
}


function elLocator (parent, id) {

    return () => {

        const el = parent.children.find(it => it.data.id === id)

        if(el == null) {

            throw new Error("Can't find element " + id)
        }

        return el
    }
}