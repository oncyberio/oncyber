// @ts-check

import { AnimationMixer, Euler, Group, Matrix4, Mesh, Vector3 } from "three";

import {
    APP_STATES,
    CINEMATIC,
    CURRENT_SPACE,
    CURRENT_STATE,
    DEBUG,
    EDIT_MODE,

    IS_DESKTOP,

    IS_FIRST_PERSON,
    LOD_VRM,
    PERF_SCORES,
    QUALITIES,

    QUALITY,
    SET_DEFAULT_VRM,
    SET_IS_FIRST_PERSON,
    SET_SHADOW_NEEDS_UPDATE,
    TRANSITION_ACTIONS,

    UPLOADER_MODE,

    UPLOADER_TYPES,

    USER_INTERACTED
} from "@3constants";

import { UPDATE_AVATAR } from "@3factory/player/constants";

import VRMS from "@3factory/player/vrms.json";

import GLTF from '@3gltf';
import { loadMainPlayerAvatars } from "./utils/loadMainPlayerAvatars";
import { clearWorldTransitionCache } from "@features/lobby/worldTransitionCache";

import gui from "@3gui";

import { syncQualityMeshes } from "./utils/qualityMeshes";

import Scene from '@3scene';

import Raycaster from "@3raycaster";

import Events from "@3events";

import Emitter from "@3emitter";

import Camera from '@3camera';

import { walkNear } from './camera/constants';

import PanoramaFactory from '@3factory/panoramaviewer';

import ArtworkFactory from "@3artwork/index";

import { ArtworkContainer } from "@3artwork/artworkcontainer";

import PortalFactory from "@3portal/index";

import { PortalContainer } from "@3factory/portal/portalcontainer";

import Starfield from '@3modules/starfield';
import { preloadLegacyTunnel, setLegacyTunnelState } from "./utils/legacyTunnel";
import { isLobbyDestinationPreparing } from "@utils/lobbyDestinationBridge";

import Multiplayer from '@3factory/multiplayer';

import Socket from "@3socket";

import Players from "./factory/player";

import Label, { LABEL_STATES, SpaceLabel } from '@3modules/label';

import { BACK_PORTAL_MESSAGE } from "@3factory/portal/constants";

import PortalHistory from '@3history';

import gsap from "gsap";

import renderer from "./renderer";

import renderlist from "./globals/renderlist";


import SpaceFactory from '@3factory/space/';

import HighlightArtworkFactory from '@3factory/highlightartwork';

import { Editor } from "./factory/editor/edit";

import { StreamContainer } from "./factory/stream/streamcontainer";
import { coordsToId } from "./utils/spaceutils";

import WaterFactory from '@3factory/water';

import ReflectorFactory from '@3factory/reflector';


import { disposeObject3D } from '@3utils/three';

import { Raycaster as ThreeRaycaster } from 'three';
import { SpaceArtwork } from "./factory/artwork/abstract";
import { ModelSpaceArtwork } from "./factory/artwork/meshes/model/modelspaceartwork";
import { Portal } from "./factory/portal/portal";
import { LinkPortal } from "./factory/portal/spawnportal/linkportal";
// Gallery custom scripts are retired. Published games use their isolated host.

import InstanceAvatar3D from './factory/player/instanceavatarvrm/index.js';


import FogFactory from '@3factory/fog';
import { ST } from "next/dist/shared/lib/utils";

class Root extends Group {

    constructor() {
        super();

        // this.currentPortal           = null

        /** @type { AnimationMixer[] } */

        // window.summonLinkPortal = this.summonLinkPortal;

        if(process.env.NODE_ENV == 'development') {

            window.$root = this;
        }
    }

    async preload(){

        await preloadLegacyTunnel(Starfield)
    }

    start(){

        this.mixers = [];

        /** @type { import('@gltypes').SpaceData } */
        this.currentSpace = null;

        /** @type { ArtworkContainer } */
        this.currentArtworks = null;

        /** @type { PortalContainer } */
        this.currentPortals = null;

        this.multiplayer = null

        this.mainPlayer = null

        this.linkPortal = null

        /** @type { SpaceLabel } */
        this.label = Label.get()

        this.billboardLabel = Label.get({ type: "billboard" })

        this.startAudioListener()

        this.addEvents();
    }

    startAudioListener() {

        USER_INTERACTED.then(() => {

            Camera.addAudioListener()
        })
    }

    setState(STATE, opts) {

        return new Promise( async (resolve, reject) => {
            try {

            // if(STATE == APP_STATES.TRANSITION){

            //     debugger
            // }


            // Raycaster.active = false

            setLegacyTunnelState( Starfield, STATE, opts )
                .then( (isDone) => {

                    // after the transition is done, set the user camera
                    if (isDone) {
                        Emitter.emit(Events.CUSTOM, { type: Events.TUNNEL_TRANSITION_DONE });

                        if (UPLOADER_MODE || EDIT_MODE || CINEMATIC ) {
                            return;
                        }

                        if(CURRENT_SPACE?.exhibit?.params?.cameraView){
                            switch(CURRENT_SPACE?.exhibit?.params?.cameraView){
                                case "first":
                                    Camera.setFirstPerson();
                                    break;
                                case "third":
                                    Camera.setThirdPerson();
                                    break;
                            }
                            return;
                        }

                        if (!opts.userData?.settings?.camera) {

                            SET_IS_FIRST_PERSON(true);
                        } else {

                            SET_IS_FIRST_PERSON(opts.userData.settings.camera === "first_person");
                        }

                        if (!IS_FIRST_PERSON) {

                            Camera.setThirdPerson();
                        }
                    }
                } )


            var ps = [];

            if( CURRENT_STATE == APP_STATES.PANORAMA && STATE != APP_STATES.PANORAMA ) {

                this.pano.hide()

                this.pano.panoSpaceArtwork.closePano()
            }

            switch (STATE) {

                case APP_STATES.INTRO:

                    if (!isLobbyDestinationPreparing()) {
                        Emitter.emit(Events.CUSTOM, { type: Events.TUNNEL_TRANSITION_START });
                    }

                    this.dispose()

                break;

                case APP_STATES.SPACE:


                    if(CURRENT_STATE == APP_STATES.TRANSITION ) {

                        if( this.highlightArtwork ) {

                            await HighlightArtworkFactory.restore( this.highlightArtwork )

                            if ( this.highlightArtwork.parent?.isPanorama ) {

                                this.highlightArtwork.parent.look();
                            }

                            this.highlightArtwork = null
                        }

                        break;
                    }

                    if( CURRENT_STATE != APP_STATES.CINEMATIC && CURRENT_STATE != APP_STATES.PANORAMA && opts.space ){

                        if (this.currentSpace) {
                            this.dispose()
                        }

                        this.init(opts)

                        if (DEBUG) {

                            this.addDebug(this.currentSpace.scene)

                        }
                    }

                    if(this.currentSpace?.kitbash) {

                        ps.push(this.currentSpace.kitbash.setState(STATE, opts))
                    }

                    // ps.push(this.currentArtworks?.setState(STATE, opts))
                    ps.push(this.currentPortals?.setState(STATE, opts))

                    break;

                case APP_STATES.EXPOSITION:


                    break;

                case APP_STATES.TELEPORT:

                    this.dispose()

                    this.init(opts)

                    if ( IS_DESKTOP && !PortalHistory.isEmpty() ) {

                        // Idially we would like to keep it instead of disposing it everytime

                        this.label.setState(
                            LABEL_STATES.ATTACHED,
                            {
                                // messageState : MESSAGE_STATES.BACK,
                                ...BACK_PORTAL_MESSAGE,
                                roomParameters: opts.roomParameters,
                                parent: this,
                                target: IS_FIRST_PERSON ? Camera.current : this.mainPlayer,
                                distance: 4.6
                            }
                        )

                        this.delayed = gsap.delayedCall(3, () => {
                            this.label.setState(LABEL_STATES.DETACHED);
                            this.delayed = null
                        });

                    }

                    break;

                case APP_STATES.TRANSITION:

                    if(opts.highlight) {

                        this.highlightArtwork = HighlightArtworkFactory.get( opts.target )

                        if ( opts.target.isPanorama ) {

                            opts.target.leave();
                        }

                        this.add(  this.highlightArtwork )
                    }


                    this.currentArtworks.isTransitionning = true

                    break;

                case APP_STATES.CINEMATIC:

                    break;

                case APP_STATES.PANORAMA:

                    const panoramaTexture = opts.mesh.mesh.material.uniforms.map.value

                    this.pano =  PanoramaFactory.get(panoramaTexture)

                    this.pano.panoSpaceArtwork =  opts.mesh

                    this.add( this.pano )

                    this.pano.show()

                    break;
            }

            Promise.all(ps).then(() => {

                resolve();
            }).catch(reject);
            } catch (error) { reject(error); }
        });
    }

    stateDone( STATE, opts ){

        return new Promise( ( resolve )=>{

            this.editor?.updateState(STATE)

            this.currentSpace?.kitbash?.updateState(STATE)

            switch ( STATE ) {

                case APP_STATES.TRANSITION :

                    if(opts.action === TRANSITION_ACTIONS.PORTAL) {

                        this.currentPortals.transitionDone(opts)
                    }
                    else if(opts.action === TRANSITION_ACTIONS.ARTWORK) {

                        this.currentArtworks.transitionDone(opts)
                    }
                    else {

                        this.currentArtworks.isTransitionning = false
                    }

                   break;
            }

        })

    }

    openBackPortal() {

        return this.currentPortals.openBackPortal()

    }

    openPortal(opts) {

        return this.currentPortals.openCurrentPortal()

    }

    update(deltaTime) {

        if( CURRENT_SPACE?.space ) {

            syncQualityMeshes(CURRENT_SPACE.space.scene, QUALITY == QUALITIES.LOW)
        }


        this.mixers.forEach((mixer) => {
            mixer.update(deltaTime);
        });
    }


    handleCommand = (opts) => {

        if (this.multiplayer) {

            return this.multiplayer.handleCommand(opts.type, opts.payload);
        }
    }


    async optimiseModel(opts) {

        const { default: Optimiser } = await import('@3modules/optimiser')
        return Optimiser.get( opts )
    }

    changeVRM( vrm, opts ){

        return Players.changeVRM( vrm, opts )
    }

    showUsername(val) {

       return Players.showUsername(val);

    }

    scaleVRM( val ){

        return Players.scaleVRM( val )
    }

    getVRMScale() {

        return Players.getVRMScale()
    }


    summonPortal(opts) {

        return this.currentPortals.summonPortal(opts);
    }


    updatePlayer(opts) {

        if (Players.main) {

            Players.main.updatePlayer(opts)
        }
    }

    getPlayerData(opts = {}) {
        if (opts.isFirstPerson) {
            return {
                position: {
                    x: Camera.current.position.x.toFixed(2),
                    y: Camera.current.position.y.toFixed(2),
                    z: Camera.current.position.z.toFixed(2),
                },
                rotation: {
                    x: Camera.current.rotation.x.toFixed(2),
                    y: Camera.current.rotation.y.toFixed(2),
                    z: Camera.current.rotation.z.toFixed(2),
                }
            }
        }

        if (opts.multiplayerPos) {
            return {
                position: {
                    x: Camera.currentControls.world.thirdPersonPos.x.toFixed(2),
                    y: Camera.currentControls.world.thirdPersonPos.y.toFixed(2),
                    z: Camera.currentControls.world.thirdPersonPos.z.toFixed(2),
                },
                rotationY: Camera.current.rotation.y.toFixed(2),
            }
        }

        return Players.main.getPayload();
    }


    getSceneData = (opts) => {

        return {
            placeholdersSize: this.currentArtworks?.artworks?.length || 0,
            portalsSize: this.currentPortals?.children?.length || 0,
            placeholderIds: this.currentArtworks?.artworks?.map?.(artwork => coordsToId(artwork)) || [],
            portalIds: this?.currentPortals?.portals?.map?.(
                portal => portal.placeholderData.portalId
            )
        }
    }

    playEmote( opts ){

        return Players.main.playEmote( opts )
    }

    summonLinkPortal = (opts) => {

        if (this.linkPortal?.active) {

            this.linkPortal.summon(opts);

            this.linkPortal.active = true;

            return;
        }

        this.linkPortal = new LinkPortal();

        this.add(this.linkPortal);

        this.linkPortal.summon(opts);

        this.linkPortal.active = true;
    }

    async setMultiplayer(opts) {


        this.mainPlayer.sessionId = opts.sessionId;

        Socket.init({ MultiplayerService: opts.MultiplayerService })

        this.mainPlayer.initializeMultiplayer(opts)

        this.mainPlayer.initMultiplayer()

        this.multiplayer = Multiplayer.get({ MultiplayerService: opts.MultiplayerService});

        this.add(this.multiplayer)

        Multiplayer.init();

    }

    updateVideoStream(opts) {
        // WebRTC callbacks can arrive before scene setup or after teardown.
        // Never retain these updates: their streams belong to the old session.
        return this.currentStreams?.update(opts)
    }

    toggleAvatarMode( val ) {


        return Players.setAvatarMode(val)
    }

    createDummyPlayer(opts) {

        return Multiplayer.createDummyPlayer(opts)
    }

    stopPlayer() {

        Camera.currentControls.reset()
    }

    disposeMultiplayer(opts) {

        if (this.multiplayer) {

            Socket.dispose()

            if (!opts?.preserveCamera) Camera.thirdPersonCamInited = false;

            Multiplayer.dispose();

            this.multiplayer.removeFromParent();
            this.multiplayer = null;

            console.log('dispose multiplayer yo ')
        }
    }

    async loadMainPlayer(opts) {

        // console.log("call heree #1", opts);
        // console.log("opts", opts);
        // console.log("opts", opts);
        // console.log("opts", opts);



        if (this.mainPlayer) return;

        Players.initUsername()

        await loadMainPlayerAvatars(opts, {
            models: GLTF,
            avatars: InstanceAvatar3D,
            lodUrl: LOD_VRM,
            fallbackUrl: VRMS.square?.url,
            setDefaultVrm: SET_DEFAULT_VRM,
        });

        opts.main = true;

        const mainPlayer = await Players.get(opts)

        if (Players.main?.avatar?.url !== opts.userData.avatar ) {

            Players.main.updatePlayer({
                type: UPDATE_AVATAR,
                payload: opts.userData.avatar
            })
        }

        this.add(mainPlayer);

        const isFirstPerson = opts?.exhibit?.params?.cameraView === "first" || !opts?.userData?.settings?.camera  ||  opts?.userData?.settings?.camera === "first_person";

        if (CINEMATIC || UPLOADER_MODE || isFirstPerson || EDIT_MODE) {

            mainPlayer.visible = true;

            mainPlayer.hide();
        }

        this.mainPlayer = mainPlayer;
        Camera.addAudioListener();

        const isCustomVrm = opts?.vrmMetadata?.userId;

        let scale;

        if (opts.initialScale){
            if (typeof opts.initialScale === "number") {
                scale = opts.initialScale;
            }
        } else if (isCustomVrm) {
            if (typeof opts?.vrmMetadata?.scale === "number") {
                scale = opts?.vrmMetadata.scale;
            }
        } else {
            scale = opts.userData?.settings?.default_vrm_scale;
        }

        if (scale === null || typeof scale === "undefined") {
            scale = this.getVRMScale();
        }

        this.scaleVRM(scale);

        return mainPlayer;
    }

    /**
     *
     * @param { import('@gltypes').SpaceStateOptions } opts
     */
    init(opts) {

        // console.log("root init ...................................")
        // Init & load current space

        // Raycaster.active = true;

        // Stored exhibit.games data is inert. Never compile gallery-authored code.

        this.currentSpace = opts.space;

        this.add(this.currentSpace.scene)

        // force re-render of shadowmap

        // if( this.currentSpace.scene.lighting ) {

        //     this.currentSpace.scene.lighting.render( true )
        // }

        this.mixers = [];

        this.mixers.push(opts.space.mixer);

        // Raycaster.register(
        //     opts.space.colliders.length > 0
        //         ? opts.space.colliders
        //         : opts.space.scene.children,
        //     Raycaster.TYPES.COLLIDERS
        // );


        Raycaster.register(
            opts.space.floors.map(it => it.raycastMesh),
            Raycaster.TYPES.FLOORS
        )

        // Load artworks
        this.currentArtworks = ArtworkFactory.get({
            ...opts,
            mixers: this.mixers,
        });

        this.add(this.currentArtworks);

        this.currentArtworks.addEvents()

        Raycaster.register(
            this.currentArtworks.raycastMeshes,
            Raycaster.TYPES.ARTWORKS
        );

        this.currentStreams = new StreamContainer(opts)

        this.add(this.currentStreams)

        // those are added here just to be accessible from elsewhere (e.g player camera collisions)
        // StreamContainer manages its own mouse raycasting for now
        Raycaster.register(
            this.currentStreams.raycastMeshes,
            Raycaster.TYPES.STREAMS
        )

        // Load portals
        this.currentPortals = PortalFactory.get(opts);

        this.add(this.currentPortals);

        this.currentPortals.addEvents()

        Raycaster.register(
            this.currentPortals.label,
            Raycaster.TYPES.LABEL
        )


        Raycaster.register(
            this.currentPortals.raycastMeshes,
            Raycaster.TYPES.PORTALS
        )

        if (UPLOADER_MODE) {
            this.currentArtworks.visible = opts?.roomParameters?.showPlaceholders;
        }


        this.editor = new Editor({
            ...opts,
            mixers: this.mixers,
        })

        this.add(this.editor)

        this.editor.setEnabled(EDIT_MODE || UPLOADER_MODE)

        this.setFog( opts )

        if( opts.space.scene.lighting ) {

            opts.space.scene.lighting.render( true )
        }

    }

    teleport(opts) {

        if(opts.artwork) {

            const id = typeof opts.artwork === "string" ? opts.artwork : opts.artwork.id

            let artwork = this.currentArtworks.findArtwork(it => it.data.id === id)

            if(artwork != null) {

                return Camera.gotoTarget(artwork, opts.checkCollitions ?? true)
            }
        }
        else if(opts.position || opts.rotation) {

            const position = opts.position
                ? new Vector3(opts.position.x, opts.position.y, opts.position.z)
                : Camera.current.position.clone()

            const rotation = opts.rotation
                ? opts.rotation instanceof Vector3
                    ? opts.rotation
                    : new Vector3(opts.rotation.x, opts.rotation.y, opts.rotation.z)
                 : null

            return Camera.goto(position, rotation)
        }
    }

    _onContentChanged = () => {

        // console.log("content changed")

        SET_SHADOW_NEEDS_UPDATE(true)
    }

    addContentChangeEvents() {

        Emitter.on(Events.ARTWORK_ADDED, this._onContentChanged)

        Emitter.on(Events.ARTWORK_REMOVED, this._onContentChanged)

        Emitter.on(Events.PORTAL_ADDED, this._onContentChanged)

        Emitter.on(Events.PORTAL_REMOVED, this._onContentChanged)

        Emitter.on(Events.STREAM_ADDED, this._onContentChanged)

        Emitter.on(Events.STREAM_REMOVED, this._onContentChanged)

        Emitter.on(Events.COMPONENT_ADDED, this._onContentChanged)

        Emitter.on(Events.COMPONENT_REMOVED, this._onContentChanged)
    }

    // removeContentChangeEvents() {

    //     Emitter.off(Events.ARTWORK_ADDED, this._onContentChanged)

    //     Emitter.off(Events.ARTWORK_REMOVED, this._onContentChanged)

    //     Emitter.off(Events.PORTAL_ADDED, this._onContentChanged)

    //     Emitter.off(Events.PORTAL_REMOVED, this._onContentChanged)

    //     Emitter.off(Events.STREAM_ADDED, this._onContentChanged)

    //     Emitter.off(Events.STREAM_REMOVED, this._onContentChanged)

    //     Emitter.off(Events.KITBASH_ADDED, this._onContentChanged)

    //     Emitter.off(Events.KITBASH_REMOVED, this._onContentChanged)
    // }


    tmpMat4 = new Matrix4()

    getTeleportCoords(opts) {

        if(opts.artwork) {

            let artwork = this.currentArtworks.findArtwork(it => {

                return it.data.id === opts.artwork.id
            })

            if(artwork != null) {

                const coords = Camera.getPreferredTragetLookatCoords(artwork, true)

                if(coords) {

                    const lookat = coords.rotation

                    this.tmpMat4.lookAt(coords.position, lookat, Camera.current.up)

                    const rotation = new Euler().setFromRotationMatrix(this.tmpMat4, "YXZ")

                    return { position: coords.position, rotation }
                }


            }
        }
    }

    releasePlayer() {
        this.disposeMultiplayer();
        Camera.releaseSession();
        this.mainPlayer?.dispose();
        this.mainPlayer = null;
        Players.instances = [];
        Players.disposeAll();
        InstanceAvatar3D.disposeAll();
        GLTF.releaseSession();
    }

    // Clear references before disposing: repeated exits and failing custom components
    // must not retain the previous scene or prevent the remaining cleanup.
    dispose = () => {
        const release = (dispose) => {
            try { dispose(); } catch (error) { console.error("Scene resource cleanup failed", error); }
        };
        release(clearWorldTransitionCache);
        const space = this.currentSpace;
        this.currentSpace = null;
        if (space) {
            this.remove(space.scene);
            release(() => space.scene.fog?.fogTexture?.dispose());
            release(() => space.scene.dispose());
            release(() => space.scene.lighting?.dispose());
            release(() => space.kitbash?.dispose());
        }
        this.delayed?.kill();
        this.delayed = null;
        for (const field of ["linkPortal", "currentArtworks", "currentStreams", "currentPortals", "editor", "scriptContainer"]) {
            const object = this[field];
            this[field] = null;
            if (object) {
                if (object.isObject3D) this.remove(object);
                release(() => object.dispose());
            }
        }
        for (const mixer of this.mixers) release(() => {
            mixer.stopAllAction();
            mixer.uncacheRoot(mixer.getRoot());
        });
        this.mixers = [];
        renderer.renderLists?.dispose?.();
        renderlist.reset();
        for (const type of [Raycaster.TYPES.COLLIDERS, Raycaster.TYPES.ARTWORKS,
            Raycaster.TYPES.PORTALS, Raycaster.TYPES.FLOORS, Raycaster.TYPES.STREAMS]) {
            Raycaster.unregisterAll(type);
        }
    }

    async edit(type, opts) {

        return this.editor.edit(type, opts)
    }

    onRecord( timer ){

        return this.currentArtworks.onRecord( timer )

    }

    getArtworks(opts) {

        return this.currentArtworks.artworks;
    }

    getPortals(opts) {

        return this.currentPortals.portals;
    }

    getKitbashElements(opts) {

        return this.currentSpace.kitbash?.elements ?? []
    }

    getPlaceholders = (opts) => {

        let placeholders = opts?.artworks ?? this.editor.placeholders

        if (opts?.scope === "random") {
            // since they are already random
            return placeholders
        }

        if(opts?.scope === "in_front" || opts?.scope === "walls") {

            const target = new Vector3()
            Camera.current.getWorldDirection(target)

            // get all placeholders in front of camera
            placeholders = placeholders.filter((p) => {
                try{
                    p.userData.dot = -p.getWorldDirection(new Vector3()).dot(target)
                    return Camera.isObjectVisible(p?.mesh||p?.previewMesh)
                }catch(e) {
                    console.error("[ ERROR GETFRAME-WI01 ]\n"+e.toString())
                    return false
                }
            })

            //check if there is an object in front of the camera in the direction of the placeholder
            placeholders = placeholders.filter((p) => {
                const cleanPos = p.getWorldPosition(new Vector3()).add(p.getWorldDirection(new Vector3()).multiplyScalar(0.3))
                const dir = cleanPos.sub(Camera.current.getWorldPosition(new Vector3()))
                const ray = new ThreeRaycaster(Camera.current.getWorldPosition(new Vector3()), dir.clone().normalize())
                const closests = ray.intersectObjects([...this.editor.walls, ...this.editor.floors, ...this.editor.otherMeshes], true)
                if (closests.length === 0) return true
                if (closests[0].distance < dir.length()) return false;
                return true;
            })

            // sort with placeholders having smallest angle to the camera
            placeholders = placeholders.sort((a, b) => {
                return b.userData.dot - a.userData.dot;
            })

            // get only placeholders that are in the same direction as the first one
            if(opts?.scope === "walls") {
                const maxDot = placeholders[0]?.userData.dot;
                placeholders = placeholders.filter((p) => {
                    return (maxDot - p.userData.dot) < 0.1
                })
            }

            // get closest to camera
            placeholders = placeholders.sort((a, b) => {

                const distA = a.position.distanceToSquared(Camera.current.position)

                const distB = b.position.distanceToSquared(Camera.current.position)

                return distA - distB
            })

            return placeholders;
            // return placeholders.length === 0 ? [ this.editor.placeholders[0] ] : placeholders;
        }

        if(opts?.scope === "closest" || opts?.scope === "closest_in_front") {

            let closest = null

            let minDist = Infinity

            for(let placeholder of placeholders) {

                const dist = placeholder.position.distanceToSquared(Camera.current.position)

                const target = new Vector3()

                Camera.current.getWorldDirection(target)

                if( (opts.scope === "closest" && dist < minDist ) || (opts.scope === "closest_in_front" && Camera.isObjectVisible(placeholder.mesh) && dist < minDist)) {

                    closest = placeholder

                    minDist = dist

                }
            }

            placeholders = [closest]

            return placeholders.length === 0 ? [ this.editor.placeholders[0] ] : placeholders;
        }



        if(opts?.bulkAdd) {

            let cache = new WeakMap()

            const get = o => {

                let v = cache.get(o)

                if(v == null) {

                    v = { vis: null, dist: null }

                    cache.set(o, v)
                }

                return v
            }

            const getVis = o => {

                let v = get(o)

                if(v.vis == null) {

                    v.vis = Camera.isObjectVisible(o.mesh) ? 0 : 1
                }

                return v.vis
            }

            const getDist = o => {

                let v = get(o)

                if(v.dist == null) {

                    v.dist = Camera.current.position.distanceToSquared(o.position)
                }

                return v.dist
            }

            placeholders = placeholders.slice()

            placeholders.sort((p1, p2) => {

                let v1 = getVis(p1)
                let v2 = getVis(p2)

                if(v1 != v2) return v1 - v2

                let d1 = getDist(p1)
                let d2 = getDist(p2)

                return d1 - d2

            })
        }

        return placeholders
    }

    setJump(jump) {
        //
        console.log("currentControls", Camera.currentControls)
        // playerState
        Camera.currentControls.playerState.keyStates["Space"] = jump;

    }

    /**
     *
     * @param {string} artworkId
     *
     * @returns { import("@3constants").PERF_SCORE }
     */
    getPerfScore(artworkId) {

        const artwork = this.editor.getTarget(artworkId)

        if(artwork instanceof SpaceArtwork) {

            if(artwork.mediaType === "CYBER_TEXT") return PERF_SCORES.LOW

            else if(artwork.mediaType === "IMAGE") {

                if(artwork.userData.hdImage) return PERF_SCORES.MEDIUM

                else return PERF_SCORES.LOW
            }

            else if(artwork.mediaType === "VIDEO") {

                // TODO: check for audio tracks

                return PERF_SCORES.HIGH
            }

            else if(artwork.mediaType === "HTML_EMBED" || artwork.mediaType === "YOUTUBE_EMBED") {

                return PERF_SCORES.HIGH
            }

            else if(artwork.mediaType === "HTML") {

                return artwork.userData.enableHTMLView ? PERF_SCORES.HIGH : PERF_SCORES.LOW
            }

            else if(artwork.mediaType === "AUDIO") {

                return PERF_SCORES.MEDIUM

            } else if (artwork.mediaType === "GLOBAL_STREAM") {

                return PERF_SCORES.LOW

            } else  if (artwork.mediaType === "TRIGGER_ZONE") {

                return PERF_SCORES.LOW

            }

            if(artwork.mediaType === "PANORAMA") return PERF_SCORES.MEDIUM

            if(artwork.mediaType === "MODEL") {

                /** @type { ModelSpaceArtwork } */
                // @ts-ignore
                const model = artwork

                return model.getPerfScore()
            }

            return null
        }
        else if(artwork instanceof Portal) {

            return "high"
        }
        else {

            return null
        }
    }

    getItem(id) {
        //
        return this.editor.getTarget(id)
    }

    onRecordStart(){

        return this.currentArtworks.onRecordStart()
    }

    addEvents() {

        Emitter.on(Events.PRE_UPDATE, this.update.bind(this));

        this.addContentChangeEvents();
    }

    // destroy previous space

    destroy(object) {
        return new Promise((resolve, reject) => {
            // if( DEBUG ){

            //  this.removeDebug( this.currentSpace.scene )
            // }

            // this.remove( object )

            resolve();
        });
    }

    async uploaderSetRoomParameters(opts) {

        const space = CURRENT_SPACE?.space

        let roomParametersReturn = {}

        if(space == null) return

        if (opts.space && space != opts.space) return

        // console.log( opts )
        // console.log( opts )
        // console.log( opts )
        // console.log( opts.type )
        // console.log( opts.type )

        if(opts.roomParameters == null) debugger

        opts.roomParameters ??= CURRENT_SPACE?.roomParameters

        switch( opts.type ) {


            case UPLOADER_TYPES.BACKGROUND:
            case UPLOADER_TYPES.BACKGROUND_TYPE:
            case UPLOADER_TYPES.TURBIDITY:
            case UPLOADER_TYPES.RAYLEIGH:
            case UPLOADER_TYPES.SUNPOSITION:
            case UPLOADER_TYPES.MIECOEFFICIENT:
            case UPLOADER_TYPES.MIEDIRECTIONALG:
            case UPLOADER_TYPES.SKY_ENABLED:
            case UPLOADER_TYPES.AZIMUTH:
            case UPLOADER_TYPES.ELEVATION:
            case UPLOADER_TYPES.CUSTOMENV:
            case UPLOADER_TYPES.APPLY_BACKGROUND:

                let background = await SpaceFactory.getBackgroundDisplay( opts )

                space.scene.updateBackround(background);

                space.background       = background;

                if( opts?.roomParameters?.environnement_type == 'scene' ) {

                    roomParametersReturn.envMap = await this.setEnvMap( opts )
                }

                this.setFog(opts)

                break;


            case UPLOADER_TYPES.ENVIRONNEMENT_TYPE:
            case UPLOADER_TYPES.ENVIRONNEMENT_POSITION:
            case UPLOADER_TYPES.APPLY_ENVMAP_BACKGROUND:
            case UPLOADER_TYPES.APPLY_ENV_MAP:

                roomParametersReturn.envMap = await this.setEnvMap( opts )

                break;


            case UPLOADER_TYPES.GRAVITY:
            case UPLOADER_TYPES.JUMP:
            case UPLOADER_TYPES.PLAYER_SPEED:

                Camera.setPhysicsOpts( opts.roomParameters )
                break;

            case UPLOADER_TYPES.NEAR:

                Camera.current.near = Camera.current.baseNear = walkNear(opts.roomParameters.near);

                Camera.current.updateProjectionMatrix();

                break;

            case UPLOADER_TYPES.FAR:

                this.updateCameraFar(opts)

                break;

            case UPLOADER_TYPES.SHOW_PLACEHOLDERS:

                this.setShowPlaceholders(opts.roomParameters.showPlaceholders)

                break;


              case UPLOADER_TYPES.FOG_ENABLED:
              case UPLOADER_TYPES.NEAR_FOG:
              case UPLOADER_TYPES.FAR_FOG:

                this.setFog( opts )

                break;

            case UPLOADER_TYPES.FLOOR_ENABLE_REFLECTOR:
            case UPLOADER_TYPES.FLOOR_REFLECTOR_SCALE:
            case UPLOADER_TYPES.FLOOR_REFLECTOR_POSITION:
            case UPLOADER_TYPES.FLOOR_REFLECTOR_OPACITY:
            case UPLOADER_TYPES.FLOOR_REFLECTOR_COLOR:
            case UPLOADER_TYPES.FLOOR_REFLECTOR_BLUR:
            case UPLOADER_TYPES.FLOOR_REFLECTOR_ENABLE_NORMAL_MAP:
            case UPLOADER_TYPES.FLOOR_REFLECTOR_NORMAL_MAP_STRENGTH:
            case UPLOADER_TYPES.FLOOR_REFLECTOR_NORMAL_MAP_IMAGE:
            case UPLOADER_TYPES.FLOOR_REFLECTOR_NORMAL_MAP_TILING:

            case UPLOADER_TYPES.FLOOR_ENABLE_WATER:
            case UPLOADER_TYPES.FLOOR_WATER_SCALE:
            case UPLOADER_TYPES.FLOOR_WATER_POSITION:
            case UPLOADER_TYPES.FLOOR_WATER_OPACITY:
            case UPLOADER_TYPES.FLOOR_WATER_COLOR:

                  // REFLECTOR

                    var reflector = space.scene.reflector

                    if(  opts.roomParameters.enableReflector ) {

                        if( reflector == null ) {

                            reflector = ReflectorFactory.getRaw( opts )

                            space.scene.reflector = reflector

                            space.scene.add( reflector )
                        }

                        reflector.position.copy( opts.roomParameters?.reflectorOptions?.position )

                        reflector.scale.x = opts.roomParameters?.reflectorOptions.scale.x

                        reflector.scale.y = opts.roomParameters?.reflectorOptions.scale.z

                        reflector.opacity = opts.roomParameters?.reflectorOptions.opacity

                        reflector.color = opts.roomParameters?.reflectorOptions.color

                        reflector.blur = opts.roomParameters?.reflectorOptions.blur

                        reflector.useNormalMap =  opts.roomParameters?.reflectorOptions?.normalmap.enabled

                        reflector.normalStrength = opts.roomParameters?.reflectorOptions?.normalmap.strength

                        reflector.tiles = opts.roomParameters?.reflectorOptions?.normalmap.tiles

                        if ( opts.roomParameters?.reflectorOptions?.normalmap.enabled ) {

                            reflector.normalMap =  opts.roomParameters?.reflectorOptions.normalmap.images.path
                        }
                    }


                    // remove if not enable

                    if(opts.roomParameters.enableReflector == false && reflector != null ) {

                        space.scene.remove( space.scene.reflector )

                        disposeObject3D(space.scene.reflector)

                        space.scene.reflector = null
                    }


                // WATER

                // add if enable and copy position
                if(  opts.roomParameters.enableWater ) {

                    if( space.scene.water == null ) {

                        const water = WaterFactory.get()

                        space.scene.water = water

                        space.scene.add( water )
                    }

                    space.scene.water.position.copy( opts.roomParameters?.waterOptions?.position )

                    space.scene.water.scale.x = opts.roomParameters?.waterOptions.scale.x

                    space.scene.water.scale.y = opts.roomParameters?.waterOptions.scale.z

                    space.scene.water.opacity = opts.roomParameters?.waterOptions.opacity

                    space.scene.water.color = opts.roomParameters?.waterOptions.color

                }

                // remove if not enable

                if(opts.roomParameters.enableWater == false && space.scene.water != null ){

                     disposeObject3D(space.scene.water)

                     space.scene.remove( space.scene.water )

                     space.scene.water = null

                }

                console.log("FLOOR_WATER_POSITION",opts.roomParameters?.waterOptions?.position)


                break;

        }

        if (CURRENT_SPACE != null) {

            CURRENT_SPACE.roomParameters = opts?.roomParameters;
        }

        return roomParametersReturn

    }

    async setEnvMap( opts ){

        const space = opts?.space ?? CURRENT_SPACE?.space

        if(space == null) return

        space.scene._save()

        let envMap = await SpaceFactory.getPBREnvMap( space.scene, opts )

        space.scene._restore()

        // space.scene.background = bg

        if( envMap != null )  {

            space.scene.traverse(mesh => {

                if (mesh instanceof Mesh) {

                    if (mesh.material.type === "MeshStandardMaterial" && mesh.material.needsEnvMap != false ) {

                        mesh.material.envMap = envMap;

                        mesh.material.needsUpdate = true;

                    }
                }
            })
        }

        space.cubeMap = envMap

        return envMap
    }

    updateCameraFar( opts ) {

        let far = opts.roomParameters.fog?.enabled ? opts.roomParameters.fog.far : opts.roomParameters.far

        Camera.setFar( far )
    }

    setFog( opts ) {

        const space = opts?.space ?? CURRENT_SPACE?.space

        if(space == null) return

        Scene.fog = null;

         const background = space.background

        if( opts.roomParameters?.fog?.enabled ) {

            Scene.fog  = FogFactory.get(background,  opts)
        }

        this.updateCameraFar( opts )

    }

    setShowPlaceholders(visible) {
        //
        this.editor.placeholders.forEach((placeholder) => {

            placeholder.visible = visible;
        });
    }

    addDebug(object) {
        object.traverse((child) => {
            if (child.name && child.geometry) {
                let folder = gui.folders.space.addFolder(
                    child.name + Math.random()
                );

                if(child.material.map){

                    folder.add(child.material.map, 'name')
                }

                folder.add(child, "visible");
            }
        });
    }

    removeDebug(object) {
        // remove gui
    }
}

export default new Root()
