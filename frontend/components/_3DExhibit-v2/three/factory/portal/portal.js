// @ts-check

import { 
    Vector3, 
    Material, 
    Matrix4, 
    Euler, 
    AnimationMixer, 
    LoopOnce, 
    Quaternion, 
    Raycaster as ThreeRaycaster
} from 'three'

import Renderer from '@3renderer'

import Camera from '@3camera'

import { CURRENT_SPACE, CURRENT_USER, EDITION_TRANSFORM_CONTROL, EDIT_MODE, IS_FIRST_PERSON, UPLOADER_MODE } from "@3constants"

import Raycaster from '@3raycaster'

import { SpaceItem } from '@3factory/abstract/spaceitem'

import { STATES, } from './constants.js'

import {

    IS_DESKTOP,
    IS_MOBILE,
    IS_VR

} from '@3constants'

import Emitter from '@3emitter'

import Events from '@3events'

import SpaceFactory from '@3factory/space'

import ArtworkFactory from '@3factory/artwork'

import PortalFactory from '@3factory/portal'

import DynamicRendering from '@3gl/renderer/dynamicportal'

import PortalScreenshotRenderer from "@3gl/renderer/portalscreenshot";

import { disposeMaterial, lookAtDistance } from '@3utils/three'

import { getBalance } from '@dapp/explorer'

import { getUserByWalletId } from '@utils/saveToDb'

import { getPortalExhibit, getPortalOwnerAccount } from '@utils/csr'

import SpriteBuilder from '@3factory/sprite'

import { PortalCamera } from '@3gl/camera/portal'

import Scene from '@3scene'

import { checkGating } from '@dapp/checkGating'

import { PortalLOD } from './portalLOD'

import { LABEL_STATES } from '../../modules/label/constants.js'

import { overrideInitialCoords } from "@3utils/spaceutils";
import { CHECK_ABORT_SIGNAL } from "../../utils/abort";



const tempQuat = new Quaternion()

const tmpEuler = new Euler(0, 0, 0, 'YXZ')

const tmpDir = new Vector3()

const tmpMat = new Matrix4()

export class Portal extends SpaceItem {

    /** @param { import('@gltypes').PortalPreviewOptions } opts */
    constructor(opts) {

        super(opts)

        this.placeholderData = opts.placeholderData

        this.isPortal = true

        // Scale conversion [UI pixels] <-> [webgl units]
        this.uiScaleFactor = 50

        this.isPortalPlaceholder = opts.spawn == null

        this.isStaticPortal = opts.isStaticPortal

        this.isElevator = opts.levels && opts.levels.length > 0

        this.currentLevel = opts.currentLevel || opts.placeholderData.portalId;

        /** @type { import('@gltypes').PortalSpawnOptions["spawn"] } */
        this.spawn = opts.spawn

        this._maxLookatDistance = null

        /** @type { import('@gltypes').PortalData } */
        this._portalData = null

        this.isTeleporting = false

        this.opts = opts

        this.metadataAbort = new AbortController()
        this.abortMetadata = () => this.metadataAbort.abort()
        if(opts.abort?.aborted) this.abortMetadata()
        else opts.abort?.addEventListener("abort", this.abortMetadata, { once: true })

        /** @type { AnimationMixer } */
        this.mixer = null

        this.mainCamWPosition = new Vector3()

        this.previewMeshPosition = new Vector3()

        this.mainRoomParameters = opts.roomParameters

        this.portalData = opts.portalData

        this.previewMesh = opts.placeholderData.meshes.previewMesh

        this.previewMesh.portal = this

        this.originalPreviewMesh = opts.placeholderData.meshes.originalPreviewMesh

        /** @type { Material } */
        this.staticPreviewMaterial = null

        /** @type { import('@gltypes').SpaceData } */
        this.space = null

        /** @type { PortalCamera } */
        this.camera = null

        this.previousState = null

        this.currentState  = null

        this.switching = false

        this.isLookedAt    = false

        this.isUserRaycasted = false

        const playerRadius = this.mainRoomParameters.capsuleRadius || 2;

        const factor = IS_MOBILE ? 1.4 : 2

        this.teleportDistance = playerRadius * factor

        this.add(this.previewMesh)

        this.raycasted = false

        const placeholderData = opts.placeholderData

        if(placeholderData.animations?.open?.length > 0 &&
            placeholderData.animations?.close?.length > 0 &&
            placeholderData.meshes.portalDoor != null
        ) {

            this.isStaticPortal = false

            this.animating = false

            this.mixer = new AnimationMixer(placeholderData.meshes.portalDoor)

            this.openDoorAction = this.mixer.clipAction(placeholderData.animations.open[0])

            this.openDoorAction.setLoop(LoopOnce, 1)

            this.closeDoorAction = this.mixer.clipAction(placeholderData.animations.close[0])

            this.closeDoorAction.setLoop(LoopOnce, 1)

            this.loadingSprite = null
        }

        if (!this.spawn) {

            this.prefTransformControls = null

            this.onSelect(e => {

                this.showSelected(e.isSelected)                
            })
        }
        else {

            this.prefTransformControls = EDITION_TRANSFORM_CONTROL.TRANSFORM_3D
        }
    }

    /**
     * @return { import('@gltypes').PortalData }
     */
    get portalData() {

        return this._portalData
    }

    /**
     * @param { import('@gltypes').PortalData } val
     */
    set portalData(val) {

        this._portalData =  val

        if(val?.roomParameters) {

            this._portalData.roomParameters = overrideInitialCoords(val.roomParameters, this.opts.coords)
        }
    }

    async initState(useLOD = true) {

        await this.setState(STATES.EMPTY)

        if(this.opts.exhibitId != null) {

            this.addEvents()

            this.lod = await PortalLOD.create({

                portal: this,

                enable: useLOD && this.isStaticPortal

            })

            this.lod.reset()
        }
    }

    maxLookatDistance() {

        if(this._maxLookatDistance == null) {

            this._maxLookatDistance = lookAtDistance(this.previewMesh, Camera.mainCamera) * 1.5
        }

        return this._maxLookatDistance
    }

    loadPortalData = async () => {

        const signal = this.metadataAbort.signal
        const data = await PortalFactory.loadPortalData(this.opts.exhibitId, this.portalData, signal)
        CHECK_ABORT_SIGNAL(signal)
        this.portalData = data

        if(this.portalData?.exhibit == null || this.portalData?.roomParameters == null) {

            console.error("Failed to get portal data for exhibit ", this.opts.exhibitId)

            return false
        }

        return true
    }


    switchLevel = async ({ exhibitId, cHeroImg360, cHeroImg, portalId, coords }) => {

        if (this?.placeholderData?.portalId === portalId) return;

        if (portalId === this.currentLevel) {

            // @ts-ignore
            await this.parent.openCurrentPortal()

            return;
        }

        if (exhibitId === this.opts.exhibitId && portalId === this.currentLevel) return;

        if (this.switching) return;

        this.switching = true

        try {

            await this.previewMesh.setState(STATES.LOADING)

            this.opts.exhibitId = exhibitId;

            this.opts.coords = coords;

            this.opts.cHeroImg360 = cHeroImg360;

            await this.previewMesh.disposeMaterials()

            await this.lod.dispose()

            this.lod = await PortalLOD.create({

                portal: this,

                enable: false

            })

            await this.lod.reset()

            await this.previewMesh.setState(STATES.CLOSE)

            this.currentLevel = portalId;

            await this.parent.label.setState(
                LABEL_STATES.ATTACHED,
                {
                    roomParameters: this.roomParameters,
                    parent: this,
                    mesh: this.previewMesh,
                    isElevator: this.isElevator,
                    levels: this.opts.levels,
                    currentLevel: this.opts.placeholderData.portalId,
                    currentActive: this.currentLevel
                })

            await this.parent.openCurrentPortal()
        }
        finally {

            // released when a step throws too, or the lift never moves again
            this.switching = false
        }
    }

    canTeleport(ignoreLookedAt = false) {

        const isTarget = IS_VR ? this.isUserRaycasted : (this.isLookedAt || ignoreLookedAt)

        return this.currentState === STATES.OPEN  && isTarget && this.ownsSpace && this.gatingError == null
    }

    /**
     *
     * @param { Vector3 } pos
     * @param { boolean } ignoreY
     * @returns
     */
    getDistanceToCameraSq(pos, ignoreY) {

        this.mainCamWPosition.copy(pos)

        // force update only in edit mode or for backportals
        this.previewMeshPosition.copy(this.previewMesh.worldPosition(this.opts.backState != null))

        if(ignoreY) {

            this.mainCamWPosition.setY(0)

            this.previewMeshPosition.setY(0)
        }

        return this.previewMeshPosition.distanceToSquared(this.mainCamWPosition)
    }


    _raycatser = new ThreeRaycaster()
    /**
     *
     * @param { Vector3 } pos
     * @returns
     */
    getPlaneDistance(pos) {

        // compute raycast distance
        this._raycatser.set(
            pos, 
            // direction is based on plane normal of preview mesh
            this.previewMesh.getWorldDirection(tmpDir).negate()
        )

        const intersects = this._raycatser.intersectObject(this.previewMesh, false)

        if(intersects.length > 0) {

            return intersects[0].distance
        }

        return Infinity
    }

    /** @param { number } deltaTime */
    preUpdate(deltaTime){


        if(this.mixer != null && this.animating) {

            this.mixer.update(deltaTime)
        }

        else if( !EDIT_MODE && !Camera.isEditing && this.canTeleport() && !this.isTeleporting) {

            const distance = this.getPlaneDistance(Camera.currentControls?.world?.firstPersonPos || Camera.current.position)

            if( distance <= this.teleportDistance && !UPLOADER_MODE) {

                if(IS_FIRST_PERSON) {

                    this.requestTeleport(this.getTeleportRequestOpts())
                }
                else {

                    setTimeout(async () => {

                        this.isTeleporting = true

                        console.log("3RD PERSON TELEPORT")

                        await Camera.setFirstPerson(true)

                        this.requestTeleport({
                            ...this.getTeleportRequestOpts(),
                            enableThirdPerson: true
                        })
                    })
                }

            }
        }
    }


    getTeleportRequestOpts() {

        /** @type { import('@gltypes').TeleportState } */
        let backState;

        let from;

        // If we've got a back state, then this is a back portal
        if(this.opts.backState == null) {

            // const quaternion = new Quaternion()

            this.previewMesh.getWorldQuaternion(tempQuat)

            const backRotation = new Euler(0, 0, 0, "YXZ").setFromQuaternion(tempQuat)

            backState = {
                backPosition: new Vector3(),
                backDirection: new Vector3(),
                backRotation: {
                    _y: backRotation.y + Math.PI
                }
            }

            from = {
                exhibit: this.opts.exhibit,
                roomParameters: this.opts.roomParameters
            }

            this.previewMesh.getWorldPosition(backState.backPosition);

            // fast pointer to world position.y
            backState.backPosition.y = Camera.current.matrixWorld.elements[13]

            this.previewMesh.getWorldDirection(backState.backDirection);

            tmpDir.copy(backState.backDirection)

            tmpDir.setLength( this.teleportDistance )

            backState.backPosition.add(tmpDir)
        }

        return {
            roomParameters: this.portalData.roomParameters,
            exhibit: this.portalData.exhibit,
            space: this.space,
            backState,
            from
        }
    }

    willTeleport() {

        this.isTeleporting = false

        if(this.portalData.exhibit.id !== CURRENT_SPACE.exhibit.id) {

            DynamicRendering.stop()

            this.removeEvents()
        }
    }

    requestTeleport(opts) {

        if(opts == null) {

            opts = this.getTeleportRequestOpts()
        }

        Promise.resolve().then(() => {

            this.willTeleport()

            this.emit(Events.PORTAL_TELEPORT_REQUEST, {

                portal: this,

                opts
            })
        })
    }


    setPreviewMesh(mesh) {

        const oldPreviewMesh = this.previewMesh

        this.previewMesh = mesh

        this.previewMesh.setMaterial(oldPreviewMesh.material)

        oldPreviewMesh.material = null

        this.previewMesh.visible = oldPreviewMesh.visible

        this.setRaycastMesh(this.previewMesh)

        this.remove(oldPreviewMesh)

        oldPreviewMesh.dispose()

        this.add(mesh)
    }


    async setState( STATE, opts ){


        switch (STATE) {

            case STATES.EMPTY:


                await this.previewMesh.setState(STATES.EMPTY)

                if (this.originalPreviewMesh) {

                    this.previewMesh.visible = false

                    this.originalPreviewMesh.visible =
                        CURRENT_SPACE.roomParameters.slug !== "6529hub" &&
                        // @ts-ignore
                        this.originalPreviewMesh?.material?.name !== "transparent"
                }


                if(this.currentState === STATES.OPEN) {

                    DynamicRendering.stop()
                }

                this.disposePortalResources()

                break

            case STATES.CLOSE:

                if (this.originalPreviewMesh) {

                    this.originalPreviewMesh.visible = false
                }

                this.previewMesh.visible = true

                if(this.isStaticPortal && this.portalData?.exhibit && this.portalData?.roomParameters) {

                    await this.previewMesh.setState(STATES.CLOSE, { portal: this, ...opts })
                }

                if(this.currentState === STATES.OPEN) {

                    if(this.mixer != null) {

                        await this.closeDoor()
                    }

                    this.disposeSpace()

                    DynamicRendering.stop()
                }

                break

            case STATES.OPEN:

                this.previousState = this.currentState

                this.currentState = STATES.OPENING

                if(this.mixer == null) {

                    await this.previewMesh.setState(STATES.OPENING)
                }
                else {

                    this.showLoadingSprite()
                }


                console.log("loading portal data")

                const sceneData = await this.loadSceneData()

                console.log("loading portal data -> Success", sceneData)




                // Concurrency check
                if(sceneData == null || this.currentState !== STATES.OPENING) {

                    console.log("Portal state changed, abort openning")

                    return
                }

                if(this.mixer == null) {

                    await this.previewMesh.setState(STATES.OPEN, {})

                    if(this.currentState !== STATES.OPENING) return

                    DynamicRendering.play(sceneData, {
                        dissolve: this.previewMesh.dissolve,
                        scene: Scene,
                        teleportDistance: this.teleportDistance
                    })
                }
                else {


                    DynamicRendering.play(sceneData, {
                        dissolve: this.previewMesh.dissolve,
                        scene: Scene,
                        teleportDistance: this.teleportDistance
                    })

                    this.hideLoadingSprite()

                    await new Promise((resolve) => setTimeout(resolve, 500))

                    // Concurrency check
                    if(this.currentState !== STATES.OPENING) return

                    await this.openDoor()

                    this.hideLoadingSprite()

                }

                break
        }

        this.previousState = this.currentState

        this.currentState  = STATE

    }

    async openDoor() {

        return new Promise(resolve => {

            if (this.mixer != null) {

                this.mixer.stopAllAction();

                this.openDoorAction.clampWhenFinished = true;

                this.openDoorAction.loop = LoopOnce;


                // console.log("Play open door")

                this.openDoorAction.play();

                this.animating = true;

                const handleOpenAnimation = (e) => {

                    this.animating = false;

                    this.mixer.removeEventListener(
                        "finished",
                        handleOpenAnimation
                    );

                    resolve()
                };

                this.mixer.addEventListener("finished", handleOpenAnimation);
            }
        })

    }

    /**
     * Puts a portal whose opening failed back to closed, so that it can be
     * opened again. Does nothing unless the portal is still opening.
     */
    async cancelOpening() {

        if(this.currentState !== STATES.OPENING) return

        // closed from here on, whatever the clean up below does

        this.previousState = this.currentState

        this.currentState = STATES.CLOSE

        this.hideLoadingSprite()

        // same clean up as closing an open portal: the failure may have come
        // after the destination was loaded and started playing

        this.disposeSpace()

        if(DynamicRendering.sceneData?.previewMesh === this.previewMesh) {

            DynamicRendering.stop()
        }

        if(this.previewMesh.currentState === STATES.OPENING || this.previewMesh.currentState === STATES.OPEN) {

            // back to the preview it had before opening
            await this.previewMesh.setState(STATES.CLOSE)
        }
    }

    async showLoadingSprite() {

        const loadingSprite = await SpriteBuilder.get( SpriteBuilder.TYPES.CYBER_LOADER, {scale: 0.2} )

        // the opening ended (opened, closed or failed) before the sprite was ready
        if(this.currentState !== STATES.OPENING) return

        this.loadingSprite = loadingSprite

        // sprite.visible = false

        this.loadingSprite.visible = true

        this.loadingSprite.quaternion.copy(
            this.previewMesh.quaternion
        )

        this.previewMesh.getWorldPosition(this.previewMeshPosition)

        this.loadingSprite.position.set(
            this.previewMeshPosition.x,
            this.previewMeshPosition.y,
            this.previewMeshPosition.z
        )

        this.loadingSprite.translateY(
            -this.previewMesh.geometry.boundingBox.max.y + 0.4
        )

        this.loadingSprite.translateX(
            this.previewMesh.geometry.boundingBox.max.x - 0.3
        )

        this.loadingSprite.translateZ(0.05)

        this.parent.add(this.loadingSprite)

        this.loadingSprite.play()
    }

    hideLoadingSprite() {

       if(this.loadingSprite != null) {

            this.parent.remove(this.loadingSprite)

            this.loadingSprite.pause()

            this.loadingSprite = null
       }
    }

    closeDoor = () => {

        if (this.mixer != null) {

            return new Promise((resolve) => {

                this.mixer.stopAllAction()

                this.closeDoorAction.clampWhenFinished = true

                this.closeDoorAction.loop = LoopOnce

                // console.log("Play close door")

                this.closeDoorAction.play()

                this.animating = true

                const handleFinishClosingAnimation = (e) => {

                    this.animating = false;
                    this.mixer.removeEventListener(
                        "finished",
                        handleFinishClosingAnimation
                    )

                    resolve()
                }

                this.mixer.addEventListener(
                    "finished",
                    handleFinishClosingAnimation
                )
            })
        }
    }

    /**
     *
     * @param { { active: boolean, type: string  } } e
     */
    raycastCallBack(e) {

        const isUserAction = e.type == Raycaster.TYPES.USER_RAYCAST

        if(!isUserAction) {

            this.isLookedAt = e.active
        }
        else {

            this.isUserRaycasted = e.active
        }



        if (IS_VR || IS_MOBILE || Camera.isEditing) {
            // quick hack to make it called after the raycastCallBack of label
            // if(isUserAction) {

                setTimeout(() => {
                    this.emit(Events.CURRENT_PORTAL_CHANGED, { currentPortal: this, active: e.active, type: e.type })
                })
            // }

        }
        else if(IS_DESKTOP && !EDIT_MODE) {

            if(!isUserAction) {

                console.log("loooking at portal");

                if(this.currentState !== STATES.LOADING) {

                    this.emit(Events.CURRENT_PORTAL_CHANGED, { currentPortal: this, active: e.active, type: e.type })
                }
            }
        }
    }


    async checkGatingError() {

        const gatingResult = await checkGating(this.portalData.exhibit, CURRENT_USER, this.portalData.password)

        return gatingResult.type === "success" ? null : gatingResult.type
    }


    async onUserChanged() {

        if(this.currentState !== STATES.OPEN) return

        const gatingError = await this.checkGatingError()

        if(gatingError != this.gatingError) {

            this.gatingError = gatingError

            this.emit(Events.CURRENT_USER_CHANGED, {})
        }
    }

    async checkBalances(exhibit, roomParameters) {

    //        
        if (!roomParameters.nonFungible) {
            return 1;
        }

        // First check main address balance
        let mainBalance = await getBalance(
            exhibit.owner.toLowerCase(),
            roomParameters.collection,
            roomParameters.contractName,
            roomParameters.token_id
        );
        
        // If main address has no balance, check linked accounts. The preview
        // only carries the owner's public profile, so read the account now.
        const linkedAccounts = mainBalance <= 0
            ? (this.portalData?.user?.linkedAccounts || (await getPortalOwnerAccount(exhibit.owner))?.linkedAccounts)
            : null
        if (mainBalance <= 0 && linkedAccounts?.length > 0) {
            for (const linkedAccount of linkedAccounts) {
                if (linkedAccount.type === "web3" && linkedAccount.originalWalletId) {
                    const linkedBalance = await getBalance(
                        linkedAccount.originalWalletId.toLowerCase(),
                        roomParameters.collection,
                        roomParameters.contractName,
                        roomParameters.token_id
                    );
                    if (linkedBalance > 0) {
                        mainBalance = linkedBalance;
                        break;
                    }
                }
            }
        }
        return mainBalance;
    }

    async loadSceneData() {
        if(this.currentState !== STATES.OPENING) return

        let { exhibit, roomParameters, user } = this.portalData

        let isCurrentSpace = exhibit.id === CURRENT_SPACE.exhibit.id

        // The preview carries doc fields only; opening needs the artworks,
        // portals and kitbash of the world behind the portal.
        if(!isCurrentSpace) {

            const full = await getPortalExhibit(exhibit.id)

            if(this.currentState !== STATES.OPENING) return

            if(full != null) {

                // Loaded here so the portal module stays free of the app's
                // exhibit formatting until a portal actually opens.
                const { formatExhibit } = await import('@utils/metadata/formatExhibit')

                if(this.currentState !== STATES.OPENING) return

                exhibit = formatExhibit(full)

                this.portalData.exhibit = exhibit
            }
        }

        let cib, space, ownsSpace, gatingError;

        const abortController = new AbortController()

        try {
            // Ugly hack, but seems in Oculus Browser when we parse
            // a GLTF the ImageBitmapLoader fails/succeeds randomly.
            // For now, when we're in immersive mode, we just disable
            // The bitmap loader and fallback to regular img texture loader
            if (Renderer.xr.enabled) {
                cib = window.createImageBitmap
                window.createImageBitmap = undefined
            }

            if(isCurrentSpace) {
                space = CURRENT_SPACE.space
                ownsSpace = true
            }
            else {
                console.log("Loading portal space ...")

                space = await SpaceFactory.get({
                    exhibit,
                    roomParameters,
                    initTextures: true
                })

                console.log("Loading portal space --> Success")

                if(this.currentState !== STATES.OPENING) return

                console.log("Checking portal owner ...")

                let [balance, _gatingError] = await Promise.all([
                    this.checkBalances(exhibit, roomParameters),
                    this.checkGatingError()
                ])

                ownsSpace = process.env.NODE_ENV === "development" || balance > 0;
                gatingError = _gatingError
            }

            // Concurrency check
            if(this.currentState !== STATES.OPENING) return

        } finally {
            if(Renderer.xr.enabled) {
                window.createImageBitmap = cib
            }
        }

        const camera = Camera.portalCamera

        camera.setSpace( space, roomParameters, this.opts.backState )

        camera.updateWorldMatrix(true, false)

        if(!isCurrentSpace) {

            await camera.initControls()

            const factoryOpts = {
                exhibit: this.portalData.exhibit,
                roomParameters: this.portalData.roomParameters,
                space,
                player: null,
                abort: abortController.signal
            }



            space.artworkContainer = ArtworkFactory.loadPreviewAssets(factoryOpts, camera)

            space.scene.add(space.artworkContainer)

            space.portalContainer = PortalFactory.loadPreviewPortals(factoryOpts, camera)

            space.scene.add(space.portalContainer)
        }


        // Concurrency check
        if(this.currentState !== STATES.OPENING) {

            // this will propagate the abort signal to artwork and portal containera
            abortController.abort()

            return
        }

        this.space = space

        this.camera = camera

        this.ownsSpace = ownsSpace

        this.gatingError = gatingError

        this.abortController = abortController

        if(process.env.NODE_ENV === "development") {

            // this.ownsSpace = true
        }

        console.log("All set for portal to play")

        return  {
            space: this.space,
            camera,
            previewMesh: this.previewMesh,
            roomParameters : roomParameters
        }
    }

    /**
     *
     * @param { import('@gltypes').PortalData } portalData
     */
    async loadScreenshotData(portalData) {

        const { exhibit, roomParameters } = portalData

        console.log("loadScreenshotData/ loading space ...")

        let space = await SpaceFactory.get({
            exhibit,
            roomParameters,
            initTextures: true
        })

        console.log("loadScreenshotData/ loading space -> SUCCESS")

        const camera = PortalCamera.create()

        camera.setSpace(space, roomParameters, null)

        camera.updateMatrixWorld()

        console.log("loadScreenshotData/ loading preview assets ...")

        await new Promise(resolve => {

            const container = ArtworkFactory.loadPreviewAssets({
                exhibit: portalData.exhibit,
                roomParameters: portalData.roomParameters,
                space,
                player: null,
            }, camera, () => {

                setTimeout(resolve, 1000)
            })

            space.scene.add(container)
        })

        console.log("loadScreenshotData/ loading preview assets -> SUCCESS")

        return {
            space,
            camera
        }
    }


    removePortalData() {
        if (this.portalData != null) {

            this.portalData = null

            this.opts.exhibitId = null

            this.opts.portalData = null

            this.opts.cHeroImg360 = null

            this.removeEvents()

            return this.setState(STATES.EMPTY)
        }
    }

    /**
     *
     * @param { import('@gltypes').PortalData } portalData
     */
    async setPortalData(portalData, opts, force = false) {

        if(!force && this.portalData?.exhibit.id ===  portalData?.exhibit.id) {
            return;
        }

        if(this.portalData != null) {

            await this.removePortalData();
        }

        if(portalData != null) {

            this.portalData = portalData

            this.opts.cHeroImg360 = opts.heroImg360

            this.opts.exhibitId = opts.exhibitId

            await this.initState()
        }
    }

    /**
     *
     * @param { import('@gltypes').PortalData } portalData
     * @param { boolean } is360
     * @returns
     */
    async takeScreenshot(portalData, is360 = false, force = false) {

        const data = await this.loadScreenshotData(portalData)

        try {

            const info = portalData.exhibit.info

            let [heroImg, heroImg360] = await Promise.all([
                (!force && info?.cHeroImg) ? null : PortalScreenshotRenderer.takeScreenshot({
                    scene: data.space.scene,
                    background: data.space.background,
                    camera: data.camera
                }),
                (!force && info?.cHeroImg360 ) ? null : PortalScreenshotRenderer.takeScreenshot({
                    scene: data.space.scene,
                    background: data.space.background,
                    camera: data.camera,
                    is360: true
                })
            ])

            return {
                heroImg,
                heroImg360
            }
        }
        finally {

            data.camera.dispose()

            data.space.scene.dispose()

            data.space.background?.dispose?.()
        }
    }

    addEvents(){

        if( this.preUpdateEvent == null ){

            this.preUpdateEvent = this.preUpdate.bind(this)

            Emitter.on(Events.PRE_UPDATE, this.preUpdateEvent)
        }

        if(this.onUserChangedEvent == null) {

            this.onUserChangedEvent = this.onUserChanged.bind(this)

            Emitter.on(Events.CURRENT_USER_CHANGED, this.onUserChangedEvent)
        }
    }

    // addCollisionEvent() {
    //     if( this.collisionEvent == null ){

    //         this.collisionEvent = this.onCollision.bind(this)

    //         Camera.currentControls.on(Events.COLLISION, this.collisionEvent)
    //     }
    // }

    removeEvents(){

        if( this.preUpdateEvent ) {

            Emitter.off(Events.PRE_UPDATE, this.preUpdateEvent)

            this.preUpdateEvent = null
        }

        if( this.onUserChangedEvent ) {

            Emitter.off(Events.CURRENT_USER_CHANGED, this.onUserChangedEvent)

            this.onUserChangedEvent = null
        }

        // if( this.collisionEvent ){

        //     Camera.currentControls.off(Events.COLLISION, this.collisionEvent)

        //     this.collisionEvent = null
        // }
    }

    // removeCollisionEvent() {

    //     if( this.collisionEvent ){

    //         Camera.currentControls.off(Events.COLLISION, this.collisionEvent)

    //         this.collisionEvent = null
    //     }
    // }

    disposePortalResources(isTeleporting = false) {

        if(this.mixer != null) {

            this.mixer.stopAllAction()
        }

        this.hideLoadingSprite()

        if(this.infoMaterialOpen) {

            disposeMaterial(this.infoMaterialOpen)

            this.infoMaterialOpen = null
        }

        if(!isTeleporting) {

            this.disposeSpace()
        }
    }

    disposeSpace() {

        if(this.space != null && this.space !== CURRENT_SPACE.space) {

            this.space.scene.dispose()

            this.space.background?.dispose?.()

            this.abortController?.abort()

            this.space = null

            this.ownsSpace = false
        }

        if(this.camera != null) {

            this.camera.dispose()

            this.camera = null
        }
    }

    /**
     *
     * @param { boolean } isTeleporting
     */
    dispose(isTeleporting) {

        this.metadataAbort.abort()
        this.opts.abort?.removeEventListener("abort", this.abortMetadata)

        super.disposeResources()

        this.removeEvents()

        this.lod?.dispose()

        this.disposePortalResources(isTeleporting)

        this.previewMesh?.dispose()
    }
}
