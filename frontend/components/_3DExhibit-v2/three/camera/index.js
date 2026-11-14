// @ts-check

/** @typedef { typeof MainCamera | typeof EditmodeCamera | typeof VRCamera | typeof DebugCamera | typeof TransitionCamera | typeof PlayerCamera | typeof SampleCamera } SpaceCamera */

import {

	CameraHelper,  Matrix4, Vector3, Frustum, Object3D, Quaternion, Euler
} from 'three'

import MainCamera 		from './main.js'

import EditmodeCamera 	from './editmode.js'

import VRCamera         from './vr'

import DebugCamera 		from './debug.js'

import PortalCamera 	from './portal.js'

import PlayerCamera     from './player.js'

import SampleCamera     from './sample.js'

import MapCamera        from './mapcamera.js'

import TransitionCamera from './transition.js'

import ControlsFactory  from './controls'

import Events  from '@3events'

import Emitter from '@3emitter'

import Players from "@3factory/player"

import gsap from 'gsap'

import Scene from '@3scene'

import ExpositionCamera from './exposition.js'

import Shared from '@3shared'

import CameraUtils from './utils'

import {

	DEBUG,

	DEBUG_CAM,

	APP_STATES,

	SET_IS_DEBUG_VIEW,

    EDIT_MODE,

    CURRENT_STATE,

    CURRENT_SPACE,

    VIEW,

    SET_IS_FIRST_PERSON,

    IS_FIRST_PERSON,

    IS_VR,

    CINEMATIC,

    IS_MULTIPLAYER,

    USER_INTERACTED,

    IS_DESKTOP,

    IS_MOBILE,

    PREVIOUS_STATE,

    STATIC_CAMERA,

    IS_TOUCH,

    USER_HEIGHT,

    UPLOADER_MODE,
    DOWN_VECTOR,

    FLY_MODE_LERP,

    FLY_MODE_PLERP,

    SET_IS_MAP_VIEW,

    IS_MAP_VIEW

} from '@3constants'

import {

    FAR,
    NEAR

} from './constants'

import gui from '@3gui'

import Augmented from '@3abstract/augmented'

import Cinematic from '@3modules/cinematic'

import Multiplayer from "@3factory/multiplayer"


import { delay } from '@utils/js'


import { SpaceItem } from '../factory/abstract/spaceitem.js'

import audioListener from '../globals/audioListener.js'

import raycaster from '../raycaster.js'

import { STATES } from '../factory/player/constants.js'

import { HiglightControls } from './controls/highlightcontrols/index.js'
import { soloDefaultSpaces } from '@components/_3DExhibit-v2/utils/constants'
import { yieldTask } from '../utils/yieldTask'

const MIN_ROTATION_CHANGE = 15 * Math.PI / 90;

let normalV3 = new Vector3();

const dirV3 = new Vector3()


/**
 *
 * TODO:
 * - background
 * -
 */

class Camera extends Augmented {

	constructor(){

        super()

        this.enabled = false

        /** @type { SpaceCamera } */
		this._current = null

		this.hasMoved = false

        this.currentPosition = null

        this.currentRotation = null

        this.active = true

		this.portalCamera = PortalCamera

        /** @type { typeof MainCamera } */
		this.mainCamera =  MainCamera

        this.mapCamera = MapCamera

        this.prevTouchEndTime = 0

        // window.camera = this.mainCamera

        this.isTransitioning = false;
        // cinematic cameras

		this.current = MainCamera

        this._viewOffset = { x: 0, y: 0 }

		this.worldDirection = new Vector3(0, 0, 0)

        this.currentControls = null

        this.thirdPersonCamInited = false;

        this.prevCameraState = {

            camera: null,

            controls: null,

            position: null,

            direction : null
        }

        this.idling = false

		if( DEBUG ){

			this.addDebug()

			if( DEBUG_CAM ) {

				this.current = DebugCamera
			}
		}

		this.addEvents()

        if( DEBUG ) {

            // @ts-ignore
            window.cameraIndex = this

            this.useMapControl = false

            gui.folders.camera.add( this, 'useMapControl' ).onChange((val)=>{

                this.toggleMapControls(val)

            })
        }


        this.frustum             = new Frustum()

        this.projScreenMatrix    = new Matrix4()


        /** @type { HiglightControls } */
        this.highlightControls    = null

        if (process.env.NODE_ENV === 'development') {

            window["$$cam"] = this
        }
	}

    _savedModes = []


    saveCurrentControls() {

        this.currentControls.enabled = false

        this._savedModes.push({
            controls: this.currentControls,
            camera: this.current
        })

        this.currentControls = null

    }

    restoreCurrentControls() {

        if (this._savedModes.length == 0) {

            throw new Error("No saved mode")
        }

        const { controls, camera } = this._savedModes.pop()

        this.currentControls?.dispose()

        this.currentControls = controls

        this.currentControls.enabled = true

        this.current = camera
    }

    // Initially map view is disabled,
    _savedProjSettings = {
        near: 0.1,
        far: 1000000,
    }

    _prevFog = null

    setFar( far = FAR ) {

        if (!IS_MAP_VIEW) {

            this.current.far = far;

            this.current.updateProjectionMatrix()
        }
        else {

            this._savedProjSettings.far = far
        }
    }

    getWorld() {
        //
        let world = this.currentControls?.world

        if (world == null) {

            world = this._savedModes.find(m => m.controls?.world)?.controls?.world
        }

        return world
    }

    setPhysicsOpts(opts) {

        const world = this.getWorld()

        if (world) {

            world.gravity = opts.gravity;

            world.jump = opts.jump;

            world.speed = opts.playerSpeed;

            world.playerState.quidditch = !!opts.quidditch;
        }
    }

    _applyProjSettings(settings) {

        // console.trace("apply proj settings", settings)

        this.current.far = settings.far

        this.current.near = settings.near

        this.current.updateProjectionMatrix()
    }

    toggleMapControls(opts) {

        if (opts.enabled == IS_MAP_VIEW) return;

        this._toggleMapAbort?.abort()

        const abort = this._toggleMapAbort = new AbortController()

        Emitter.emit(Events.CUSTOM, {
            type: Events.EDIT_MODE_CAMERA_MODE_SWITCH_START,
        })

        const settings = this._savedProjSettings

        this._savedProjSettings = {
            near: this.current.near,
            far: this.current.far
        }

        // console.log("toggle map controls", opts.enabled )

        SET_IS_MAP_VIEW(opts.enabled)

        if( opts.enabled == true ) {

            this._applyProjSettings(settings)

            this._prevFog = Scene.fog

            Scene.fog = null

            const editControls = this.currentControls

            const camera = this.current

            return editControls.toggleMapView(opts).then(() =>{

                if (abort.signal.aborted) return;

                // console.log("toggle map controls done")

                this.saveCurrentControls()

                this.current = MapCamera

                this.copyCamera(camera, MapCamera)

                MapCamera.activate()

                this.currentControls = MapCamera.controls

                Emitter.emit(Events.CUSTOM, {
                    type: Events.EDIT_MODE_CAMERA_MODE_SWITCH_DONE,
                })
            })
        }

        else {

            // console.log("toggle map controls", opts.enabled,  "current", this.current === MapCamera  ? "map" : "edit" )

            if (this.current === MapCamera) {

                MapCamera.desactivate()

                this.currentControls = null

                this.restoreCurrentControls()

                this.currentControls.goto(MapCamera.position, MapCamera.rotation)
            }

            Emitter.emit(Events.CUSTOM, {
                type: Events.EDIT_MODE_CAMERA_MODE_SWITCH_DONE,
            })

            return this.currentControls.toggleMapView(opts).then(() => {

                if (abort.signal.aborted) return;

                this._applyProjSettings(settings)

                Scene.fog = this._prevFog

                this._prevFog = null
            })
        }
    }



	async setState(STATE, opts){

        // if(CURRENT_STATE === APP_STATES.EXPOSITION && STATE === APP_STATES.SPACE) {
        //     debugger
        // }

        if ( STATE != APP_STATES.CINEMATIC ){

            if( this.cinematic != null) {

                this.cinematic.dispose()

                this.cinematic = null

                this.restoreCurrentControls()
            }
        }

        switch (STATE) {

            case APP_STATES.INTRO:

                if(this.currentControls) {

                    this.currentControls.dispose()
                }

                // !Shoul we break here??
            case APP_STATES.IDLE:


                this.currentControls?.removeEvents()

                if (IS_DESKTOP || IS_MOBILE) {

                    this.idling = true
                }

                if( CURRENT_STATE == APP_STATES.EXPOSITION ) {

                    this.currentControls.addEvents()

                    this.current = this.previousCamera
                }

                break

            case APP_STATES.EXPOSITION:

                if(this.current != ExpositionCamera) {

                    this.previousCamera = this.current

                    this.currentControls.removeEvents()
                }

                console.log(opts.artwork)

                const position = ExpositionCamera.getTargetPosition({

                    target: opts.artwork,

                    lookAtDistance: opts.artwork.maxLookatDistance(),

                    checkCollitions: true
                })


                this.current = ExpositionCamera

                const opts2 = {

                    artwork: opts.artwork,

                    position,

                    lookAt: opts.artwork.position

                }

                console.log(opts, position)

                this.current.setState( APP_STATES.EXPOSITION, opts2 )

                break

            case APP_STATES.SPACE :

                if(CURRENT_STATE == APP_STATES.PANORAMA ) {

                    break;

                    // return;
                }

                if ( this.idling ) {

                    this.idling = false
                }

                if(CURRENT_STATE === APP_STATES.IDLE) {

                    this.currentControls?.addEvents()
                }
                else if(CURRENT_STATE === APP_STATES.EXPOSITION) {

                    this.currentControls.addEvents()

                    this.current = this.previousCamera

                }
                else if(CURRENT_STATE === APP_STATES.TRANSITION) {

                    this.highlightControls?.removeEvents()

                    this.highlightControls?.setCamera(null)

                    const camera = this.current

                    const prevCamera = this.prevCameraState.camera

                    if(this.prevCameraState.position && this.prevCameraState.direction) {

                        this.current = TransitionCamera

                        await TransitionCamera.setState(STATE, {
                            camera,
                            position: this.prevCameraState.position,
                            direction: this.prevCameraState.direction
                        })

                        this.prevCameraState.position = null

                        this.prevCameraState.quaternion = null
                    }

                    this.copyCamera( this.current , prevCamera )

                    this.currentControls.setCamera( prevCamera )

                    this.current = prevCamera

                    this.currentControls?.addEvents()

                }
                else if (CURRENT_STATE === APP_STATES.CINEMATIC) {
                    //
                }
                else {
                    // 1st time space init
                    if(opts.space) {

                        await MainCamera.setState(STATE, opts)

                        // Controls choose their physics target from this mode flag.
                        // A previous space can leave it in third person even though
                        // this new session starts with MainCamera. Reset both before
                        // creating controls; the saved preference is applied afterward.
                        SET_IS_FIRST_PERSON(true)
                        this.current = MainCamera
                        this.active = true
                        this.thirdPersonCamInited = false

                        this.currentControls = await this.createControls()

                        let intersect

                        // collisions arent loaded in edit mode
                        if (!EDIT_MODE) {

                            intersect = await CameraUtils.intersectRay(this.current.position, DOWN_VECTOR);
                        }

                        if (!opts.editMode) {

                            this.currentControls.world?.update(0);
                        }



                        if ( !UPLOADER_MODE ) {

                            Players.main.position.set(
                                this.current.position.x,
                                intersect?.position?.y || USER_HEIGHT,
                                this.current.position.z
                            );

                            await PlayerCamera.setState(STATE, opts);

                        }

                        this.isEditing = EDIT_MODE
                    }

                    // Switching between edit and display mode
                    if (opts.switch) {

                        if(opts.switch === "display") {

                            if (EDIT_MODE) {
                                
                                if (IS_MAP_VIEW) {

                                    this._wasMapView = true

                                    await this.toggleMapControls({
                                        enabled: false,
                                        transition: false,
                                    });

                                }
                                

                                this.saveCurrentControls()

                                this.current = MainCamera

                                this.currentControls = await this.createControls("WASD")

                                this.setThirdPerson()

                                // this.currentControls.dragMode = false
                            }
                            else {

                                this.restoreCurrentControls()
                            }

                            this.isEditing = false
                        }
                        else if(opts.switch === "edit") {

                            const pos = this.current.position.clone()

                            const quat = this.current.quaternion.clone()

                            Players.main.hide();

                            if (EDIT_MODE) {

                                await this.setFirstPerson(false, true)

                                this.restoreCurrentControls()
                            }
                            else {

                                this.saveCurrentControls()

                                this.current = MainCamera

                                this.currentControls = await this.createControls("EDIT")
                            }

                            this.current.position.copy(pos)

                            this.current.quaternion.copy(quat)

                            await this.currentControls.setCoords(
                                this.current.position,
                                this.current.rotation,
                                false
                            )

                            if (this._wasMapView) {

                                this._wasMapView = false

                                await this.toggleMapControls({
                                    enabled: true,
                                    transition: false,
                                });
                            }

                            // this.currentControls.dragMode = true

                            this.isEditing = true

                            if(CURRENT_SPACE.roomParameters.isFuture) {

                                // this.toggleMapControls({
                                //     enabled: true,
                                //     transition: false
                                // })
                            }

                        }
                    }

                }
                break;

            case APP_STATES.TELEPORT :

                // this.currentControls = portalCamera.control

                const prevPos = IS_FIRST_PERSON ? this.portalCamera.position : this.portalCamera.controls.world.thirdPersonPos

                const prevRot = this.portalCamera.rotation

                this.portalCamera.controls.copyState(this.currentControls)

                // Switch controls
                this.currentControls.dispose()

                this.portalCamera.controls.world.isPreview = false

                this.currentControls = this.portalCamera.controls

                this.portalCamera.controls = null;

                this.currentControls.addEvents()

                // @ts-ignore
                this.current.copy(this.portalCamera)

                this.current.near = opts.roomParameters.near || this.current.near || NEAR

                this.current.far = opts.roomParameters.fog?.enabled ? opts.roomParameters.fog.far : this.current.far

                this.current.updateProjectionMatrix()


                if(IS_MULTIPLAYER) {

                    Players.main.position.copy(prevPos);

                    Players.main.rotation.y = prevRot.y;
                }

                this.currentControls.setCamera(this.current)

                await Players.main.setState(STATE, opts)

                await PlayerCamera.setState(STATE, opts);

                if (IS_MULTIPLAYER) {

                    Multiplayer.setState(STATE, opts);
                }

                await MainCamera.setState(STATE, opts)

                this.currentPosition = null

                this.currentRotation = null

                if(opts.enableThirdPerson) {

                    await delay(30)

                    await this.setThirdPerson()
                }

                break;

            case APP_STATES.TRANSITION:

                if (!IS_FIRST_PERSON && !opts.highlight) {

                    return
                }

                opts.camera = this.current

                this.prevCameraState.camera = this.current;

                if(opts.highlight) {

                    this.prevCameraState.position = this.current.position.clone()

                    this.prevCameraState.direction = this.current.getWorldDirection(new Vector3())

                }

                this.currentControls.removeEvents()

                this.current = TransitionCamera

                await TransitionCamera.setState(STATE, opts)

                this.copyCamera( this.current , MainCamera )

                if(opts.highlight) {

                    this.highlightControls ??= await ControlsFactory.get(null, 'HIGHLIGHT')

                    this.highlightControls.target.copy(TransitionCamera.lookatPos)


                    this.highlightControls.setCamera(MainCamera)

                    this.highlightControls.addEvents()
                }

                else {

                    this.currentControls.setCamera( MainCamera )
                }

                this.current = MainCamera

                break;

            case APP_STATES.CINEMATIC:

                if(opts.edit) {

                    this.saveCurrentControls()
                }

                if(this.cinematic == null){

                    this.current = EditmodeCamera

                    this.currentControls = await this.createControls()

                    this.cinematic = Cinematic

                    await this.cinematic.init( opts.edit, opts )

                }

                this.cinematic.active = true

                this.current = this.cinematic.current

                if( opts?.play ){

                    this.cinematic?.play?.({
                        playAll: true
                    })
                }

                if(opts?.records) {

                    opts.playAll = true

                    await this.cinematic?.record?.( opts )
                }

                if(opts?.download) {

                    this.cinematic?.download?.()
                }

                if(opts?.cancel) {

                    this.cinematic?.cancel?.()
                }

                break
        }

        this.stateDone( STATE, opts )
	}

    copyCamera( origin, target ){

        target.position.copy( origin.position )

        target.quaternion.copy( origin.quaternion )

    }

    async enterVR() {

        this.preVRCamera = this.current

        this.current = VRCamera

        // @ts-ignore
        this.current.setSpace?.(CURRENT_SPACE.space, CURRENT_SPACE.roomParameters)

        this.copyCamera(this.preVRCamera, VRCamera)

        this.currentControls = await this.createControls()

        this.currentControls.setCamera(this.current)

        this.addAudioListener()

    }

    async exitVR() {

        this.current = this.preVRCamera

        this.preVRCamera = null

        // @ts-ignore
        this.current.setSpace?.(CURRENT_SPACE.space, CURRENT_SPACE.roomParameters)

        this.copyCamera(VRCamera.parent, this.current)

        this.currentControls = await this.createControls()

        this.addAudioListener()
    }


    stateDone( STATE, opts ){

    }

	async createControls(type = null, opts = {}){

        // Building controls builds the room's collider (hundreds of ms in big
        // rooms); start it in its own task. The old controls keep running.
        await yieldTask()

        // We dispose old controls before we create new ones
        if (this.currentControls) {

            this.currentControls.dispose();

            this.currentControls = null;

        }

        console.log(this.current.position)

        const controls = await ControlsFactory.get(
            {

                space: CURRENT_SPACE.space,

                roomParameters: CURRENT_SPACE.roomParameters,

                isPreview: false,

                camera: this.current,

                ...opts
            },

            type
        );


        console.log(this.current.position)

        if( DEBUG_CAM  == false ) {

        	controls.addEvents();
        }

        return controls;
	}


    handleKeydown = ( e ) => {

        if (!EDIT_MODE || this.isEditing) return;

        if (e.key === "c" || e.key === "C") {

            if (UPLOADER_MODE || STATIC_CAMERA) return;

            if (IS_FIRST_PERSON) {

                this.setThirdPerson()
            } else {

                this.setFirstPerson()
            }
        }
    }


	onCollision( data ){



	}

    handleClick = (e) => {

        if (!IS_MULTIPLAYER) return;

        if (this.current === TransitionCamera) return;

        let diff = Date.now() - this.prevTouchEndTime

        let isDoubleClick = diff < 250

        this.prevTouchEndTime = Date.now()

        if (this.isTransitioning) return;

        // if (isDoubleClick && raycaster.currentSpaceItem == null) {

        //     if (IS_FIRST_PERSON) {

        //         this.setThirdPerson()
        //     } else {

        //         this.setFirstPerson()
        //     }
        // }
    }

	addEvents(){

        this.enabled = true

        this.startWatchLoaction()

		Emitter.on(Events.COLLISION, this.onCollision.bind(this))

        Emitter.on(Events.PRE_UPDATE, this.update.bind(this))

        Emitter.on(Events.TOUCH_END, this.handleClick)

        Emitter.on(Events.MOUSE_UP, this.handleClick)

        if( !CINEMATIC ) {

            Emitter.on(Events.KEY_DOWN, this.handleKeydown);

            // Emitter.on(Events.WHEEL, this.mouseWheel)
        }

        // if (IS_TOUCH) {
        // }

        // Emitter.on(Events.MOUSE_DOWN, this.mouseDown.bind(this))

        // Emitter.on(Events.POINTER_LOCK, this.pointerLock.bind(this));
	}

    //! Why no removeEvents ?

    startWatchLoaction = () => {

        if(CURRENT_SPACE && CURRENT_STATE !== APP_STATES.TRANSITION) {

            // console.log("startWatchLocation")

            const targetPos = this.currentControls?.world?.firstPersonPos || this.current.position

            const targetRot = IS_FIRST_PERSON ? this.current?.rotation : Players.main?.rotation

            if(this.currentPosition == null) {

                this.currentPosition = new Vector3().copy(targetPos)

                this.currentRotation = new Euler().copy(targetRot)
            }
            else {

                if(this.currentPosition.distanceToSquared(targetPos) > 4 ||
                    Math.abs(this.currentRotation.y - targetRot.y) > MIN_ROTATION_CHANGE
                ) {

                    this.currentPosition.copy(targetPos)

                    this.currentRotation.copy(targetRot)


                    if (!Players.main.isSitting) {

                        Emitter.emit(Events.CUSTOM, {
                            type: Events.PLAYER_LOCATION_CHANGED,
                            value: {
                                position: this.currentPosition,
                                rotation: this.currentRotation.y
                            }
                        })
                    };

                }
            }

        }

        gsap.delayedCall(1, this.startWatchLoaction)
    }

    getCurrentCoords() {
        //
        const position = (this.currentControls?.world?.firstPersonPos || this.current.position).clone()

        const rotation = (IS_FIRST_PERSON ? this.current?.rotation : Players.main?.rotation).clone()

        return {
            position,
            rotation
        }
    }

    cameraCoords = {
        position: new Vector3(),
        quaternion: new Quaternion()
    }

    _preFlyMode = {
        position: new Vector3(),
        quaternion: new Quaternion(),
        controls: null,
        thirdPerson: false,
        playerPosition: new Vector3(),
        capsule: null
    }

    isFly = false

    async setFlyMode (opts = {}) {

        if(this.isTransitioning) return

        const { enabled = false } = opts


        if(enabled == this.isFly) return;

        const world = this.currentControls?.world

        if (world == null) return;

        if(!enabled) {

            world.flymode = false

            if(this._preFlyMode.thirdPerson) {

                SET_IS_FIRST_PERSON(false)

                PlayerCamera.position.copy(this._preFlyMode.position)

                PlayerCamera.quaternion.copy(this._preFlyMode.quaternion)

                this.current = PlayerCamera
            }

            const prevControls = this.currentControls

            this.currentControls = this._preFlyMode.controls

            this.currentControls.setCamera(this.current)

            this.currentControls.world.target.copy(this._preFlyMode.playerPosition)

            this.currentControls.world.collisions.setCapsule(this._preFlyMode.capsule)

            this.currentControls.addEvents()

            this.currentControls.dragMode = prevControls.dragMode

            prevControls.dispose()

            this._preFlyMode.controls = null

            this._preFlyMode.thirdPerson = false
        }
        else {

            this._preFlyMode.controls = this.currentControls

            this._preFlyMode.playerPosition.copy(this.currentControls.world.target)

            this._preFlyMode.capsule = this.currentControls.world.collisions.capsule.clone()

            this._preFlyMode.position.copy(this.current.position)

            this._preFlyMode.quaternion.copy(this.current.quaternion)

            this._preFlyMode.thirdPerson = !IS_FIRST_PERSON

            this.currentControls.removeEvents()

            // prevent from disposing controls
            this.currentControls = null

            if (!IS_FIRST_PERSON) {

                MainCamera.position.copy(this.current.position)

                MainCamera.quaternion.copy(this.current.quaternion)

                SET_IS_FIRST_PERSON(true)

                this.current = MainCamera;
            }

            this.addAudioListener()

            this.currentControls = await this.createControls("FLY", { world })

            this.currentControls.setCamera(this.current)

            this.currentControls.dragMode = this._preFlyMode.controls.dragMode

            world.flymode = true
        }

        this.isFly = enabled

        const type = Events.CAMERA_SWITCH_MODE
        const value = enabled ? "first_person" : "third_person"

        Emitter.emit(type, value)

        Emitter.emit(Events.CUSTOM, { type, value })

    }

    setStabilization = (opts) => {

        if(this.currentControls == null) return

        const lerp = FLY_MODE_LERP[opts];

        this.currentControls.setLerp(lerp);

        const plerp = FLY_MODE_PLERP[opts]

        this.currentControls.setPlerp(plerp);

    }

    setFlyModeSpeed = (opts) => {

        if(this.currentControls == null) return

        this.currentControls.setSpeed(opts);

    }

    enableAdjustCamera(opts) {

        PlayerCamera.isAdjustCamera = opts;

    }

    setFirstPerson = async (isTeleporting = false, noTransition = false) => {

        if (this.currentControls?.world == null || this.isTransitioning || this.isFly) return;

        if (this.current === MainCamera) return;

        this.isTransitioning = true;

        if(noTransition) {

            MainCamera.position.copy(this.currentControls.world.firstPersonPos)

            MainCamera.quaternion.copy(this.current.quaternion)

        } else {

            this.currentControls.removeEvents();
            // PlayerCamera.yOffset = this.currentControls.world.firstPersonPos.y;

            // Start position
            SampleCamera.position.copy(this.current.position);

            SampleCamera.rotation.set(this.current.rotation.x, this.current.rotation.y, this.current.rotation.z);

            SampleCamera.near = this.current.near

            SampleCamera.far = this.current.far

            SampleCamera.updateProjectionMatrix()

            this.current = SampleCamera


            // Will calculate end position of sample
            await this.playerModeTransition(false, isTeleporting)

            // Target
            MainCamera.position.copy(SampleCamera.position);

            MainCamera.rotation.set(SampleCamera.rotation.x, SampleCamera.rotation.y, SampleCamera.rotation.z);
        }

        SET_IS_FIRST_PERSON(true);


        Players.main.hide();

        this.current = MainCamera;

        this.addAudioListener()

        this.currentControls.setCamera(this.current)

        this.isTransitioning = false;

        this.currentControls.addEvents();

        const type = Events.CAMERA_SWITCH_MODE

        const value = "first_person"

        Emitter.emit(type, value)

        Emitter.emit(Events.CUSTOM, { type, value })

    }


    setThirdPerson = async (init = false, noTransition = false) => {

        if (this.currentControls?.world == null || !Players?.main || this.isFly) return;

        // A headset always sees through the VR camera; the saved third-person
        // preference applies again when the session ends (world3D.exitVR).
        if (IS_VR) return;

        if (this.isTransitioning) return;

        if (!this.thirdPersonCamInited) {

            PlayerCamera.setSpace(CURRENT_SPACE.space, CURRENT_SPACE.roomParameters, true)

            this.thirdPersonCamInited = true
        }

        if (this.current === PlayerCamera) return;

        this.isTransitioning = true;

        this.currentControls.removeEvents();


        SET_IS_FIRST_PERSON(false);

        Players.main.show();

        if (noTransition) {
            // Travel stages the final safe framing before the iframe is visible.
            PlayerCamera._rotation = this.current.rotation;
            PlayerCamera._position = Players.main.position;
            this.current = PlayerCamera;
            this.addAudioListener();
            this.currentControls.setCamera(this.current);
            this.isTransitioning = false;
            this.currentControls.addEvents();
            const type = Events.CAMERA_SWITCH_MODE, value = "third_person";
            Emitter.emit(type, value);
            Emitter.emit(Events.CUSTOM, { type, value });
            return;
        }

        SampleCamera.position.copy(this.currentControls.world.firstPersonPos);

        SampleCamera.rotation.copy(MainCamera.rotation);

        SampleCamera.near = MainCamera.near

        SampleCamera.far = MainCamera.far

        SampleCamera.updateProjectionMatrix()

        this.current = SampleCamera;

        // positio is derived from avatar position

        PlayerCamera._rotation = MainCamera.rotation;

        PlayerCamera.update(0.1);

        PlayerCamera.radius = PlayerCamera.targetRadius

        PlayerCamera.update(0.1);

        await this.playerModeTransition(true)

        // VR started during the transition: keep the VR camera it set up.
        if (IS_VR) {

            SET_IS_FIRST_PERSON(true);

            Players.main.hide();

            this.isTransitioning = false;

            this.currentControls.addEvents();

            return;
        }

        this.current = PlayerCamera

        this.addAudioListener()

        this.currentControls.setCamera(this.current)

        this.isTransitioning = false;

        this.currentControls.addEvents();

        const type = Events.CAMERA_SWITCH_MODE
        const value = "third_person"

        Emitter.emit(type, value)

        Emitter.emit(Events.CUSTOM, { type, value })

    }

    addAudioListener() {

        // A returning session may already have audio permission while its
        // avatar is still preparing. Keep listening from the camera until ready.
        const parent = !IS_FIRST_PERSON && Players.main ? Players.main : this.current;
        parent?.add(audioListener);

        USER_INTERACTED.then(() => {

            if(audioListener.context.state != "running") {

                audioListener.context.resume()
            }
        })

        console.log("switch audio listener parent", audioListener)

    }

    teleport(opts) {

        this.currentControls.cameraControls.moveTo(opts.position.x, opts.position.y, opts.position.z);

        if(opts.rotation?.y) {

            this.current.rotation.y = opts.rotation?.y
        }

    }

    mouseWheel = async (e) => {

        // if (!IS_MULTIPLAYER) return;

        if (e.wheelDelta > 0) {

            this.setFirstPerson()
        } else {

            this.setThirdPerson()
        }
    }

	set current( val ) {

		SET_IS_DEBUG_VIEW( false )

		if(this.current != null && this.current.desactivate){

			this.current.desactivate()

            // this.current.clearViewOffset()
		}

		this._current = val

		if( this.current != null && this._current.activate){

			this._current.activate()

		}

		if( this.helper ){

	 		this.helper.visible = this._current == DebugCamera
	 	}

	 	if( this.current == DebugCamera ) {

	 		SET_IS_DEBUG_VIEW( true )
	 	}

        Emitter.emit( Events.CAMERA_SWITCH, this.current )

	}

    /** @returns { SpaceCamera } */
	get current() {

		return this._current
	}

	addDebug(){

		this.helper = new CameraHelper( this.mainCamera )

		Scene.add( this.helper )

		this.helper.visible = false

		this.debug = false

		gui.folders.camera.add( this, 'debug' ).onChange((val)=>{

			if( val == true ){

				this.current = DebugCamera
			}

			else {

				this.current = this.mainCamera
			}

		})
	}

    set viewOffset( val ){

        this._viewOffset = val
    }

    get viewOffset(){

        return this._viewOffset
    }

    update(delta) {

        if( this.idling ) {

            // const t =  Shared.timer.value * 0.25
            // const t2 = Shared.timer.value * 0.35 + 454.0

            // MainCamera.rotation.y = Math.sin(t) * Math.sin( t * 1.5) * 0.05;
            // MainCamera.rotation.x = Math.sin(t2) * Math.sin( t2 * 1.5) * 0.05;

            // console.log('idling')
        }

        if(!this.active) return

        // this.updateFrustum()

        // @ts-ignore
        this.current?.update?.(delta);

        this.current.getWorldDirection( this.worldDirection )

        // this.vOffset()

        this.updateFrustum()

    }

    vOffset(){

        if( this.viewOffset.x != 0 || this.viewOffset.y != 0 ) {

            this.current.setViewOffset( VIEW.w, VIEW.h, this.viewOffset.x * 0.5, this.viewOffset.y * 0.5, VIEW.w, VIEW.h )
        }

        else {

            this.current.clearViewOffset()
        }
    }

    updateFrustum( camera = null ){

        const cam  = camera ? camera : this.current

        this.projScreenMatrix.multiplyMatrices( cam.projectionMatrix, cam.matrixWorldInverse )

        this.frustum.setFromProjectionMatrix( this.projScreenMatrix )
    }

    /**
     *
     * @param { Object3D } object
     * @returns { boolean }
     */
    isObjectVisible(object) {
        return this.frustum.intersectsObject(object)
    }


    transitionTargetPos = new Vector3()

    async playerModeTransition (isFirstPerson, isTeleporting) {

        let currentState = {}

        let finalState = {}


        if(isFirstPerson) {

            Players.main.show()

            currentState.x = this.currentControls.world.firstPersonPos.x

            currentState.y = this.currentControls.world.firstPersonPos.y

            currentState.z = this.currentControls.world.firstPersonPos.z

            currentState.opacity = 0

            finalState.x = PlayerCamera.position.x

            finalState.y = PlayerCamera.position.y

            finalState.z = PlayerCamera.position.z

            finalState.opacity = 1

        }
        else {

            currentState.x = PlayerCamera.position.x

            currentState.y = PlayerCamera.position.y

            currentState.z = PlayerCamera.position.z

            currentState.opacity = 1


            this.currentControls.world.correctCollisionHeightfromVRM()

            this.transitionTargetPos
                    .copy(this.currentControls.world.firstPersonPos)
                    .sub(PlayerCamera.position)
                    .multiplyScalar(isTeleporting ? 0.95 : 1)
                    .add(PlayerCamera.position)


            finalState.x = this.transitionTargetPos.x

            finalState.y = this.transitionTargetPos.y
//
            finalState.z = this.transitionTargetPos.z

            finalState.opacity = 0

        }

        const roomParameters = CURRENT_SPACE.roomParameters

        let duration = .8;

        const ease = "power2.inOut"

        const animPos = new Promise(resolve => {
            gsap.to(currentState, {
                ...finalState,
                duration,
                ease,
                onUpdate() {

                    SampleCamera.position.set(currentState.x, currentState.y, currentState.z);

                    if( Players.main ) {

                        Players.main.setOpacity(currentState.opacity)

                    }

                },
                onComplete() {

                    if( Players.main ) {

                        Players.main.setOpacity(1)

                        if (finalState.opacity !== 0) {
                            Players.main.show()
                        } else {
                            Players.main.hide()
                        }
                    }

                    resolve()

                }
            })
        })

        await Promise.all([ animPos ])
    }

    /**
     *
     * @param { Vector3 } position
     * @param { Euler | Vector3 } rotation
     */
    goto(position, rotation = null) {

        if (Players.main.deactivated) return;

        this.currentControls?.goto?.(position, rotation)

    }


    teleportTo = (position) => {

        if (Players.main.deactivated) return;

        if (!IS_FIRST_PERSON) {
            position.y += 0.35

            this.currentControls.world.collisions.capsule.start.setY(position.y)

            this.currentControls.world.collisions.capsule.end.setY(position.y + 0.35 + this.currentControls.world.colliderHeight)

            this.currentControls.world.target.setX(position.x)

            this.currentControls.world.target.setZ(position.z)
        } else {

            this.currentControls.world.target.set(position.x, position.y + 0.70 + this.currentControls.world.colliderHeight, position.z)
        }

        return;
    }

    async playTransition(opts) {

        const camera = this.current;

        const controlsEnabed = this.currentControls.enabled

        this.currentControls.removeEvents()

        this.current = TransitionCamera

        await TransitionCamera.setState(APP_STATES.TRANSITION, { ...opts, camera })

        this.copyCamera( this.current , camera )

       this.currentControls.setCamera( camera )

       if(controlsEnabed) this.currentControls.addEvents()

        this.current = camera

    }

    /**
     * @param { SpaceItem } target
     * @param { boolean } [checkCollitions]
     * @param { string } [transition]
     */
    gotoTarget(target, checkCollitions = true, transition) {

        if (Players.main.deactivated) return;

        let { position, rotation } = this.getPreferredTragetLookatCoords(target, checkCollitions)

        if(transition === "fade") {

            return this.playTransition({
                fadeTo: { targetPosition: position, targetDirection: rotation }
            })
        }

        else {

            return this.goto(position, rotation)
        }
    }

    focusOn(opts) {

        if(opts.target == null) return;

        return this.currentControls?.focusOn?.(opts)
    }


    /**
     *
     * @param { SpaceItem } target
     * @param { boolean } checkCollitions
     * @returns
     */
    getPreferredTragetLookatCoords(target, checkCollitions) {

        let prefLookatDistance = target.maxLookatDistance()

        let distance = prefLookatDistance

        let meshPosition = target.position.clone()

        let meshDirection = target.getWorldDirection(new Vector3())

        meshPosition.add(meshDirection.setLength(distance))

        if(checkCollitions) {

            // Check if distance will fall outside the room

            let result = this.intersectRay(meshPosition, meshDirection)

            if(result != null && result.distance < distance && result.distance > 2) {

                console.log("will fall outside", distance, " > ", result.distance)

                console.log(result.triangle)

                distance = result.distance - (this.currentControls.world?.playerRadius || 1)

                meshPosition.copy(target.position).add(meshDirection.setLength(distance))

            }

            // Compute correct user height at the end of the transition

            let currentHeight = this.distanceToFloor(this.currentControls?.world?.firstPersonPos)

            console.log("current height", currentHeight)

            let targetHeight = this.distanceToFloor(meshPosition)

            console.log("target height", targetHeight)

            // If there's no floor most likely we're outside of the room
            // reset to a safe distance then recomputes the final user height

            let testDistance = Math.max(9, prefLookatDistance) * 2

            while(targetHeight === Infinity) {

                if(testDistance < 2) {

                    console.log("No safe place: abort transition")

                    return
                }

                console.log("mmm artwork seems to be outside?")

                // test with a smaller distance
                testDistance = testDistance / 2

                distance = testDistance

                meshPosition.copy(target.position).add(meshDirection.setLength(distance))

                targetHeight = this.distanceToFloor(meshPosition)
            }



            if(targetHeight < 0 || currentHeight < 0) {

                meshPosition.y = Math.max(this.currentControls?.world.firstPersonPos.y || 0, meshPosition.y)

            }
            else if(currentHeight !== targetHeight) {

                meshPosition.y -= targetHeight - currentHeight

                // Check final Y position
                this.targetCollitions(meshPosition)

                console.log("Correcting final Y", targetHeight, "current height", currentHeight, "target height", targetHeight)
            }

            console.log("Target mesh pos", meshPosition)
        }

        return {
            position: meshPosition,

            rotation: target.position.clone().setY(Math.max(meshPosition.y, target.position.y))
        }
    }

    /**
     * @param { number } distance
     * @returns
     */
    getPreferredInitPosition(distance) {


        const cameraPosition = IS_FIRST_PERSON ? this.current.position : Players.main.position

        let cameraDirection = new Vector3()

        this.current.getWorldDirection(cameraDirection)


        // Check if distance will fall outside the room

        let result = this.intersectRay(cameraPosition, cameraDirection)

        if(result != null && result.distance < distance) {

            console.log("will fall outside", distance, " > ", result.distance)

            distance = result.distance - 0.5
        }

        let position = cameraPosition.clone().add(cameraDirection.setLength(distance))

        position.y = IS_FIRST_PERSON ? position.y : position.y + USER_HEIGHT

        return position
    }

     /**
     *
     * @param { Vector3 } origin
     * @param { Vector3 } direction
     */
    intersectRay(origin, direction) {

        return this.currentControls.world?.rayIntersect(origin, direction)

    }


    distanceToFloor(point) {

        return this.currentControls.world?.distanceToFloor(point)
    }

    targetCollitions(target) {

        let result = this.currentControls.world?.playerCollitions(target)

        if(result?.result) {

            target.copy(result.endPosition)

            return result.result
        }
    }

    setCinematicLayout( mode ){

        return Cinematic.setCinematicLayout( mode )
    }

    releaseSession() {
        this._toggleMapAbort?.abort();
        this._toggleMapAbort = null;
        const controls = new Set([this.currentControls, MapCamera.controls,
            ...this._savedModes.map(mode => mode.controls), this.highlightControls]);
        for (const control of controls) control?.dispose?.();
        this.currentControls = null;
        this.highlightControls = null;
        this._savedModes = [];
        this.cinematic?.dispose();
        this.cinematic = null;
        this.current?.desactivate?.();
        MapCamera.desactivate();
        MapCamera.controls = null;
        SET_IS_MAP_VIEW(false);
        this._prevFog = null;
        Scene.fog = null;
        this.current = MainCamera;
        this.thirdPersonCamInited = false;
        this.idling = false;
    }

    dispose() {

        this.currentControls?.dispose()

        this.current.desactivate()

        // this.current.clearViewOffset()
    }
}

export default new Camera()
