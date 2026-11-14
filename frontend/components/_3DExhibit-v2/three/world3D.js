// @ts-check

import Renderer, { syncAntialias } from "@3renderer"

import Emitter 		from "@3emitter"

import Events 		from "@3events"

import Scene        from "@3scene"

import History      from "@3history"

import Root 		from './root'

import Camera         from "@3camera"

import {

	STATS,

    APP_STATES,

    CURRENT_STATE,

    SET_VR,

    SET_CURRENT_SPACE,

    CURRENT_SPACE,

    IS_VR_URL,

    SET_CINEMATIC_PREVIEW_SIZE,

    IS_VR,

    IS_FIRST_PERSON,
    IS_MAP_VIEW,
    EDIT_MODE,
    UPLOADER_MODE,
    CAMERA_LAYERS,
    IS_RECORDING,
    CINEMATIC,

} from '@3constants'


import RenderStats from './utils/stats'

import SpaceFactory from '@3factory/space/'

import CSS3DRenderer from './renderer/css3D/renderer'

import Dynamicportal from "./renderer/dynamicportal"

import CinematicThumbRenderer     from './renderer/cinematicthumb'

import RenderList from "@3gl/globals/renderlist"


import Mod from '@3utils/math/mod'

import Cache from '@3modules/cache'

import gsap from 'gsap'

import Shared from '@3shared'

import Raycaster from "@3raycaster";

import { hasCSSEmbeds } from "@3/utils/exhibit"
import { projectPoint } from "./utils/three"


import { Color, Object3D, Quaternion, Vector3 } from "three"

// ColorManagement.legacyMode = true

import PortalScreenshot from "./renderer/portalscreenshot"

import { PortalCamera } from "./camera/portal"

import { SpacePlaceholder } from "./factory/artwork/placeholders/spaceplaceholder"

import PostProcessing from "./renderer/postprocessing"


import FPSCalc from '@3utils/fps.js'

import Cinematic from "@3gl/modules/cinematic"


import { GlobalSpaceArtwork } from "./factory/artwork/meshes/globalstream/globalstreamartwork"
import { SitZoneSpaceArtwork } from "./factory/artwork/meshes/triggerzone/zones/sitzonespaceartwork"
import { ModelSpaceArtwork } from './factory/artwork/meshes/model/modelspaceartwork'

import Loader from '@3loader'

import { MODEL_MEDIA } from './utils/mediatype'

import { SpaceComponent } from './factory/abstract/spacecomponent'

import { RENDER_ON_DEMAND, RenderDemand } from './utils/renderDemand'

import { createRenderGate } from './utils/renderDemandGate'

import { xrSessionInit } from './xr/xrBackend'

// const USE_POSTPROCESSING = IS_FUTURE

// The states a visitor settles in, where an unchanged frame is not drawn.
/** @type { Set<string> } */
const SKIPPABLE_STATES = new Set([ APP_STATES.IDLE, APP_STATES.SPACE, APP_STATES.EXPOSITION ])

export default class World3D {

    constructor() {

        /** @type { import("@gltypes").SpaceStateOptions } */
        this.opts = null

        this.currentExpositionIndex = -1

        this.perfnow  = performance.now()

        this.time = 0

        // @ts-ignore
        window.takeBase64Screenshot = this.takeBase64Screenshot

        // QA handle for renderer comparisons in production builds (?inspect).
        if( new URLSearchParams( window.location.search ).has( "inspect" ) ) {

            // @ts-ignore
            window.__oncyber = { Renderer, Scene, Camera, Root, PostProcessing, Dynamicportal, world: this }
        }


        window["$bench"] = {
            generate: (d, p) => {
                //

                window["$bench"].clear()

                if (typeof p === "number") {

                    p = Array(d).fill(p)
                }

                this.benchRoot = new Object3D()

                this.benchRoot.name = "bench"

                Scene.add(this.benchRoot)

                generate(d, p, this.benchRoot)
            },
            clear: () => {
                //
                if (this.benchRoot) {

                    Root.remove(this.benchRoot)

                    this.benchRoot = null
                }
            }
        }
    }

    async preload(){


 

        await Loader.addKTX()

        await Root.preload()

        return Promise.resolve()
    }

    async start(){

    	return new Promise( async(resolve)=>{

    		this.addEvents()

            // The quality may have been set before the first resize reached us.
            syncAntialias()

            if( RENDER_ON_DEMAND && this.renderGate == null ) {

                this.renderGate = createRenderGate({

                    demand: RenderDemand,

                    renderer: Renderer,

                    emitter: Emitter,

                    frameEvents: [

                        Events.DAWN_UPDATE,

                        Events.PRE_UPDATE,

                        Events.UPDATE,

                        Events.POST_UPDATE,

                        Events.DUSK_UPDATE,

                        Events.PRE_RENDER,
                    ],

                    gsap,
                })

                this.renderGate.install()
            }

            Root.start()

            Scene.add( Root )

    		resolve()
    	})
    }

    /**
     *
     * @param {string} STATE
     * @param {any} opts
     * @returns
     */
    setState(STATE, opts = {}) {


        return new Promise(async (resolve, reject) => {
            try {

            // a new state draws (render on demand)
            this.renderGate?.invalidate()

            Raycaster.active = false

            var ps = []

            this.opts = opts

            switch (STATE) {

                case APP_STATES.EXIT:

                    // ps.push(Camera.setState(STATE, opts))

                    ps.push( Root.setState(STATE, opts))

                    ps.push(Camera.setState(STATE, opts))

                    ps.push( Promise.resolve().then(()=>{

                        SET_CURRENT_SPACE(null)
                     }))

                    break

                case APP_STATES.INTRO:

                	// ps.push(Camera.setState(STATE, opts))

                    ps.push( Root.setState(STATE, opts))

                    break


                case APP_STATES.IDLE:

                    ps.push(Camera.setState(STATE, opts))

                    break

                case APP_STATES.EXPOSITION:

                    const expositionArtworks = Root.currentArtworks?.artworks?.filter?.(artwork => {
                        return !artwork.isPlaceholder && artwork?.userData?.mime_type !== "cyber/globalstream"  && artwork?.userData?.mime_type !== "cyber/text" && !(artwork instanceof SitZoneSpaceArtwork)
                    })

                    if( expositionArtworks.length == 0 ){

                        console.log('no artwork to fade in ')

                        break;
                    }

                    Root.add( Cache )

                    ps.push(

                        new Promise(( resolve )=>{


                            if( this.expoTween ) {

                                this.expoTween.kill()

                                this.expoTween = null
                            }

                            const add = opts.next == true ? 1 : opts.previous == true ? -1 : 1

                            this.currentExpositionIndex = Mod(this.currentExpositionIndex + add , expositionArtworks.length )

                            this.expoTween = gsap.to(Cache, {

                                alpha: 1,

                                duration: 1,

                                onComplete:()=>{


                                    const artwork = expositionArtworks[ this.currentExpositionIndex ]

                                    console.log("expose artwork", artwork)

                                    Camera.setState( STATE, {

                                        artwork,

                                    } )


                                    this.expoTween = gsap.to(Cache, {

                                        alpha: 0,

                                        duration: 1,

                                        onComplete:()=>{

                                            Root.remove( Cache )

                                            resolve()

                                            this.expoTween = null
                                        }
                                    })

                                }
                            })

                        })

                    )

                    break

                case APP_STATES.SPACE:

                    if( CURRENT_STATE == APP_STATES.TRANSITION ) {

                        ps.push(Cache.hide(0, 0.5))

                        await Promise.all([
                            Camera.setState(STATE, opts),
                            Root.setState(STATE, opts),
                        ])

                        break;
                    }

                    this.currentExpositionIndex = 0

                    if(opts?.space) {

                        SET_CURRENT_SPACE(opts)
                    }

                    if( CURRENT_STATE == APP_STATES.EXPOSITION ) {

                        await Cache.show(1, 1)

                        Camera.setState( STATE, {} )

                        await Cache.hide(0, 1)

                        break;
                    }

                    if( CURRENT_STATE == APP_STATES.PANORAMA ) {

                        await Root.setState(STATE, opts)

                        break;
                    }

                    if(opts?.from) {

                        History.push(opts.from, opts.backState)
                    }

                    if (opts.space && IS_MAP_VIEW) {

                        ps.push(Camera.toggleMapControls({ enabled: false, transition: false }))
                    }

                    ps.push(
                        Camera.setState(STATE, opts).then( async () => {

                            if(CURRENT_STATE !== APP_STATES.IDLE || opts.editMode || opts.switch) {

                                await Root.setState(STATE, opts)

                                this.previousOpts = this.opts
                            }
                        }).then(async () => {

                            if(EDIT_MODE && opts.space && opts.roomParameters.isFuture) {

                                await Camera.toggleMapControls({
                                    enabled: true,
                                    transition: false
                                })
                            }
                        })
                    )

                    if (UPLOADER_MODE) {

                        // The environment settings panel (TweakPane,
                        // react-color) loads only in the uploader, never
                        // for visitors. The state settles once it is built,
                        // as it did when the import was static.
                        ps.push(
                            import("@3editgui/physics").then(({ PhysicsGUI }) => {

                                PhysicsGUI(this.uploaderSetRoomParameters)
                            }).catch((error) => {

                                // the space still opens without its panel
                                console.error("Environment settings panel failed to load", error)
                            })
                        )
                    }

                    break


        // per space too

                case APP_STATES.TELEPORT:

                    Shared.scanTimer.value = 0

                    if(opts.backState == null) {

                        History.pop()
                    }
                    else {

                        History.push(opts.from, opts.backState)
                    }

                    SET_CURRENT_SPACE(opts)

                    ps.push( Camera.setState(STATE, opts) )

                    ps.push( Root.setState(STATE, opts) )

                    this.previousOpts = this.opts

                    break

                case APP_STATES.TRANSITION:

                    Raycaster.active = !opts.highlight

                    ps.push( Root.setState(STATE, opts) )

                    ps.push( Camera.setState(STATE, opts) )

                    if ( opts.highlight ) {

                        Cache.show(0.8, 1)
                    }

                    break

                case APP_STATES.CINEMATIC:

                    ps.push( Root.setState(STATE, opts) )

                    ps.push( Camera.setState(STATE, opts) )


                    break

                case APP_STATES.PANORAMA:

                    Raycaster.active = false

                    ps.push( Root.setState(STATE, opts) )

                    break
            }

            Promise.all(ps).then( () => {

                if( STATE == APP_STATES.CINEMATIC || STATE === APP_STATES.INTRO || STATE == APP_STATES.PANORAMA ||

                    STATE === APP_STATES.TRANSITION) {
                }
                else {
                    Raycaster.active = true
                }

                CSS3DRenderer.active = true

            	return this.stateDone( STATE, opts ).then(()=>{

                    if( STATE == APP_STATES.EXIT ) {

                        this.dispose()
                    }

                	resolve()
            	})


            }).catch(reject)
            } catch (error) { reject(error); }
        })
    }


    stateDone(STATE, opts){

        return new Promise((resolve)=>{

            var ps = []

            ps.push( Root.stateDone( STATE, opts ) )

            resolve( ps )
        })
    }

    getArtworks(opts) {

        return Root.getArtworks(opts);
    }

    getPortals(opts) {

        return Root.getPortals(opts);
    }

    getKitbashElements(opts) {

        return Root.getKitbashElements(opts);
    }

    getPlaceholders(opts) {

        return Root.getPlaceholders(opts)
    }

    /**
     *
     * @param {string} artworkId
     *
     * @returns { import("@3constants").PERF_SCORE }
     */
    getPerfScore(artworkId) {

        return Root.getPerfScore(artworkId)
    }

    getItem(id) {
        //
        return Root.getItem(id)
    }

    enableAdjustCamera(opts) {

        return Camera.enableAdjustCamera(opts);

    }

    async enterVR() {

        if(IS_VR) return

        Raycaster.active = false

        // A first/third-person switch still animating would ignore the
        // switch below and leave the headset behind the avatar.
        await Camera.waitForTransition()

        if(IS_VR) return

        this.wasThirdPerson = !IS_FIRST_PERSON

        if(this.wasThirdPerson) {

            await Camera.setFirstPerson(false, true)
        }

        SET_VR(true)

        await this.enableImmersiveVR()

        await Camera.enterVR()

        Raycaster.active = true
    }

    setJump(opts) {
        return Root.setJump(opts);
    }

    stopPlayer() {

        return Root.stopPlayer()
    }

    async exitVR() {

        if(!IS_VR) return

        SET_VR(false)

        Renderer.xr.enabled = false

        // Back to the quality's MSAA.
        syncAntialias()

        await Camera.exitVR()

        if(this.wasThirdPerson) {

            await Camera.setThirdPerson()
        }
    }

    enableImmersiveVR = async () => {

        if (!Renderer.xr.enabled) {

            Renderer.xr.enabled = true

            Renderer.xr.setReferenceSpaceType("local")

            Renderer.setPixelRatio(1)

            // VR keeps full MSAA whatever the quality (IS_VR is already set);
            // the XR layer reads the count when the session starts.
            syncAntialias()


            const sessionInit = xrSessionInit({

                isWebGPUBackend: /** @type { any } */ (Renderer.backend)?.isWebGPUBackend === true,
            })

            // @ts-ignore
            const session = await navigator.xr.requestSession( 'immersive-vr', sessionInit )

            console.log("xr session aquired")

            const onSessionEnded = () => {

                session.removeEventListener( 'end', onSessionEnded )

                Emitter.emit(Events.VR_SESSION_END, {})

                Emitter.emit(Events.CUSTOM, {

                    type: Events.VR_SESSION_END,
                })
            }

            session.addEventListener( 'end', onSessionEnded );

            await Renderer.xr.setSession(session)

            console.log("Immersive mode enabled")


            Emitter.emit(Events.VR_SESSION_START, {})

            Emitter.emit(Events.CUSTOM, {

                type: Events.VR_SESSION_START,
            })


        }
    }


    uploaderSetRoomParameters(opts) {
        return Root.uploaderSetRoomParameters(opts)
    }

    handleCommand(opts) {

        return Root.handleCommand(opts)
    }

     /**
     *
     * @param { { enabled: boolean, noTransition?: boolean } } opts
     * @returns { Promise<unknown> }
     */
    setThirdPerson(opts) {

        if(opts.enabled) {

            return Camera.setThirdPerson(false);
        }
        else {

            return Camera.setFirstPerson(false, opts.noTransition)
        }

    }

    setFlyMode(opts) {

        return Camera.setFlyMode(opts)
    }

    setStabilization(opts) {

        return Camera.setStabilization(opts)
    }

    setFlyModeSpeed(opts) {

        return Camera.setFlyModeSpeed(opts)

    }

    setShowUsername(val) {
        return Root.showUsername(val);
    }

    updateVideoStream(opts) {
        return Root.updateVideoStream(opts)
    }

    toggleAvatarMode( val ) {

        return Root.toggleAvatarMode( val )
    }

    summonLinkPortal(opts) {
        return Root.summonLinkPortal(opts)
    }

    getCurrentControls(opts) {

        return Camera.currentControls;
    }


    takeScreenshot(opts) {

        // open in new window like this


        //w.document.body.style.backgroundColor = "red";

        var img = new Image();

        // if(opts.color) {

        //     if(typeof opts.color === "string") {

        //         opts.color = new Color(opts.color)
        //     }

        //     // BackgroundRenderer.set(color)

        //     // BackgroundRenderer.render(Camera.current)
        // }

        // Without 'preserveDrawingBuffer' set to true, we must render now

        PostProcessing.render(Scene, Camera.current, CURRENT_SPACE?.roomParameters || {} );
        // Renderer.render(Scene, Camera.current);

        img.src = Renderer.domElement.toDataURL("image/jpeg", 1.0);

        if (opts.download) {
            const link = document.createElement('a')
            link.href = img.src;

            link.download = `${ CURRENT_SPACE?.exhibit?.info?.headline || CURRENT_SPACE?.roomParameters?.name } by ${  CURRENT_SPACE?.exhibit?.owner }.jpg`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link);
        } else {
            var w = window.open("", "");

            console.log(w);

            w.document.title = "Screenshot";

            w.document.body.appendChild(img);
        }
    }

    _cameraPosition = new Vector3()

    _cameraQuaternion = new Quaternion()

    _resetCameraCoords() {

        this._cameraPosition.copy(Camera.current.position)

        this._cameraQuaternion.copy(Camera.current.quaternion)

        // @ts-ignore
        Camera.current.reset?.()

    }

    _restoreCameraCoords() {

        if(this._cameraPosition) {

            Camera.current.position.copy(this._cameraPosition);

        }

        if(this._cameraQuaternion) {

            Camera.current.quaternion.copy(this._cameraQuaternion);
        }

    }

    async _waitForArtworksToLoad(camera, timeout = 0) {


        // Wait at most timeout milliseconds for artworks to load
        return new Promise((resolve, reject) => {

            const tid = setTimeout(() => {

                clearInterval(iv)

                if(Root.currentArtworks.hasArtworksLoading(camera)) {

                    reject(new Error("Please wait for artworks to load"))
                }
                else {

                    resolve()
                }

            }, timeout)

            const iv = !timeout ? null : setInterval(() => {

                if(!Root.currentArtworks.hasArtworksLoading(camera)) {

                    clearTimeout(tid)

                    clearInterval(iv)

                    resolve()
                }
            }, 500)
        })


    }

    takeBase64Screenshot = async (opts = {}) => {

        let { color } = opts || {};

        const camera = PortalCamera.create()

        camera.layers.disable( CAMERA_LAYERS.SITTING_ZONE )

        camera.setSpace(CURRENT_SPACE.space, {
            ...CURRENT_SPACE.roomParameters,
            ...opts
        }, null)

        camera.updateMatrixWorld()

        await this._waitForArtworksToLoad(camera, opts.timeout)

        // We hide placeholders and editor meshes
        if(Root.editor) {
            Root.editor.visible = false;
        }

        Scene.getObjectByName('avatarContainer').visible = false


        Root.currentArtworks.children.forEach((mesh) => {

            if (mesh instanceof SpacePlaceholder) {
                mesh.visible = false;
            }

            if (mesh instanceof GlobalSpaceArtwork) {
                mesh.visible = false;
            }

            if (mesh instanceof SitZoneSpaceArtwork) {
                mesh.visible = false;
            }

            if (mesh instanceof ModelSpaceArtwork) {
                mesh.raycastMesh.visible = false
            }
        })

        let background = color ? new Color(color) : CURRENT_SPACE.space.scene.background

        const screenshot = await PortalScreenshot.takeScreenshot({
            scene: Scene,
            camera: camera,
            is360: false,
            background,
            custom: opts?.custom,
            roomParameters: CURRENT_SPACE.roomParameters
        })

        // We make them visible again
        if(Root.editor) {
            Root.editor.visible = true;
        }

        Root.currentArtworks.children.forEach((mesh) => {
            if (mesh instanceof SpacePlaceholder) {
                mesh.visible = true;
            }

            if (mesh instanceof GlobalSpaceArtwork) {
                mesh.visible = true;
            }

            if (mesh instanceof SitZoneSpaceArtwork) {
                mesh.visible = true;
            }

            if (mesh instanceof ModelSpaceArtwork) {
                mesh.raycastMesh.visible = mesh.userData.isCollider === true ? Camera.isEditing : false
            }
        })

        Scene.getObjectByName('avatarContainer').visible = true


        return screenshot;
    }


    async takeBase64360Screenshot(opts = {}) {

        const camera = PortalCamera.create()

        camera.layers.disable( CAMERA_LAYERS.SITTING_ZONE )

        camera.setSpace(CURRENT_SPACE.space, CURRENT_SPACE.roomParameters, null)

        // camera.position.copy(Camera.current.position)

        // camera.quaternion.copy(Camera.current.quaternion)

        camera.updateMatrixWorld()

        await this._waitForArtworksToLoad(camera, opts.timeout)


        // We hide placeholders and editor meshes
        if(Root.editor) {
            Root.editor.visible = false;
        }


        Root.currentArtworks.children.forEach((mesh) => {
            if (mesh instanceof SpacePlaceholder) {
                mesh.visible = false;
            }

            if (mesh instanceof GlobalSpaceArtwork) {
                mesh.visible = false;
            }

            if (mesh instanceof SitZoneSpaceArtwork) {
                mesh.visible = false;
            }

            if (mesh instanceof ModelSpaceArtwork) {
                mesh.raycastMesh.visible = false
            }
        })


        // remove vrms 

        Scene.getObjectByName('avatarContainer').visible = false


        CURRENT_SPACE.space.scene.traverse((child)=>{

            if(child?.userData?.type == 'spawn' ) {

                child.lastVisibility = child.visible

                child.visible = false
            }
          
        })
            

        const screenshot = await PortalScreenshot.takeScreenshot({
            scene: Scene,
            camera: camera,
            is360: true,
            background: CURRENT_SPACE.space.scene.background,
            roomParameters: CURRENT_SPACE.roomParameters
        })


        // We make them visible again

        if(Root.editor) {
            Root.editor.visible = true;
        }

        Root.currentArtworks.children.forEach((mesh) => {
            if (mesh instanceof SpacePlaceholder) {
                mesh.visible = true;
            }

            if (mesh instanceof GlobalSpaceArtwork) {
                mesh.visible = true;
            }

            if (mesh instanceof SitZoneSpaceArtwork) {
                mesh.visible = true;
            }

            if (mesh instanceof ModelSpaceArtwork) {
                mesh.raycastMesh.visible = mesh.userData.isCollider === true ? Camera.isEditing : false
            }
        })

        Scene.getObjectByName('avatarContainer').visible = true


        CURRENT_SPACE.space.scene.traverse((child)=>{

            if(child?.userData?.type == 'spawn' ) {

                child.visible = child.lastVisibility
            }
        })
            

        return screenshot;
    }

    setCinematicPreviewSize(opts) {



        var ps = []

        ps.push(  SET_CINEMATIC_PREVIEW_SIZE( opts ) )

        ps.push(  Camera.setCinematicLayout( opts.mode ) )

        return Promise.all( ps )
    }

    summonPortal(opts) {

        return Root.summonPortal(opts);
    }

    getCinematicSpline() {
        return Cinematic.getSplineExport()
    }

    getRoomParameters() {
        return CURRENT_SPACE.roomParameters
    }

    openPortal(opts){

        return Root.openPortal(opts)
    }

    teleport(opts) {

        return Root.teleport(opts);
    }

    focusOn(opts) {

        if (opts.component.raycastMesh == null) return

        const is2D = (
            opts.component.isArtwork &&
            !opts.component.isPlaceholder &&
            opts.component.raycastMesh.geometry.type === "PlaneGeometry"
        ) || opts.component.isPortal


        return Camera.focusOn({ ...opts, target: opts.component.raycastMesh, frontDir: is2D })
    }

    getTeleportCoords(opts) {

        return Root.getTeleportCoords(opts)
    }

    getCurrentCoords(opts) {


        const { position: p, rotation: r } = Camera.getCurrentCoords()

        return {
            position: { x: p.x, y: p.y, z: p.z },
            rotation: { x: r.x, y: r.y, z: r.z }
        }
    }

    getPlayerData(opts) {

        return Root.getPlayerData(opts);
    }

    getSceneData(opts) {

        return Root.getSceneData(opts);
    }

    optimiseModel(opts) {

        return Root.optimiseModel(opts)
    }

    updatePlayer(opts) {

        return Root.updatePlayer(opts)
    }

    changeVRM( vrm, opts ){

        return Root.changeVRM( vrm, opts )
    }

    scaleVRM( val ){

        return Root.scaleVRM( val )
    }

    getVRMScale() {

        return Root.getVRMScale()
    }

    async setMultiplayer(opts) {

        if (opts.mode === "multiplayer") {

            await Root.setMultiplayer(opts);

            if (IS_VR_URL) {

                // await Camera.setFirstPerson();
            } else {

                // await Camera.setThirdPerson(true);
            }
        } else {

            // await Camera.setFirstPerson();

            Root.disposeMultiplayer(opts)

        }
    }

    createDummyPlayer(opts) {

        return Root.createDummyPlayer(opts)
    }

    openBackPortal() {

        return Root.openBackPortal()
    }

    // openPortal(opts){

    //     // Emitter.emit(Events.PORTAL_OPEN_REQUEST, opts)
    // }

    setViewOffset( val ){

        Camera.viewOffset = val
    }


    edit( type, opts ){

        return Root.edit(type, opts)
    }

    playEmote( opts ){

        return Root.playEmote( opts )
    }

    setShowPlaceholders(visible) {
        Root.setShowPlaceholders(visible);
    }

    /**
     *
     * @param { import("@gltypes").World3DOptions } opts
     * @returns { Promise<import('@gltypes').SpaceData> }
     */
    loadSpace(opts){

    	return SpaceFactory.get(opts)
    }

    startRoomTextureUpgrade() { Root.currentSpace?.scene.roomTextureUpgrade?.start(); }

    stopRoomTextureUpgrade() { Root.currentSpace?.scene.roomTextureUpgrade?.stop(); }

    loadMainPlayer(opts) {

        return Root.loadMainPlayer(opts);
    }

    /**
     * Whether this frame may be skipped when nothing changed (render on
     * demand, utils/renderDemand.js). Only a visitor's settled states; never
     * the editor, the uploader, XR, a recording, the stats panel, a cinematic
     * or an open dynamic portal.
     */
    canSkipFrame() {

        return !EDIT_MODE
            && !UPLOADER_MODE
            && !IS_VR
            && !Renderer.xr?.enabled
            && !IS_RECORDING
            && !STATS
            && !CINEMATIC
            && !Dynamicportal.active
            && SKIPPABLE_STATES.has(CURRENT_STATE)
    }

    /** @param { number } deltaTime - time in seconds since the last frame */
    update(deltaTime) {

        // The update work (controls, players, timers) ran already; only the
        // draw can be skipped. The gate decides, and when it would skip, it
        // looks at the camera and the scene once their matrices are current.
        let draw = this.renderGate ? this.renderGate.begin(this.canSkipFrame()) : true

        // In VR the renderer clears each eye's view itself: a manual clear
        // outside render() has no XR view to clear.
        const presenting = Renderer.xr?.isPresenting === true

        Renderer.autoClear = presenting

        if(draw && !presenting) {

            Renderer.clear()
        }

        // Render portals (an active one always draws: canSkipFrame)
        if(draw && Dynamicportal.active) {

            Dynamicportal.update(deltaTime)
        }

        let previousAutoUpdate = Scene.matrixWorldAutoUpdate

        const then = performance.now()

        if ( scene.matrixWorldAutoUpdate === true ) Scene.updateMatrixWorld();

        if (STATS) {

            RenderStats.matrixStats.nb++
            RenderStats.matrixStats.time = performance.now() - then
        }

        Scene.matrixWorldAutoUpdate = false

        if(!draw && this.renderGate.confirm(Scene, Camera.current)) {

            draw = true

            if(!presenting) Renderer.clear()
        }

        // HTML embeds are DOM: they follow the camera whether or not we draw.
        CSS3DRenderer.active = !CURRENT_SPACE?.roomParameters?.usePostProcessing?.enabled

        CSS3DRenderer.update()

        if(draw) {

            PostProcessing.render( Scene, Camera.current, CURRENT_SPACE?.roomParameters || {} )

            // render cinematic thumbnail if needed
            CinematicThumbRenderer.render(  Scene, Camera.current, CURRENT_SPACE?.roomParameters || {} )
        }

        Scene.matrixWorldAutoUpdate = previousAutoUpdate

        RenderList.setCamera( Camera.current )

        this.renderGate?.end()
    }


    async getUploaderQualities(){

        const { default: Optimiser } = await import('./modules/optimiser')
        return Optimiser.get()
    }

    projectPoint(point) {
        return projectPoint(point, Camera.current)
    }


    postupdate(){

        // console.log(Renderer.info)
    }

    getStats(){

        return RenderStats.export()
    }

    dawnupdate(){

        Renderer.info.reset()
    }

    duskupdate(delta){

        if( STATS ){

            RenderStats.update()
        }

        const n = performance.now()

        const t = 1 / ( (n -  this.perfnow) / 1000 )

        this.perfnow = n

        // Only the gap between two drawn frames is a frame time; a skipped
        // frame (render on demand) is not a fast one.
        if( RenderDemand.frame.drawn && RenderDemand.frame.previousDrawn ) {

            FPSCalc.addFrame( t )
        }

        this.time += delta;

        if (this.time >= 20) {

            this.time = 0;

            Emitter.emit(Events.CUSTOM, {

                type: Events.SEND_FPS,
            })
        }

        // Renderer.info.reset()
    }

    getPerformance(){

        return { performance:  FPSCalc.get(), render: this.getStats() }
    }

    toggleMapControls(opts) {

        if (opts.target instanceof SpaceComponent) {

            const is2D = (
                opts.target.isArtwork &&
                !opts.target.isPlaceholder &&
                opts.target.raycastMesh.geometry.type === "PlaneGeometry"
            ) || opts.target.isPortal

            opts.target = opts.target.raycastMesh

            opts.frontDir = is2D
        }

        

        return Camera.toggleMapControls(opts)
    }

    addEvents() {

    	this.postUpdateEvent = this.postupdate.bind(this)

    	Emitter.on(Events.POST_UPDATE, this.postUpdateEvent)

        this.updateEvent = this.update.bind(this)

        Emitter.on(Events.UPDATE, this.updateEvent)


        this.dawnUpdateEvent = this.dawnupdate.bind(this)

        Emitter.on(Events.DAWN_UPDATE, this.dawnUpdateEvent)

        this.duskUpdateEvent = this.duskupdate.bind(this)

        Emitter.on(Events.DUSK_UPDATE, this.duskUpdateEvent)

        this.resizeEvent = this.resize.bind(this)

        Emitter.on(Events.RESIZE, this.resizeEvent)

        // the loop resuming after a pause draws at once
        this.playEvent = () => this.renderGate?.invalidate()

        Emitter.on(Events.PLAY, this.playEvent)
    }

    resize(w, h){

        // Every quality change resizes the canvas: MSAA follows it here.
        syncAntialias()

        Renderer.setSize( w , h )

        // a resized canvas is blank until drawn
        this.renderGate?.invalidate()
	}

    dispose() {
        Root.dispose()
    }

}



var position = new Vector3( 1, 1, 1 );
var scale = new Vector3( 2, 1, 0.5 );
var quaternion = new Quaternion();
quaternion.setFromAxisAngle( new Vector3( 0, 1, 0 ), Math.PI / 8 );




function createLocallyOffsetChild() {

		var child = new Object3D();
		child.position.copy( position );
		child.scale.copy( scale );
		child.quaternion.copy( quaternion );

		return child;

	};

function generate ( depth, breadthArr, parent ) {

    if (depth < 1) return;

    // breadthArr is an array of the number of children each node should have
    // e.g. [ 2, 3, 4 ] means the top level node should have 2 children,
    const breadth = breadthArr[ breadthArr.length - depth ];

    for ( let i = 0; i < breadth; i++ ) {    

        var child = createLocallyOffsetChild();

        parent.add( child );
    }

    for ( let i = 0; i < parent.children.length; i++ ) {

        generate( depth - 1, breadthArr, parent.children[ i ] );

    }

    return parent;

}
