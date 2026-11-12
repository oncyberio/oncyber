// @ts-check

import { passwordRefusalMessage } from "@components/_3DExhibit-v2/utils/gating";
import { Group, Mesh } from "three";

import gsap from 'gsap'

import {

    EDIT_MODE,

    IS_DESKTOP,

    IS_MOBILE,

    IS_VR,

    IS_VR_SUPPORTED,

    TRANSITION_ACTIONS,
    IS_FIRST_PERSON,

    CURRENT_SPACE,
    APP_STATES,

} from '@3constants'

import BackPortal from './spawnportal/backportal'

import Raycaster from '@3raycaster'

import Emitter from '@3emitter'

import Camera from "@3camera"

import Events from '@3events'

import { Portal } from "./portal"

import { checkGating } from "@dapp/checkGating";

import { hasWorldPassword } from "@utils/worldPassword/publicGating";

import label, { LABEL_STATES } from "@3modules/label"

import { LABEL_MESSAGES, NOT_OWNED, OPEN_FAILED_MESSAGE, STATES } from "./constants"

import { getGatingErrMessage } from "@components/_3DExhibit-v2/utils/gating";

import { delay } from "@utils/js";

import SummonPortal from "./spawnportal/summonportal";

import { showUIPrompt } from "@3utils/ui";

import { IS_ABORT_ERROR } from "@3utils/abort";


export class PortalContainer extends Group {

    /**
     *
     * @param { import("@gltypes").SpaceStateOptions } opts
     */
    constructor(opts) {

        super()

        this.opts = opts


        this.label = label.get()

        this.isDragging = false

        this.ongoingMouseEvent = null


        /** @type { Portal } */
        this.backPortal = null

        /** @type { Portal } */
        this.summonedPortal = null

        this.backPortalHiddenTime = 0

        /** @type { Portal[] } */
        this.portals = []

        /**@type { Mesh[] }  */
        this.raycastMeshes = []


         /** @type { Portal } */
        this.previousOpenPortal = null

        /** @type { Portal } */
        this.currentPortal = null

        /** @type { Portal } */
        this.teleportPortal = null

        this.roomParameters = opts.roomParameters

        this.opening = false

        /**
         * The portal whose last opening threw, until it is tried again
         * @type { Portal }
         */
        this.openFailedPortal = null
        // this.transformControls = new TransformControls(Camera.current, CANVAS);

        // this.add(this.transformControls)
    }

    setState(STATE, opts) {

        switch (STATE) {

            case APP_STATES.SPACE:

                if(opts?.switch === "edit") {
                    //
                    this.label.setState(LABEL_STATES.DETACHED)
                }
                else if(opts?.switch === "display") {
                    //
                    this.updateLabel()
                }

        }
    }

    updateMatrixWorld(force = false)  {

        this.label.updateMatrixWorld(force)

        this.currentPortal?.updateMatrixWorld(force)

        this.currentPortal?.loadingSprite?.updateMatrixWorld(force)
    }

    onCurrPortal(e) {

        if((IS_MOBILE)) {

            if (!this.label.currentIntersect) {
                // bug here doesnt take into account when portal state doesnt change and label is not clicked

                this.hoveredPortal = e.active ? e.currentPortal : null
            }
        }

        else {
            if(e.active) {

                this.currentPortal = e.currentPortal

                if(this.currentPortal.currentState === STATES.CLOSE || this.currentPortal.currentState === STATES.OPEN) {

                    Camera.currentControls.playFeedback?.()
                }

                this.updateLabel()
                // }
            } else {

                this.currentPortal = null

                this.updateLabel()

            }
        }
    }

    /** @param { Portal } portal */

    addPortal(portal) {

        this.portals.push(portal)

        this.raycastMeshes.push(portal.raycastMesh)

        this.add(portal)

        if(portal !== this.summonedPortal && portal !== this.backPortal ) {

            if(this.onCurrPortalEvent == null) {

                this.onCurrPortalEvent = this.onCurrPortal.bind(this)
            }

            portal.on(Events.CURRENT_PORTAL_CHANGED, this.onCurrPortalEvent )
        }

        if( this.onTeleportRequestEvent == null ) {

            this.onTeleportRequestEvent = this.onTeleportRequest.bind(this)
        }

        portal.on(Events.PORTAL_TELEPORT_REQUEST, this.onTeleportRequestEvent)


        if( this.onPortalUserChangedEvent == null ) {

            this.onPortalUserChangedEvent = () => {

                if(this.currentPortal === portal) {

                    this.updateLabel()
                }
            }
        }

        portal.on(Events.CURRENT_USER_CHANGED, this.onPortalUserChangedEvent)

        Emitter.emit(Events.PORTAL_ADDED, portal)
    }

    replaceRaycastMesh(oldMesh, newMesh) {

        const idx = this.raycastMeshes.indexOf(oldMesh)

        if(idx >= 0) {

            this.raycastMeshes[idx] = newMesh
        }
    }

    async onTeleportRequest (e) {



        if(e.opts.space === CURRENT_SPACE.space) {

            e.portal.isTeleporting = true

            Camera.goto(
                Camera.portalCamera.position,
                Camera.portalCamera.rotation
            )

            // await this.closePrevOpenningPortal()

            if(e.opts.enableThirdPerson) {

                await delay(30)

                await Camera.setThirdPerson()
            }

            setTimeout(() => {
                e.portal.isTeleporting = false
            }, 200)

            Emitter.emit(Events.CUSTOM, {
                type: Events.PORTAL_TELEPORT_REQUEST,
                value: {
                    sameSpace: true,
                    ...e.opts,
                    portal: e.portal
                }
            })
        }
        else {

            // console.log(Events.PORTAL_TELEPORT_REQUEST , e)
            this.teleportPortal = e.portal

            Emitter.emit(Events.CUSTOM, {
                type: Events.PORTAL_TELEPORT_REQUEST,
                value: e.opts
            })
        }
    }

    /** @param  { Portal } portal */
    removePortal(portal) {

        const idx = this.portals.indexOf(portal)

        if(idx >= 0) {

            this.portals.splice(idx, 1)

            this.raycastMeshes.splice(idx, 1)

            this.remove(portal)

            if(portal == this.backPortal) {

                BackPortal.active = false
            } else {

                portal.dispose(false)
            }

            if(this.onCurrPortalEvent) {

                portal.off(Events.CURRENT_PORTAL_CHANGED, this.onCurrPortalEvent)
            }

            if(this.onTeleportRequestEvent) {

                portal.off(Events.PORTAL_TELEPORT_REQUEST, this.onTeleportRequestEvent)
            }

            if(this.onPortalUserChangedEvent) {

                portal.off(Events.CURRENT_USER_CHANGED, this.onPortalUserChangedEvent)
            }

            Emitter.emit(Events.PORTAL_REMOVED, portal)
        }
    }

    async closePrevOpenningPortal() {

        const portal = this.previousOpenPortal

        if(portal == null) return

        try {

            await portal.setState(STATES.CLOSE)
        }
        finally {

            // also when closing threw: a portal that stayed "previous" would
            // be closed again, and fail again, before every later opening

            if(portal === this.backPortal) {

                this.removePortal(portal)

                this.backPortal = null
            }
            else if(portal === this.summonedPortal) {

                this.removePortal(portal)

                this.summonedPortal = null
            }

            if(this.previousOpenPortal === portal) {

                this.previousOpenPortal = null
            }
        }
    }

    async checkPortalPassword(portal) {

        if (!portal) return;

        let password;

        const exhibit = portal.portalData?.exhibit;

        const passwordGating = exhibit?.gating?.password

        if (hasWorldPassword(exhibit?.gating)) {

            // const ssKey = "cyber-portal-pwd-" + portal.portalData.exhibit.id

            // password = sessionStorage.getItem(ssKey)

            // if(password == null) {

                const message = passwordGating.message || "Enter password to access this world"

                this.updateLabel(null, message)

                password = await showUIPrompt({
                    type: "password",
                    message,
                    // The server checks the password; the exhibit does not
                    // carry it. Other rules are checked when the portal opens.
                    onSubmit: async (password) => {

                        const result = await checkGating(exhibit, null, password);

                        if (
                            result?.type === "password-error" ||
                            result?.type === "too-many-attempts-error"
                        ) {
                            const refusal = passwordRefusalMessage(result.type)

                            this.updateLabel(null, refusal)

                            throw new Error(refusal)
                        }
                    }
                })

                if(password == null) return false

                // sessionStorage.setItem(ssKey, password)
            // }

            portal.portalData.password = password
        }

        return true
    }

    openCurrentPortal = async () => {

        if (this.opening) return;

        this.opening = true;

        const currentPortal = this.currentPortal

        if(this.openFailedPortal === currentPortal) {

            // a new attempt
            this.openFailedPortal = null
        }

        try {

            const canOpen = await this.checkPortalPassword(currentPortal)

            if(!canOpen) return

            if(currentPortal && currentPortal.currentState === STATES.CLOSE) {

                if(this.previousOpenPortal) {

                    await this.closePrevOpenningPortal()
                }

                console.log("Opening portal", this.currentPortal)

                this.updateLabel(STATES.OPENING)

                this.previousOpenPortal = currentPortal

                await currentPortal.setState(STATES.OPEN)

                if(currentPortal === this.currentPortal && currentPortal.currentState === STATES.OPEN) {

                    console.log("Portal was opened", this.currentPortal)

                    // Emit opened portal
                    Emitter.emit(
                        Events.CUSTOM,
                        {
                            type: Events.PORTAL_OPENED,
                            value: this.currentPortal.opts
                        }
                    )

                    this.updateLabel()
                }
            }
        }
        catch(err) {

            await this.onOpenFailed(currentPortal, err)
        }
        finally {

            // released on every path: while it is set no portal of this
            // space can be opened
            this.opening = false;
        }
    }

    /**
     * Opening threw: the portal goes back to closed so the next press opens
     * it again, and its label says so until the visitor looks away or retries.
     *
     * @param { Portal } portal
     * @param { Error } err
     */
    async onOpenFailed(portal, err) {

        console.error("Failed to open portal", err)

        if(this.wasDisposed || portal == null) return

        try {

            // false when it did open and something after that threw
            const failed = portal.currentState !== STATES.OPEN

            if(failed) {

                this.openFailedPortal = portal

                if(this.previousOpenPortal === portal) {

                    // it never opened: nothing to close before the next opening
                    this.previousOpenPortal = null
                }

                await portal.cancelOpening()
            }

            // the space went away meanwhile: there is no one to tell
            if(this.wasDisposed || IS_ABORT_ERROR(err)) return

            // labels are not awaited, here as elsewhere: `opening` is
            // released without waiting for them

            if(failed && portal === this.currentPortal) {

                this.updateLabel(null, OPEN_FAILED_MESSAGE, null)
            }
            else {

                // the visitor is elsewhere: the portal reads "open" again
                // when they come back
                this.updateLabel()
            }
        }
        catch(resetErr) {

            console.error(resetErr)
        }
    }

    summonPortal = async (opts) => {

        if (this.summoning) return;

        this.summoning = true;

        try {

            if (this.previousOpenPortal) {

                // an open summoned portal is removed with it
                await this.closePrevOpenningPortal()
            }

            if (this.summonedPortal != null) {

                // still here, so it never opened (it failed, or its password
                // prompt was dismissed): it makes way for the new one

                if (this.currentPortal === this.summonedPortal) {

                    this.currentPortal = null

                    this.updateLabel()
                }

                this.removePortal(this.summonedPortal)

                this.summonedPortal = null
            }

            this.summonedPortal = await SummonPortal.summon({
                ...opts,
                exhibit: this.opts.exhibit,
                roomParameters: this.opts.roomParameters,
            });

            this.currentPortal = this.summonedPortal;

            this.addPortal(this.currentPortal);

            await this.openCurrentPortal()
        }
        finally {

            // released when summoning throws too, or nothing can be
            // summoned in this space again
            this.summoning = false;
        }
    }

    async openBackPortal() {

        if(this.opening) return

        if( this.backPortal == null ) {

            console.log("spawn back portal")

            this.backPortal = await BackPortal.get(this.opts)

            // No history
            if(this.backPortal == null) return

            this.currentPortal = this.backPortal

            this.addPortal(this.backPortal)

            await this.openCurrentPortal()

        } else {

            this.currentPortal = this.backPortal

            BackPortal.updateCoords(this.opts)

            if(this.openFailedPortal === this.backPortal) {

                // opening it failed: going back again tries again
                await this.openCurrentPortal()
            }
        }

        this.startBackPortalInterval()
    }


    startBackPortalInterval() {

        this.backPortalInterval?.kill()

        this.backPortalHiddenTime = 0

        const checkBackportalVisibility = () => {

            if(this.backPortal != null && this.previousOpenPortal === this.backPortal) {

                // console.log("checking bp visiblity")

                if(!this.backPortal.isVisibleToCamera) {

                    this.backPortalHiddenTime += 1

                    // console.log("no incr hidden time", this.backPortalHiddenTime)
                }
                else {

                    this.backPortalHiddenTime = 0
                }
                if(this.backPortalHiddenTime >= 5) {

                    // console.log("time to go to sleep")

                    this.closePrevOpenningPortal()

                    if(this.backPortal === this.currentPortal) {

                        this.currentPortal = null

                        this.updateLabel()
                    }
                } else {

                    this.backPortalInterval = gsap.delayedCall(1, checkBackportalVisibility)
                }
            }
        }

        this.backPortalInterval = gsap.delayedCall(1, checkBackportalVisibility)
    }

    /**
     * @param { string } [forceState] show the label of this state instead of the portal's
     * @param { string } [errMsg] show this message instead of the state's
     * @param { string } [errIcon] icon beside errMsg; null for none
     */
    async updateLabel(forceState = null, errMsg = null, errIcon = "/v2/icons/lock.svg") {


        if(Camera.isEditing || EDIT_MODE) {

            // TODO: maybe add edit specific label messages
        } else {

            if(this.currentPortal == null) {

                await this.label.setState(LABEL_STATES.DETACHED)

                return
            }

            const state = forceState != null ? forceState : this.currentPortal.currentState

            // console.log("UpdateLabel", state)


            if(state === STATES.OPENING) {

                await this.label.setState(LABEL_STATES.DETACHED)
            }
            else {

                // var messageState = state == STATES.CLOSE ? MESSAGE_STATES.OPEN :

                //     this.currentPortal.ownsSpace ? MESSAGE_STATES.ENTER : MESSAGE_STATES.NOT_OWNED

                // if (messageState != null) {


                //     await this.label.setState(
                //         LABEL_STATES.ATTACHED,
                //         {
                //             messageState : messageState,
                //             // labelState : ,
                //             roomParameters: this.roomParameters,
                //             data : this.currentPortal.portalData,
                //             parent: this,
                //             mesh: this.currentPortal.previewMesh
                //         })
                // }

                let msg;

                if(errMsg) {

                    msg = {
                        iconUrl: errIcon,
                        message: errMsg,
                        flipY: false
                    }
                }

                else if(state === STATES.OPEN) {

                    if(this.currentPortal.gatingError) {

                        msg = {
                            iconUrl: "/v2/icons/lock.svg",
                            message: getGatingErrMessage(this.currentPortal.gatingError, this.currentPortal.portalData.exhibit),
                            flipY: false
                        }
                    }
                    else if(!this.currentPortal.ownsSpace) {

                        msg = LABEL_MESSAGES[NOT_OWNED]
                    }
                    else {

                        msg = LABEL_MESSAGES[state]
                    }

                }
                else {

                    msg = LABEL_MESSAGES[state]
                }


                if (msg != null) {

                    await this.label.setState(
                        LABEL_STATES.ATTACHED,
                        {
                            ...msg,
                            roomParameters: this.roomParameters,
                            parent: this,
                            mesh: this.currentPortal.previewMesh,
                            isElevator: this.currentPortal.isElevator,
                            levels: this.currentPortal.opts.levels,
                            currentActive: this.currentPortal.currentLevel,
                            currentLevel: this.currentPortal.opts.placeholderData.portalId,
                        })
                }
            }
        }

    }


    async onVREnter() {

        if(this.previousOpenPortal) {

            await this.closePrevOpenningPortal()

            this.updateLabel()
        }
    }

    async onVRExit() {

        if(this.previousOpenPortal) {

            await this.closePrevOpenningPortal()

            this.updateLabel()
        }
    }

    onLabelClicked = (e) => {

        if (e?.value?.current?.level) {

            const portal = IS_MOBILE ? this.hoveredPortal : this.currentPortal;

            if (portal) {

                portal.switchLevel({
                    ...e.value.current.level,
                    portalId: e.value.current.level.id
                })
            }
        }
    }

    addEvents(){

        if( this.onKeyDownEvent == null ) {

            this.onKeyDownEvent  = this.onKeyDown.bind(this)

            Emitter.on( Events.KEY_DOWN, this.onKeyDownEvent )
        }



        if( this.onMouseDownEvent == null ) {

            this.onMouseDownEvent  = this.onMouseDown.bind(this)

            Emitter.on( Events.MOUSE_DOWN, this.onMouseDownEvent )
        }

        if( this.onMouseUpEvent == null ) {

            this.onMouseUpEvent  = this.onMouseUp.bind(this)

            Emitter.on( Events.MOUSE_UP, this.onMouseUpEvent )
        }

        if( this.onMouseMoveEvent == null ) {

            this.onMouseMoveEvent  = this.onMouseMove.bind(this)

            Emitter.on( Events.MOUSE_MOVE, this.onMouseMoveEvent )
        }

        if( this.onMouseClickEvent == null ) {

            this.onMouseClickEvent  = this.clickAction.bind(this)

            Emitter.on( Events.CLICK, this.onMouseClickEvent )
        }

        if(this.onVREnterEvent == null) {

            this.onVREnterEvent = this.onVREnter.bind(this)

            Emitter.on(Events.VR_SESSION_START, this.onVREnterEvent)
        }

        if(this.onVRExitEvent == null) {

            this.onVRExitEvent = this.onVRExit.bind(this)

            Emitter.on(Events.VR_SESSION_END, this.onVRExitEvent)
        }

        Emitter.on(Events.CURRENT_LABEL_CLICKED, this.onLabelClicked)
    }

    removeEvents(){

        if( this.onKeyDownEvent ) {

           Emitter.off( Events.KEY_DOWN, this.onKeyDownEvent )

           this.onKeyDownEvent = null
        }

        if( this.onKeyUpEvent ) {

            Emitter.off( Events.KEY_UP, this.onKeyUpEvent )

            this.onKeyUpEvent = null
         }

        if( this.onMouseDownEvent ) {

            Emitter.off( Events.MOUSE_DOWN, this.onMouseDownEvent )

            this.onMouseDownEvent = null
        }

        if( this.onMouseUpEvent ) {

            Emitter.off( Events.MOUSE_UP, this.onMouseUpEvent )

            this.onMouseUpEvent = null
        }

        if( this.onMouseMoveEvent ) {

            Emitter.off( Events.MOUSE_MOVE, this.onMouseMoveEvent )

            this.onMouseMoveEvent = null
        }

        if( this.onMouseClickEvent ) {

            Emitter.off(Events.CLICK, this.onMouseClickEvent)
        }

        if(this.onCurrPortalEvent) {

            this.portals.forEach(p => {

                p.off(Events.CURRENT_PORTAL_CHANGED, this.onCurrPortalEvent)
            })

            this.onCurrPortalEvent = null
        }

        if(this.onTeleportRequestEvent) {

            this.portals.forEach(p => {

                p.off(Events.PORTAL_TELEPORT_REQUEST, this.onTeleportRequestEvent)
            })

            this.onTeleportRequestEvent = null
        }

        if(this.onVREnterEvent) {

            Emitter.off(Events.VR_SESSION_START, this.onVREnterEvent)
        }

        if(this.onVRExitEvent) {

            Emitter.off(Events.VR_SESSION_END, this.onVRExitEvent)
        }

        Emitter.off(Events.CURRENT_LABEL_CLICKED, this.onLabelClicked)
    }

    /**
     *
     * @param { KeyboardEvent } e
     */
    onKeyDown(e){

        if(EDIT_MODE || Camera.isEditing) return;

        if(!e.repeat && (e.key === "E" || e.key === 'e')) {

            this.openCurrentPortal()
        }

        if(!e.repeat && (e.key === "F" || e.key === 'f')) {

            this.openBackPortal()
        }

        const num = Number(e.key);

        if (isNaN(num)) return;

        if (!this.currentPortal) return;

        if (!this.currentPortal.isElevator) return;

        if (num === 0) return;

        if (num - 1 > this?.currentPortal?.opts?.levels?.length - 1) return;

        const portal = this.currentPortal?.opts?.levels?.find?.(level => level.level === num);

        if (!portal) return;

        // if (this.currentPortal?.opts?.placeholderData?.portalId === portal?.id) return;

        this.currentPortal.switchLevel({
            ...portal,
            portalId: portal.id
        });
    }



    async onMouseDown(e) {

        this.ongoingMouseEvent = e

        if(IS_MOBILE) {

            this.currentPortal = this.hoveredPortal
        }
    }

    onMouseMove() {

        if(this.ongoingMouseEvent != null) {

            this.isDragging = true
        }

        if(IS_VR) {

            const raycastedItem = Raycaster.currentSpaceItem

            if(raycastedItem instanceof Portal) {

                this.currentPortal = raycastedItem
            }
            else {

                this.currentPortal = null
            }
        }

        // this thing isn't working probably because artworkContrainer is also settting
        // the cursor
        // if(EEDIT_MODE) {

        //     const cursor = this.currentPortal != null ? "pointer" : "grab"

        //     console.log(cursor, this.currentPortal)

        //     CANVAS.style.cursor = cursor
        // }
    }

    /**
     *
     * @param {*} e
     * @returns
     */
    async onMouseUp(e) {

        this.ongoingMouseEvent = null

        if(IS_VR) {

            this.isDragging = false

            if(Raycaster.currentSpaceItem == null) {

                this.openBackPortal()
            }
            else {

                if(this.currentPortal != null) {

                    if(this.currentPortal.currentState === STATES.CLOSE) {

                        this.openCurrentPortal()
                    }
                    else if(this.currentPortal.canTeleport()) {

                        this.currentPortal.requestTeleport()
                    }
                }
            }

            return
        }

        if(this.isDragging) {

            this.isDragging = false

            return
        }
    }

    async clickAction(e) {

        if(IS_MOBILE) {

            if (this.label?.currentIntersect) return;

            this.currentPortal = this.hoveredPortal

            if(this.currentPortal != null && this.currentPortal !== this.backPortal && this.currentPortal !== this.summonedPortal) {

                let wasThirdPerson = !IS_FIRST_PERSON


                const shouldTeleport = this.currentPortal.canTeleport(true)

                if(shouldTeleport) {

                    this.currentPortal.isTeleporting = true
                }


                if (wasThirdPerson) {

                    if(shouldTeleport) {

                        await Camera.setFirstPerson()
                    }
                    else {

                        this.openCurrentPortal()

                        return
                    }
                }


                const lookAtDistance = shouldTeleport
                    ? Math.sqrt(this.currentPortal.teleportDistance) / 2
                    : this.currentPortal.maxLookatDistance()

                Emitter.emit(Events.CUSTOM, {

                    type: Events.TRANSITION,

                    value: {

                        target: this.currentPortal.raycastMesh,

                        lookAtDistance,

                        action: TRANSITION_ACTIONS.PORTAL,

                        teleportRequest: shouldTeleport ? this.currentPortal.getTeleportRequestOpts() : null,

                        wasThirdPerson
                    }
                })
            }
        }
    }

    async transitionDone(opts) {

        if(opts.teleportRequest) {

            this.currentPortal.requestTeleport({
                ...opts.teleportRequest,
                enableThirdPerson: opts.wasThirdPerson
            })
        }
        else {

            this.openCurrentPortal()
        }
    }

    dispose(){

        this.wasDisposed = true

        this.removeEvents()

        this.backPortalInterval?.kill()

        for (let i = 0; i < this.portals.length; i++) {

            const portal = this.portals[i];

            const isTeleporting = portal === this.teleportPortal

            if(portal === this.backPortal || portal === this.summonedPortal) {

                BackPortal.dispose(isTeleporting)
            }
            else {

                portal.dispose(isTeleporting)
            }

            portal.parent?.remove(portal)
        }

        this.portals = null

    }
}
