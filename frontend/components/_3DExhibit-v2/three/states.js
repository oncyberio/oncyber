// @ts-check



import {

	CURRENT_STATE,

	SET_CURRENT_STATE,

	APP_STATES,
    CURRENT_SPACE,
    EDIT_MODE,
    SET_CURRENT_MODE
} from "@3constants"

import Emitter from "@3emitter"

import Events from "@3events"


class States {

    start() {

        return new Promise((resolve, reject) => {

            this.init().then(()=>{

                this.world3D.start().then(() => {

                    this.preload().then(()=>{

                        resolve()

                    })
                })
            })
        })
    }

    async init() {

        // webpackPreload: the world chunk downloads alongside DisplayScene's
        // instead of after the renderer has started; it still runs only
        // here, after the renderer (see docs/benchmarks/hub-startup-2026-10-12.md
        // on the singletons' initialisation order).
        let [w3, mediator] = await Promise.all([
            import(/* webpackPreload: true */ "./world3D.js"),
            import(/* webpackPreload: true */ "./events/mediator.js")
        ])

        /** @type { import("./world3D").default  } */
        // @ts-ignore
        this.world3D = new w3.default()

        this.mediator = mediator.default
    }

    preload( opts ) {

        return this.world3D.preload()
    }

    /**
     * @param { import("@gltypes").World3DOptions } opts
     * @returns { Promise<import('@gltypes').SpaceData> }
     */
    loadSpace(opts){

        return this.world3D.loadSpace(opts)
    }

    startRoomTextureUpgrade() { this.world3D.startRoomTextureUpgrade(); }

    stopRoomTextureUpgrade() { this.world3D.stopRoomTextureUpgrade(); }

    loadMainPlayer(opts) {

        return this.world3D.loadMainPlayer(opts);
    }

    openBackPortal() {
        return this.world3D.openBackPortal()
    }

    summonPortal(opts) {

        return this.world3D.summonPortal(opts);
    }

    openPortal(opts){

        return this.world3D.openPortal(opts)
    }

    takeScreenshot(opts) {

        return this.world3D.takeScreenshot(opts);
    }

    takeBase64360Screenshot(opts) {

        return this.world3D.takeBase64360Screenshot(opts)
    }

    takeBase64Screenshot(opts) {

        return this.world3D.takeBase64Screenshot(opts);
    }

    edit( type, opts ){

        if(CURRENT_STATE === APP_STATES.SPACE || CURRENT_STATE === APP_STATES.IDLE) {

            return this.world3D.edit(type, opts)
        }
    }

    updateVideoStream(opts) {
        return this.world3D.updateVideoStream(opts)
    }

    toggleAvatarMode( val ) {

        return this.world3D.toggleAvatarMode( val )
    }

     /**
     *
     * @param { { enabled: boolean, noTransition?: boolean } } opts
     * @returns { Promise<unknown> }
     */
    setThirdPerson(opts) {

        return this.world3D.setThirdPerson(opts);
    }

    setFlyMode(opts) {

        return this.world3D.setFlyMode(opts);
    }

    setStabilization(opts) {

        return this.world3D.setStabilization(opts);
    }

    setFlyModeSpeed(opts) {

        return this.world3D.setFlyModeSpeed(opts);

    }

    teleport(opts) {

        return this.world3D.teleport(opts);
    }

    focusOn(opts) {

        return this.world3D.focusOn(opts);
    }

    getTeleportCoords(opts) {

        return this.world3D.getTeleportCoords(opts)
    }

    getCurrentCoords(opts) {

        return this.world3D.getCurrentCoords(opts)
    }

    setCinematicPreviewSize(opts) {
        return this.world3D.setCinematicPreviewSize(opts)
    }

    setJump(opts) {
        return this.world3D.setJump(opts);
    }


    handleCommand(opts) {

        return this.world3D.handleCommand(opts)
    }

    getPlayerData(opts) {

        return this.world3D.getPlayerData(opts);
    }

    getSceneData(opts) {

        return this.world3D.getSceneData(opts);
    }

    updatePlayer(opts) {

        return this.world3D.updatePlayer(opts);
    }

    dispose() {
        return this.world3D.dispose();
    }

    setMultiplayer(opts) {

        return this.world3D.setMultiplayer(opts);
    }

    summonLinkPortal(opts) {
        return this.world3D.summonLinkPortal(opts)
    }

    playEmote( opts ){

        return this.world3D.playEmote( opts )
    }

    createDummyPlayer(opts) {

        return this.world3D.createDummyPlayer(opts)
    }

    async optimiseModel(opts) {
        return this.world3D.optimiseModel(opts);
    }

    uploaderSetRoomParameters(opts) {
        return this.world3D.uploaderSetRoomParameters(opts);
    }

    getCurrentControls(opts) {

        return this.world3D.getCurrentControls(opts)
    }

    setShowPlaceholders(visible) {
        return this.world3D.setShowPlaceholders(visible);
    }

    getUploaderQualities(){

        return this.world3D.getUploaderQualities()
    }

    getCinematicSpline() {
        return this.world3D.getCinematicSpline()
    }

    setShowUsername(val) {
        return this.world3D.setShowUsername(val);
    }

    getRoomParameters() {
        return this.world3D.getRoomParameters()
    }

    enableAdjustCamera(opts) {

        return this.world3D.enableAdjustCamera(opts);
    }

    changeVRM( vrm, opts  ){

        return this.world3D.changeVRM( vrm, opts  )
    }

    scaleVRM( val  ){

        return this.world3D.scaleVRM( val  )
    }

    getVRMScale() {

        return this.world3D.getVRMScale()
    }

    async setState(STATE, opts) {

        if (STATE == null) {

            console.log("Cannot transition to no state")

            return
        }

        if(
            STATE === CURRENT_STATE &&
            (CURRENT_STATE === APP_STATES.INTRO)
        ) {

            console.log("Already in state", STATE)
            return
        }

        if(STATE === APP_STATES.IDLE) {

            if(CURRENT_STATE !== APP_STATES.SPACE) {

                throw new Error("transition to IDLE needs to be from SPACE state")
            }
        }

        if(STATE === APP_STATES.SPACE) {

            // if(CURRENT_STATE === APP_STATES.TRANSITION) {

            //     SET_CURRENT_STATE(STATE)

            //     return
            // }

            if(CURRENT_STATE !== APP_STATES.SPACE && opts?.isVR) {

                throw new Error("You need to be in the SPACE state in order to enter VR mode")
            }
        }


        if (this.world3D && this.world3D.setState) {

            // console.log("Transitioning to state", STATE, "from", CURRENT_STATE)

            if(STATE === APP_STATES.SPACE && CURRENT_STATE === APP_STATES.TELEPORT) {}
            else {
                await this.world3D.setState(STATE, opts)
            }

            SET_CURRENT_STATE(STATE)

            let mode = null

            if(STATE === APP_STATES.SPACE) {
                //
                mode = opts?.switch ??  (EDIT_MODE ? "edit" : "display")
            }
            else if(STATE === APP_STATES.CINEMATIC) {
                //
                mode = "cinematic"
            }

            SET_CURRENT_MODE(mode)

            Emitter.emit(
                Events.CUSTOM,
                {
                    type: Events.WORLD_STATE_CHANGED,

                    value: {
                        state: STATE,
                        hasSpace: CURRENT_SPACE != null,
                        mode
                    }
                }
            )
        }
    }

    async play(enterVR = false) {

        if (CURRENT_STATE === APP_STATES.IDLE) {

            await this.setState(APP_STATES.SPACE, {});
        }

        if (enterVR) {

            await this.mediator.pause()

            await this.world3D.enterVR();
        }

        this.mediator.play()
    }

    async pause(exitVR = false) {

        await this.mediator.pause()

        if(exitVR) {

            return this.world3D.exitVR()
        }
    }

    setViewOffset( val ){

        return this.world3D.setViewOffset( val )
    }

    projectPoint(point) {
        return this.world3D.projectPoint(point)
    }

    getStats(){

        return this.world3D.getStats()
    }

    stopPlayer() {

        return this.world3D.stopPlayer();
    }

    getArtworks(opts) {

        return this.world3D.getArtworks(opts);
    }

    getPortals(opts) {

        return this.world3D.getPortals(opts);
    }

    getKitbashElements(opts) {

        return this.world3D.getKitbashElements(opts);
    }

    getPlaceholders(opts) {

        return this.world3D.getPlaceholders(opts)
    }

    /**
     *
     * @param {string} artworkId
     *
     * @returns { import("@3constants").PERF_SCORE }
     */
    getPerfScore(artworkId) {

        return this.world3D.getPerfScore(artworkId)
    }

    getItem(id) {
        //
        return this.world3D.getItem(id)
    }

    getPerformance(){

        return this.world3D.getPerformance()
    }

    toggleMapControls(opts) {

        return this.world3D.toggleMapControls(opts)
    }
}

export default new States()
