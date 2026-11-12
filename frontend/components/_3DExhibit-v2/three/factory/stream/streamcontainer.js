// @ts-check
import TextArtwork from "@3artwork/meshes/text"
import { GLOBAL_TEXT_SCALE } from "@components/_3DExhibit-v2/three/constants";

import AugmentedGroup from "../../abstract/augmentedgroup";
import Events from "@3events"
import Emitter from "@3emitter"
import Camera from "@3camera"

import { CANVAS, IS_TOUCH } from "@3constants";
import { xyzEquals, _xyzEquals } from "@components/_3DExhibit-v2/ui/AssetsMenu/shared/utils";

import { Vector3, Mesh, Raycaster, Matrix4, Euler } from "three";
import { PivotControls } from "../controls/pivotcontrols";
import { SnapTransformControls } from "../artwork/artworkcontainer/transformcontrols/SnapTransformControls";
import { deepClone } from "@utils/js";
import { VideoStream } from "./videostream";
import { AudioStream } from "./audiostream";
import { snap, toXYZ } from "../../utils/three";




const cameraPosition = new Vector3()

const cameraDirection = new Vector3()

const worldPosition = new Vector3()

const worldRotation = new Euler()

const worldScale = new Vector3()



const MODES = {

    PLACEMENT: "PLACEMENT",

    NA: "NA"
}


let MOUSE_DOWN_EVENT = IS_TOUCH ? "touchstart" : "mousedown"


// @ts-ignore
const raycaster = new Raycaster();

/**
 *
 * @param {MouseEvent} event
 * @param {HTMLElement} domElement
 * @returns
 */
function getPointer(event, domElement) {
    if (domElement.ownerDocument.pointerLockElement) {
        return {
            x: 0,
            y: 0,
            button: event.button,
        };
    } else {
        const rect = domElement.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: (-(event.clientY - rect.top) / rect.height) * 2 + 1,
            button: event.button,
        };
    }
}

/**
 *
 * @param { MouseEvent } event
 * @param {Mesh[]} objects
 * @returns
 */
function hitTest(event, objects) {
    let point = getPointer(event, CANVAS);
    raycaster.setFromCamera(point, Camera.current);
    return raycaster.intersectObjects(objects, false);
}


/**
 * @typedef { MediaStream } ShareStream
 *
 * @typedef {object} ShareStreamOpts
 * @property {ShareStream} stream
 * @property {string} id
 * @property {boolean} isLocal
 * @property {string} addedBy
 * @property {any} opts
 */

export class StreamContainer extends AugmentedGroup {


    constructor(opts) {

        super()

        this.opts = opts

        /** @type { Record<string, AudioStream | VideoStream> } */
        this.streams = {}

        /** @type { Record<string, Promise<any>> } */
        this.pendingStreams = {}

        this.localData = null

        this.createHelperText()

        this.mode = MODES.NA

        /**@type { Mesh[] }  */
        this.raycastMeshes = []

        const rect = CANVAS.getBoundingClientRect()

        this.transformControls = new PivotControls({
            camera: Camera.current,
            domElement: CANVAS.parentElement,
            size: {
                with: rect.width,
                heigt: rect.height
            }
        });

        this.transformControls.setRotationSnap(5 * Math.PI / 180)

        this.transformControls.rotationSnap = Math.PI / 36

        // this.transformControls.enabled = false


        this.add(this.transformControls)

        this.snapControls = new SnapTransformControls(Camera.current, CANVAS.parentElement, null, opts.roomParameters)

        this.snapControls.autoHandleCursor = true

        this.currentControls = "snap"

        this.add(this.snapControls)

    }

    async createHelperText() {

        this.helperText = await TextArtwork.getFont({
            text: "press t to toggle controls",
            color:  [1,1,1],
            font: 'aeonik-bold',
            align: 'left',
            lineHeight: 60,
            width: 1000,
            scale: GLOBAL_TEXT_SCALE * 8
        })

        this.helperText.visible = false

        const umw = this.helperText.updateMatrixWorld

        const self = this

        this.helperText.updateMatrixWorld = function(...args) {

            if(!this.visible) return

            self._snapHelperText(false)

            umw.apply(this, args)
        }

        this.add(this.helperText)
    }




    showHelperText() {
        //
        clearTimeout(this._tid)

        this.helperText.visible = true

        this._snapHelperText(true)

        this._tid = setTimeout(() => {

            this.helperText.visible = false

        }, 5000)
    }


    _lastTargetMatrix = new Matrix4()

    _snapHelperText = (force) => {

        if(!this.helperText.visible) return

        const localStream = this.getLocalStream()

        if( localStream?.matrixWorld && (!force || !this._lastTargetMatrix.equals(localStream.matrixWorld))) {

            this._lastTargetMatrix.copy(localStream.matrixWorld)

            snap(localStream, this.helperText, { vert: "top", horz: "center", vertOffset: 0.1 })
        }
    }

    /** @returns { VideoStream } */
    getLocalStream() {

        if(this.localStream == null) return null;

        const stream = this.streams[this.localStream]

        // @ts-ignore
        return stream
    }

    setMode(mode, intersect) {

        if(this.mode === mode) return

        this.mode = mode

        if(this.mode === MODES.PLACEMENT) {

            this.showTransforms()

        }
        else if(this.mode === MODES.NA) {

            this.hideTransforms()
        }
    }

    showTransforms() {

        const object = this.getLocalStream()

        if(this.currentControls === "snap") {

            this.snapControls.attach(object)

        }
        else {

            this.transformControls.attach(object)
        }
    }

    hideTransforms() {

        if(this.currentControls === "snap") {

            this.snapControls.detach()

        }
        else {

            this.transformControls.detach()
        }

    }


    toggleControls() {
        //
        const controls = this.currentControls === "snap" ? "pivot" : "snap"

        this.hideTransforms()

        this.currentControls = controls

        this.showTransforms()

    }

    publishCoords = () => {
        //
        const stream = this.getLocalStream()

        if(stream == null) {

            console.error("WARNING! streamContrainer localStream == null")
        }

        this.localData = stream.getOptions()

        Emitter.emit(
            //
            Events.CUSTOM,
            {
                type: Events.STREAM_COORDS_CHANGED,

                value: deepClone(this.localData)
            }
        )
        
    }

    addInteractionEvents() {

        if(this.mouseEventEnabled) return

        this.mouseEventEnabled=  true

        CANVAS.parentElement.addEventListener(MOUSE_DOWN_EVENT, this.onMouseDown, { capture: true })

        Emitter.on(Events.KEY_DOWN, this.onKeyDown)

        Emitter.on(Events.CAMERA_SWITCH_MODE, this.handleCameraSwitch)

        this.handleCameraSwitch()

        this.transformControls.addEventListener(
            "dragging-changed",
            this.onTransformDraggingChanged
        )

        this.snapControls.addEventListener(
            "dragging-changed",
            this.onTransformDraggingChanged
        )

        this.snapControls.enabled = true
    }

    onTransformDraggingChanged = (event) => {

        console.log("dragging-changed", event.value)

        this.isTransformControlLocked = !!event.value

        if (!event.value) {

            Camera.currentControls?.addEvents()

            // reset snap control's axis
            this.snapControls.axis = "XY"

            this.publishCoords()
        }

        else {

            Camera.currentControls?.removeEvents()
        }
    }

    removeInteractionEvents() {

        if(!this.mouseEventEnabled) return

        this.mouseEventEnabled=  false


        CANVAS.parentElement.removeEventListener(MOUSE_DOWN_EVENT, this.onMouseDown, { capture: true })

        Emitter.off(Events.KEY_DOWN, this.onKeyDown)

        Emitter.off(Events.CAMERA_SWITCH_MODE, this.handleCameraSwitch)

        this.transformControls.removeEventListener(
            "dragging-changed",
            this.onTransformDraggingChanged
        )

        this.snapControls.removeEventListener(
            "dragging-changed",
            this.onTransformDraggingChanged
        )

        this.snapControls.enabled = false
    }

    handleCameraSwitch = (value) => {
        this.transformControls.camera = Camera.current
        this.snapControls.camera = Camera.current
    }


    /**
     *
     * @param {MouseEvent} e
     */
    onMouseDown = (e) => {

        // console.log('stream mouse down', e.target)

        if(this.mode === MODES.PLACEMENT && (this.snapControls.dragging || this.transformControls.dragging)) {

            e.stopPropagation()

            return
        }

        const is = hitTest(e, [this.getLocalStream().mesh])

        if(!is?.length) {

            this.setMode(MODES.NA)
        }

        else {

            // console.log("Selection", is[0])

            e.stopPropagation()

            this.setMode(MODES.PLACEMENT, is[0])

            this.showHelperText()
        }

    }


    /**
     *
     * @param {KeyboardEvent} e
     * @returns
     */
    onKeyDown = (e) => {

        if(this.mode !== MODES.PLACEMENT) return

        if(!e.repeat && (e.key === "t" || e.key === "T")) {

            this.toggleControls()
        }
    }


    async update(opts) {
        //
        if(opts.type === "UPDATE") {

            const id = opts.data.id

            // VideoStream.init() waits for the video metadata before the
            // wrapper is registered in streams. Remote WebRTC track and
            // placement updates can arrive during that wait; serialize them
            // so they update the first wrapper instead of adding a duplicate.
            if(this.pendingStreams[id]) {

                await this.pendingStreams[id]

                if(this.streams[id]) {
                    return this.updateVideoStream(opts.data)
                }
            }

            if(this.streams[id]) {
                return this.updateVideoStream(opts.data)
            }
            else {

                const pending = Promise.resolve().then(() => {
                    return this.addStream(opts.data)
                })

                this.pendingStreams[id] = pending

                try {
                    return await pending
                }
                finally {
                    if(this.pendingStreams[id] === pending) {
                        delete this.pendingStreams[id]
                    }
                }
            }
        }
        else if(opts.type === "REMOVE") {

            const pending = this.pendingStreams[opts.data]

            if(pending) {
                try {
                    await pending
                }
                catch(err) {
                    // The failed add has nothing for removeStream to clean up.
                }
            }

            return this.removeStream(opts.data)
        }
    }

    addStream(opts) {

        let res

        /**
         * @type { MediaStream }
         */
        let stream = opts.stream

        if(stream.getVideoTracks().length) {
            //
            res = this.addVideoStream(opts)
        }
        else if(stream.getAudioTracks().length) {
            //
            res = this.addAudioStream(opts)
        }
        else {
            //
            throw new Error("No track")
        }

        Emitter.emit(Events.STREAM_ADDED, res)

        return res
    }

    /**
     *
     * @param {ShareStreamOpts} opts
     */
    async addAudioStream({ stream, isLocal, id }) {
        //
        if(isLocal) return

        const wrapper = new AudioStream({ id, stream })

        this.streams[id] = wrapper

        return null

    }

    /**
     *
     * @param {ShareStreamOpts} opts
     */
    async addVideoStream({ stream, id, isLocal, opts, addedBy }) {

        this.visible = true

        const wrapper = new VideoStream({ stream, opts })

        await wrapper.init()

        this.add(wrapper)

        this.streams[id] = wrapper

        this.raycastMeshes.push(wrapper.mesh)

        if(isLocal) {

            this.localStream = id

            this.localData =  wrapper.getOptions()

            if(this.localData.placeholderId == null) {
                
                this.addInteractionEvents()
            }
        }

        return deepClone(this.localData)

    }

    removeStream(id) {

        const stream = this.streams[id]

        if(stream == null) {

            // Join/leave churn can fire a remove for a stream we never added
            // (or with an empty id); nothing to tear down, so don't throw.
            console.warn("[StreamContainer] removeStream: not found", id)

            return
        }

        if(stream instanceof VideoStream) {

            this.remove(stream)

            const idx = this.raycastMeshes.indexOf(stream.mesh)

            if(idx !== -1) {

                this.raycastMeshes.splice(idx, 1)
            }
        }

        delete this.streams[id]

        if(this.localStream === id) {

            this.helperText.visible = false

            this.localStream = null

            this.localData = null

            this.setMode(MODES.NA)

            this.removeInteractionEvents()
        }

        stream.dispose()

        Emitter.emit(Events.STREAM_REMOVED, id)

    }

    updateVideoStream({ id, opts }) {

        const stream = this.streams[id]

        if(stream == null) {

            console.warn("[StreamContainer] updateVideoStream: not found", id)

            return
        }

        if(stream instanceof VideoStream) {

            stream.setOptions(opts)

            if(this.localStream === id) {
    
                this.localData =  stream.getOptions()
    
                if(this.localData.placeholderId == null) {
                    
                    this.addInteractionEvents()
                }
                else {

                    this.setMode(MODES.NA)

                    this.removeInteractionEvents()
                }
            }
    
            return deepClone(this.localData)
        }
        else {

            console.error("not a video stream", id)
        }

    }


    dispose() {

        if(this.wasDisposed) return

        this.visible = false

        this.helperText.visible = false

        this.wasDisposed = true


        for (let uid in this.streams ) {

            this.removeStream(uid)
        }

        this.streams = {}

        this.removeInteractionEvents();

        this.transformControls.dispose()

        this.snapControls.dispose()
    }
}
