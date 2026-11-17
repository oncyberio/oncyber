// @ts-check

import States from "./states.js"

import Emitter from "@3emitter"

import Events from "@3events"

import { waitForNextSceneUpdate } from "./utils/nextSceneUpdate"

import { getGPU, isVRSupported } from '@3gl/utils/platform.js'

import { canPresentXR } from './xr/xrBackend'


import EditorApi from './editor.js'

import GLTF from '@3gltf'

import {

	SET_CANVAS,

	SET_GPU_TIER,

	DEBUG,

	SET_EDIT_MODE,

    SET_UPLOADER_MODE,

    SET_USER_INTERACTED,

    SET_VR_SUPPORTED,

    IS_VR_SUPPORTED,

    CANVAS,

    LOADED_STATE,

    APP_STATES,

    SET_IS_MULTIPLAYER,

    CURRENT_USER,

    SET_CURRENT_USER,

    DEFAULT_PLAYER_AVATAR_PICTURE,

    SET_DEFAULT_AVATAR_PICTURE,

    WEB_CODECS,

    // SET_CURRENT_AVATAR_MODE,

    PIPE_LINE_STATE,

    SET_QUALITY,

    QUALITY,

    QUALITIES,

    IS_VR,

    SET_DEFAULT_VRM,

    SET_WORLD_CREATED,

    DEFAULT_VRM,
    CURRENT_SPACE,

    IS_MOBILE

} from "@3constants"

import Mediator from '@3mediator'


import Manifest from './manifest.json'

import Textures from '@3textures'

const DEBUG_API = true

import FPSCalc from '@3utils/fps'

import {

    createResolutionGovernor,

    createSharpenGate,

    defaultQuality,

} from './utils/frameBudget'

import { getResolutionScale, setResolutionScale } from './utils/resizer'

import { RenderDemand } from './utils/renderDemand'

import Confetti from './external/confetti'

export default class Api extends EditorApi {

    constructor(opts) {

        super()

        this.customEventCallback = {}

        Emitter.on(Events.OCCLUSION, ( val )=>{

            PIPE_LINE_STATE.OCCLUSION = val
        })

        Emitter.on(Events.MIRROR, ( val )=>{

            PIPE_LINE_STATE.MIRROR = val
        })

        Emitter.on(Events.STENCIL, ( val )=>{

            PIPE_LINE_STATE.STENCIL = val
        })

        if(CANVAS == null) {

            let canvas = document.createElement("canvas")

            canvas.style.width = "100%"

            canvas.style.height = "100%"

            canvas.style.outline = "none";

            canvas.style.position = "absolute"

            SET_CANVAS( canvas )

            this.canvas = canvas
        }

        if( DEBUG || process.env.NODE_ENV === "development" ) {

            // @ts-ignore
            window.api = this
        }

        Emitter.on( Events.CUSTOM, this.onCustomEvent.bind(this) )

        // Milliseconds between rendered frames, for the decisions in
        // utils/frameBudget.js (room sharpening, resolution governor).
        this._frameConsumers = new Set()

        this._lastFrameAt = 0

        Emitter.on( Events.DUSK_UPDATE, () => {

            const now = performance.now()

            // A frame render on demand skipped is not a frame: the next
            // drawn one starts a new measurement instead of reporting the
            // idle gap (utils/renderDemand.js).
            if( !RenderDemand.frame.drawn ) {

                this._lastFrameAt = 0

                return
            }

            const frameMs = this._lastFrameAt ? now - this._lastFrameAt : 0

            this._lastFrameAt = now

            if( frameMs > 0 ) this._frameConsumers.forEach( ( consume ) => consume( frameMs ) )
        })

    }



    getExternalConfetti( opts = {} ){

        let defaultOpts = {x: 0.5, y: 0.5, zIndex: '100000',

            colors: [

              '#A964FD',
              '#2ACDFF',
              '#78FF43',
              '#FF708D',
              '#FDFF6A',
            ]
        }

        var options = {...opts, ...defaultOpts}
        // you can add colors to opts
        //     // colors : [
        //     //     "#ff0000",
        //     //     "#00ff00",
        //     //     "#0000ff"
        //     // ]
        // })

        let confetti = new Confetti(options)

        confetti.play(options).then(()=>{

            confetti.destroy()

            confetti = null
        })


        // styling you want

        confetti.canvas.style.position ='absolute'
        confetti.canvas.style.zIndex = options.zIndex
        confetti.canvas.style.top ='0'
        confetti.canvas.style.left ='0'

        console.log( options )

        return confetti


    }

    getPerformance(){

        return States.getPerformance()
    }

    resetPerformance(){

        FPSCalc.reset()
    }

    supportWebRecorder(){

        return WEB_CODECS
    }

    setQuality( opts ){

        // An empty value (settings saved without a quality) changes nothing.
        if( !opts?.quality ) return

        // The visitor chose: the governor stops and gives back its share.
        this.qualityChosen = true

        this.stopResolutionGovernor()

        SET_QUALITY( opts.quality )

        Mediator.resize()
    }

    /**
     * After arrival, lowers the resolution in steps while frames stay slow
     * (createResolutionGovernor), never below LOW's size. Does nothing when
     * the visitor chose a quality; setQuality and exit stop it.
     */
    startResolutionGovernor() {

        if( this.qualityChosen || this._governorConsumer ) return false

        const governor = createResolutionGovernor({ quality: QUALITY })

        this._governorConsumer = ( frameMs ) => {

            if( IS_VR ) return

            const scale = governor.observe( frameMs )

            if( scale == null ) return

            setResolutionScale( scale )

            Mediator.resize()
        }

        this._frameConsumers.add( this._governorConsumer )

        return true
    }

    stopResolutionGovernor() {

        if( this._governorConsumer ) this._frameConsumers.delete( this._governorConsumer )

        this._governorConsumer = null

        if( getResolutionScale() !== 1 ) {

            setResolutionScale( 1 )

            Mediator.resize()
        }
    }

    /** The governor's share of the resolution (1 = the quality's own size). */
    getResolutionScale() {

        return getResolutionScale()
    }

    /**
     *
     * @param { { enabled: boolean, noTransition?: boolean } } opts
     * @returns { Promise<unknown> }
     */
    setThirdPerson(opts) {

        return States.setThirdPerson(opts);
    }

    setFlyMode(opts) {

        return States.setFlyMode(opts);
    }

    setStabilization(opts) {

        return States.setStabilization(opts);
    }

    setFlyModeSpeed(opts) {

        return States.setFlyModeSpeed(opts);

    }

    enableAdjustCamera(opts) {

        return States.enableAdjustCamera(opts);

    }

    stopPlayer() {

        return States.stopPlayer();
    }

    setMultiplayer(opts) {

        SET_IS_MULTIPLAYER( opts.mode === "multiplayer" )

        return States.setMultiplayer(opts);
    }

    createDummyPlayer(opts) {

        return States.createDummyPlayer(opts);
    }

    changeVRM( vrm, opts = {} ){

        if( opts.demo == true ) {

            // debugger
        }

        return States.changeVRM( vrm, opts )
    }

    scaleVRM( val ) {

        return States.scaleVRM( val )
    }

    getVRMScale() {

        return States.getVRMScale()
    }

    getCurrentControls(opts) {

        return States.getCurrentControls(opts)
    }

    /**
     *
     *
     * @typedef { object } ApiOpts
     * @property { boolean } editMode
     * @property { boolean } uploaderMode
     * @property { "solo" | "multiplayer" } mode
     * @property { import("@uitypes/experience.js").Experience } exhibit
     * @property { import("@uitypes/user.js").User } userData
     * @param { ApiOpts } opts
     */
    async setOptions(opts){

		if(DEBUG_API){

		    console.log('%c require webgl' , 'background: #222; color: #bada55');
		}

	    SET_EDIT_MODE( !!opts.editMode )

        SET_UPLOADER_MODE( !!opts.uploaderMode  )

        SET_DEFAULT_AVATAR_PICTURE( opts.exhibit )

        SET_DEFAULT_VRM(opts?.userData?.VRM);

        // SET_CURRENT_AVATAR_MODE( opts.userData?.settings?.avatar || AVATAR_MODES.VRM );

        // A quality saved in the visitor's settings is theirs: the default
        // and the resolution governor never override it.
        const chosenQuality = opts.userData?.settings?.quality

        this.qualityChosen = !!chosenQuality

        if( chosenQuality ) SET_QUALITY( chosenQuality )

        // The VR check and the GPU tier run together; Scene3D usually started
        // the tier already, for the room download.
        const [ , tier ] = await Promise.all([

            IS_VR_SUPPORTED == null ? isVRSupported().then(async ( val )=>{

                // A WebGPU backend can present only with the WebXR/WebGPU
                // binding; without it the VR button would fail (xrBackend.js).
                const { default: Renderer } = await import("@3renderer")

                SET_VR_SUPPORTED(!!val && canPresentXR({

                    isWebGPUBackend: /** @type { any } */ (Renderer.backend)?.isWebGPUBackend === true,

                    hasGPUBinding: typeof globalThis.XRGPUBinding !== "undefined",
                }))

                if(DEBUG) {

                    console.log('%c VR support ' + val, 'background: #222; color: #bada55');
                }
            }) : null,

            this.resolveGpuTier()
        ])

        if(DEBUG) {

            console.log('%c gpu tier ' + tier.path , 'background: #222; color: #bada55');
        }

        if( !chosenQuality ) {

            const quality = defaultQuality({ isMobile: IS_MOBILE, gpuTier: tier.path })

            if( quality !== QUALITY ) {

                SET_QUALITY( quality )

                // The canvas may already be sized for the previous quality.
                if( Mediator.lastW > 0 ) Mediator.resize()
            }
        }

        return {
            VRM: DEFAULT_VRM,
        }
    }

    /**
     * Looks the GPU tier up (remembered, or detect-gpu once per page) and
     * sets GPU_TIER. Safe to call early and more than once: the room model
     * tier depends on it, so Scene3D starts it before the avatar work.
     * @returns { Promise<{ path: "low" | "mid" | "high", tier?: number, type?: string, isMobile?: boolean }> }
     */
    resolveGpuTier() {

        if( this._gpuTierReady == null ) {

            this._gpuTierReady = getGPU().then(( tier )=>{

                SET_GPU_TIER({ path: tier.path })

                return tier

            }, ( error )=>{

                this._gpuTierReady = null

                throw error
            })
        }

        return this._gpuTierReady
    }

    /** Imports the avatar bake code now, so the avatar does not wait for it
     * after parsing (GLTF.prepareBaking). */
    prepareAvatarBaking() {

        return GLTF.prepareBaking()
    }

    /** The render quality in force ("high" | "medium" | "low"). */
    getQuality() {

        return QUALITY
    }

    /**
     *
     * @param { import("@3constants").UserOpts } user
     */
    setCurrentUser(user) {

        console.log("setCurrentUser", user)

        SET_CURRENT_USER(user)

        Emitter.emit(Events.CURRENT_USER_CHANGED, {
            user
        })

    }

    // record( opts ){


    // }

    loadState( state ){

        return new Promise( ( resolve )=>{

            if( DEBUG_API ) {

                console.log('%c load state ' + state, 'background: #222; color: #bada55');
            }


            var ps =[]

            if( LOADED_STATE[state] == null ){

                const data = Manifest[state]

                if( state == APP_STATES.CINEMATIC ){

                    // const heroImg = CURRENT_SPACE?.exhibit?.info?.cHeroImg || CURRENT_SPACE?.exhibit?.info?.heroImg

                    // data.assets.push({
                    //     name:'heroImg',
                    //     url: heroImg ?? CURRENT_SPACE.roomParameters.image
                    // })
                }

                if ( state == APP_STATES.INTRO) {

                    const avatarUrl = CURRENT_USER?.userData?.avatar

                    const avatarImg = {
                        name: 'avatarImg',
                        url: avatarUrl || DEFAULT_PLAYER_AVATAR_PICTURE,
                    }

                    const ext = Textures.get_url_extension(avatarImg.url).toLowerCase()

                    let isJPGPNG = ext == 'jpg' || ext == 'png'  || ext == 'jpeg'

                    if(!isJPGPNG) {
                        avatarImg.url = DEFAULT_PLAYER_AVATAR_PICTURE
                    }

                    data.assets.push(avatarImg)
                }

                if( data?.assets ) {

                    ps.push( Textures.loadTextures( data.assets ) )

                    ps.push( GLTF.load( data.assets ) )

                }
            }

            Promise.all(ps).then(()=>{

                resolve()
            })
        })
    }

    setCinematicPreviewSize( opts ){

        // console.trace()

        return States.setCinematicPreviewSize(opts)
    }

    setJump(opts) {
        return States.setJump(opts);
    }

    removeCinematicPreviewSize (opts) {

        // console.trace()

        return States.setCinematicPreviewSize({
            left: 0,
            w: 0,
            h: 0,
            bottom: 0,
            ...opts
        });
    }


    teleport(opts) {

        return States.teleport(opts);
    }

    focusOn(opts) {

        return States.focusOn(opts);
    }


    summonPortal(opts) {
        return States.summonPortal(opts);
    }


    getTeleportCoords(opts) {

        return States.getTeleportCoords(opts)
    }

    getCurrentCoords(opts) {

        return States.getCurrentCoords(opts)
    }

    handleCommand(opts) {

        return States.handleCommand(opts);
    }

    getStats(){

        return States.getStats()
    }

    getCinematicSpline() {
        return States.getCinematicSpline()
    }

    getRoomParameters() {
        return States.getRoomParameters()
    }

    summonLinkPortal(opts) {
        return States.summonLinkPortal(opts)
    }

    setUserInteracted() {

        SET_USER_INTERACTED(true)
    }

    setViewOffset( val ){

        return States.setViewOffset( val )
    }

    setShowUsername(val) {

        return States.setShowUsername( val );

    }

    setEventListener( type, callback ){

      this.customEventCallback[type] = {

        type: type,

        callback : callback

      }
    }


    updateVideoStream(opts) {
        return States.updateVideoStream(opts)
    }


    toggleAvatarMode( val ) {

        return States.toggleAvatarMode( val )
    }

    playEmote( opts ){

        return States.playEmote( opts )
    }

    takeScreenshot(opts) {

        return States.takeScreenshot(opts);
    }

    takeBase64360Screenshot(opts) {
        return States.takeBase64360Screenshot(opts);
    }

    takeBase64Screenshot(opts) {
        return States.takeBase64Screenshot(opts);
    }

    getPlayerData(opts) {

        return States.getPlayerData(opts);
    }

    getSceneData(opts) {

        return States.getSceneData(opts);
    }

    async optimiseModel(opts) {

        return States.optimiseModel(opts)
    }

    updatePlayer(opts) {

        return States.updatePlayer(opts);
    }

    openPortal(opts){

        return States.openPortal(opts)
    }

    getUploaderQualities(){

        return States.getUploaderQualities()
    }

    projectPoint(point) {
        return States.projectPoint(point)
    }

    /**
     * @param { import("@gltypes").World3DOptions } opts
     * @returns { Promise<import("@gltypes").SpaceData> }
     */
    loadSpace(opts){

    	return States.loadSpace(opts)
    }

    startRoomTextureUpgrade() {

        const upgrade = CURRENT_SPACE?.space?.scene?.roomTextureUpgrade

        // A sharpening that has not been allowed yet waits for the frame rate.
        if( upgrade?.sharpening && !upgrade.allowed ) {

            this.sharpenRoomWhenSmooth()

            return
        }

        States.startRoomTextureUpgrade();
    }

    stopRoomTextureUpgrade() {

        this.cancelRoomSharpening()

        States.stopRoomTextureUpgrade();
    }

    /**
     * A direct visit that arrived at the room's mid file sharpens it to the
     * high file once the frame rate over the first seconds in the world is
     * good (createSharpenGate). Returns false when this room has nothing to
     * sharpen. Departure, exit and stopRoomTextureUpgrade cancel the wait.
     */
    sharpenRoomWhenSmooth() {

        const upgrade = CURRENT_SPACE?.space?.scene?.roomTextureUpgrade

        if( !upgrade?.sharpening ) return false

        this.cancelRoomSharpening()

        const gate = createSharpenGate()

        const consume = ( frameMs ) => {

            const verdict = gate.observe( frameMs )

            if( verdict === "wait" ) return

            this.cancelRoomSharpening()

            this.roomSharpening = verdict

            // The same room must still be on screen.
            if( verdict === "good" && CURRENT_SPACE?.space?.scene?.roomTextureUpgrade === upgrade ) {

                upgrade.allow()

                upgrade.start()
            }
        }

        this._sharpenConsumer = consume

        this._frameConsumers.add( consume )

        // The verdict needs real frames: the world keeps drawing until it
        // comes (a few seconds after arrival), as it did before render on
        // demand. cancelRoomSharpening ends it.
        RenderDemand.setContinuous( "sharpen-gate", true )

        this.roomSharpening = "waiting"

        return true
    }

    cancelRoomSharpening() {

        if( this._sharpenConsumer ) this._frameConsumers.delete( this._sharpenConsumer )

        this._sharpenConsumer = null

        RenderDemand.setContinuous( "sharpen-gate", false )
    }

    loadMainPlayer(opts) {

        console.log('opts', opts)

        return States.loadMainPlayer(opts);
    }

    openBackPortal() {

        return States.openBackPortal()
    }

    uploaderSetRoomParameters(opts) {

        return States.uploaderSetRoomParameters(opts);
    }

    setShowPlaceholders(visible) {
        return States.setShowPlaceholders(visible);
    }

    onCustomEvent(e) {

        if(this.customEventCallback[e.type] && this.customEventCallback[e.type].callback ){

            if(DEBUG_API){

                // console.groupCollapsed('%c CUSTOM EVENT: ' + e.type , 'background: #444; color: #bada55');

                // console.log( e.value)

                // console.groupEnd()

                // console.trace()

            }

            this.customEventCallback[e.type].callback(e.value)
        }

    }

    getArtworks(opts) {

        return States.getArtworks(opts);
    }

    getPortals(opts) {

        return States.getPortals(opts);
    }

    getKitbashElements(opts) {

        return States.getKitbashElements(opts);
    }

    getPlaceholders(opts) {

        return States.getPlaceholders(opts);
    }

    /**
     *
     * @param {string} artworkId
     *
     * @returns { import("@3constants").PERF_SCORE }
     */
    getPerfScore(artworkId) {

        return States.getPerfScore(artworkId)
    }

    /**
     *
     * @param { string } id
     * @returns { import("./factory/abstract/spaceitem.js").SpaceItem }
     */
    getItem(id) {
        //
        return States.getItem(id)
    }

    /**
     *
     * @param { string } id
     * @returns { import("./factory/space/kits/abstract.js").Component3D }
     */
    getComponentById(id) {
        //
        return CURRENT_SPACE.space.kitbash?.getComponentById(id)
    }

    async setState(STATE, opts){

        if(DEBUG_API) {

            console.log('%c setState ' + STATE , 'background: #222; color: #bada55');

            console.log(opts)
        }

        if( STATE === APP_STATES.EXIT ) {

            this.cancelRoomSharpening()

            this.stopResolutionGovernor()
        }

    	return States.setState(STATE, opts)
    }

    preload(opts) {

    	if(DEBUG_API){

    	    console.log('%c preload' , 'background: #222; color: #bada55');
    	}

        var ps = []

        // ps.push( Textures.loadTextures( Manifest['PRELOAD'] ) )

        ps.push( Textures.loadFonts( Manifest['FONTS'] ) )

        // ps.push( States.preload(opts) )


        return Promise.all(ps)
    }

    async start() {

    	if(DEBUG_API){

    	    console.log('%c start' , 'background: #222; color: #bada55');
    	}


        // await Loader.initRenderer()

        return States.start()
    }

    play(enterVR = false){
    	if(DEBUG_API){

    	    console.log('%c play' , 'background: #222; color: #bada55');
    	}

        // States.play()

    	return States.play(enterVR)

    }

    pause(exitVR = false){

        return States.pause(exitVR)
    }

    update(){

        return Mediator.update(true, 0)
    }

    /** @param {AbortSignal} [signal] */
    async nextUpdate(signal) {
        return waitForNextSceneUpdate(Emitter, Events.POST_UPDATE, signal)
    }

    resize(opts = {w: 1024, h: 1024, quality: "high"}){

        if(DEBUG_API){

            if( opts.w == undefined ){

                // console.trace()
            }


            // console.trace()

            console.log('%c resize : ' + opts.w + ' ' + opts.h , 'background: #222; color: #bada55');


        }

        Mediator.resize(opts)
    }

    mobileMove( ev ) {


        Mediator.keydown( ev )
    }

    dispose() {

        States.dispose()

        Mediator.pause()
    }

    static _worldPromise = null

    static getInstance(opts) {

        if(Api._worldPromise == null) {

            Api._worldPromise = Api._initWorld(opts)
        }

        return Api._worldPromise
    }

    static async _initWorld(opts) {

        const world =  new Api(opts)

        // webpackPreload: this chunk downloads alongside the one holding this
        // file (DisplayScene's); it still runs only here, in the same order.
        const { rendererReady } = await import(/* webpackPreload: true */ "@3renderer")

        await rendererReady

        await world.preload()

        await world.start()

        SET_WORLD_CREATED(world)

        return world
    }
}

