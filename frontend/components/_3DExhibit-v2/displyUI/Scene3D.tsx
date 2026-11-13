import { tripMark } from "@utils/tripTimingMarks";
import { markWorldTravelReady, finishWorldTravel } from "@utils/nativeWorldTravel";
import { yieldLobbyLoadingWork } from "@utils/lobbyLoadingBudget";
import { markNativeStartup, publishNativeStartupDiagnostics } from "@utils/nativeStartupDiagnostics";
import {
    failLobbyDestination, holdLobbyDestinationAudio, isLobbyDestinationPreparing,
    lobbyDestinationPrepared, lobbyDestinationProgress,
} from "@utils/lobbyDestinationBridge";
import audioListener from "@3gl/globals/audioListener";
import { loadSceneAssets } from "@utils/loadSceneAssets";
import {
    finishSpaceEntrance,
    handOffSpaceEntranceStars,
} from "@utils/spaceEntrance";
import { legacyGpuResources } from "@3utils/sessionResources";
import { legacySceneSessions } from "@utils/sceneSession";
import Loader from "@3loader";
import ImageCache from "@3utils/imagecache";
// @ts-check

import React, {
    CSSProperties,
    Dispatch,
    SetStateAction,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import styled, { css } from "styled-components";
import { UserContext } from "@components/context/UserContext";
import { useRouter } from "next/router";
import { getCinematic, getDestination } from "@utils/saveToDb";
import { deepClone, noop, param, parseLocation } from "@utils/js";
import { DefaultRoomParameters } from "@3utils/defaultroomparameters";
import VrmProvider from "@components/context/VrmContext";
import World from "@3gl/api";
import {
    APP_STATES,
    CANVAS,
    CINEMATIC,
    COMPRESSED_SUPPORT,
    ERROR_CODES,
    GPU_TIER,
    IS_MOBILE,
    SET_DEFAULT_VRM,
    WORLD_CREATED,
} from "@3constants";
import {
    classicRoomModelOptions,
    selectRoomModelSource,
} from "@3utils/roomModelSource";
import { startLoadTimeline } from "@utils/loadTimings";
import {
    readDocumentServerTimings,
} from "@utils/serverside/documentServerTimings";
import { merge } from "@utils/js";
import {
    ErrorState,
    IntroState,
    LoadingStartState,
    LoadingEndState,
    SpacePlayingState,
    SpaceIdleState,
    WorldErrorKind,
    WorldState,
} from "@3/utils/constants";
import {
    atStage,
    describeWorldLoadError,
    WorldLoadStage,
    WorldLoadStageError,
} from "@3/utils/worldLoadError";
import VrmApi from "@api/vrm/_api";
import { NOTNYC_getUser } from "@utils/partnerships/notnyc";
import { useMultiplayer } from "../context/MultiplayerProvider";
import Events from "@3events";
import { useWorld } from "../hooks/useWorld";
import { Experience } from "@uitypes/experience";
import { RoomParameters, Spline } from "@uitypes/roomParameters";
import { getExhibitByCustomLink } from "@utils/csr";

async function getExhibitData(slug) {
    try {
        let exhibit = await getExhibitByCustomLink(slug);

        if (exhibit != null) {
            const roomParameters = await getDestination(exhibit.info?.room);
            if (roomParameters) {
                return {
                    exhibit,
                    roomParameters,
                };
            }
        }
    } catch (err) {
        return null;
    }
}

import { formatAvatar } from "../utils/avatar";
import { SET_DEFAULT_AVATAR_PICTURE } from "../three/factory/player/constants";
import { useSnackbar } from "@components/Snackbar";
import { useWorldHandler } from "../hooks/useWorldHandler";
import { showError, showInfo, showPrompt } from "@components/Dialogs";
import generateStaticPortals from "@utils/partnerships/rtfkt/portal";
import { useAI } from "@features/ai/context/AIContext";
import {
    DEFAULT_VRMS,
    VrmContext,
    useVrm,
} from "@components/context/VrmContext";

import { overrideInitialCoords } from "@3utils/spaceutils";
import { observeSceneSize } from "@utils/artworks/observeSceneSize";

export interface Scene3DProps {
    // Props from top page
    exhibit: Experience;
    destination: RoomParameters;
    style?: Partial<CSSProperties>;
    isFullScreen?: boolean;
    isSceneBackground?: boolean;
    isHub?: boolean;
    isDisplayed?: boolean;
    uploaderParameters?: any;
    isUploader?: boolean;
    spline?: Spline;
    styleCanvas?: Partial<CSSProperties>;
    // Additional props from Display/Edit scenes
    editMode?: boolean;
    onInitSpace?: (destination: RoomParameters) => any;
    setIsPlaying?: (b: boolean) => void;
    setHasBackPortal?: (b: boolean) => void;
    setSceneLoaded?: (b: boolean) => void;
    children?: (state: {
        sceneContainer: React.MutableRefObject<HTMLElement>;
        worldState: WorldState;
    }) => React.ReactElement;
    setCinematic?: Dispatch<SetStateAction<any>>;
    sceneLoadedRef?: React.MutableRefObject<boolean>;
    /** The host renders `SpaceError` for an ERROR state, so a failed load
     * needs no dialog. Hosts without that screen keep the dialog. */
    hasErrorScreen?: boolean;
}

const UNKNOWN_ERR_MSG = "An Error has occured.";

const ErrorMessages = {
    [ERROR_CODES.INVALID_MODEL]: {
        title: "Failed to load root nodes",
        message:
            "Please check the model parenting at docs.oncyber.io and make sure you have no other object at the model's root",
    },

    [ERROR_CODES.INVALID_TRANSFORM]: {
        title: "Root nodes have custom transforms",
        message:
            "To avoid further issues please make sure your parent objects have a position of (0,0,0), a scale of (1,1,1) and default rotation, you can check the sample model at docs.oncyber.io",
    },
    [ERROR_CODES.INVALID_JSON_CINEMATIC]: {
        title: "Failed to load cinematic JSON",
        message:
            "To avoid further issues please make sure your upload a valid Cinematic Json format file.",
    },
    [ERROR_CODES.INVALID_VRM_COUNT_MESH]: {
        title: "Failed to load VRM",
        message:
            "Please check that your model only is one mesh and one material, you can check the doc at docs.oncyber.io",
    },
    [ERROR_CODES.INVALID_VRM_BONES]: {
        title: "Failed to load VRM",
        message:
            "Please check that your model is using the correct bones naming and structures, you can check the doc at docs.oncyber.io",
    },
};

/************************************** */
/************************************** */
// The legacy shell is initialized only when a scene session is activated.
/************************************** */
/************************************** */

export function Scene3D_Child({
    // Props from top page
    exhibit: initExhibit,
    destination: _destination,
    style = {},
    spline,
    isSceneBackground = false,
    isHub: _isInitHub = false,
    isDisplayed = true,
    uploaderParameters,
    isUploader = false,
    styleCanvas = {},
    // Additional props from Display/Edit scenes
    editMode = false,
    isFullScreen = false,
    onInitSpace,
    setIsPlaying,
    setHasBackPortal = noop,
    children,
    setCinematic = noop,
    setSceneLoaded = noop,
    sceneLoadedRef = null,
    hasErrorScreen = false,
}: Scene3DProps) {
    //#region context
    const router = useRouter();

    const world = useWorld();

    const { isFocused } = useAI({});

    const [openSnackbar, closeSnackbar] = useSnackbar({
        position: "top-left",
        style: { top: "12px" },
    });

    const { initVrm } = useVrm();

    const {
        userData,
        token,
        exhibit,
        dispatch,
        isAnonymous,
        // changeScenePlayerMode,
        // // sceneModePlayer,
    } = useContext(UserContext);

    const { userId, mode, dispose: disposeMultiplayer } = useMultiplayer();
    //#endregion

    //#region State
    const [worldState, setWorldState] = useState<WorldState>(LoadingStartState);
    //#endregion

    //#region refs
    const sceneContainer = useRef<HTMLDivElement>(null);
    const canvasContainer = useRef<HTMLDivElement>(null);
    //#endregion


    const isAlreadLoaded = useRef(null);

    useEffect(() => {
        if (!sceneLoadedRef?.current && !isAlreadLoaded?.current) {
            if (worldState.type === "SPACE_IDLE") {
                if (sceneLoadedRef) sceneLoadedRef.current = true;
                isAlreadLoaded.current = true;
            }
        }
    }, [worldState?.type]);

    useWorldHandler(Events.ERROR, (value) => {
        //
        let error = ErrorMessages[value.code];

        showError(error?.message || UNKNOWN_ERR_MSG, error?.title);

        // openSnackbar(message, 5000, null, "error");
    });

    useWorldHandler(Events.UI_PROMPT, async (value) => {
        //
        const { message, onSubmit, type, resolve } = value;

        const val = await showPrompt({ type, message, onSubmit });

        resolve(val);
    });

    useEffect(() => {
        if (world?.current) {
            resize();
        }
    }, [isFullScreen, world?.current]);

    useEffect(() => {
        if (!world?.current) return;
        return observeSceneSize(canvasContainer.current, resize);
    }, [world?.current]);

    useEffect(() => {
        if (isFocused && editMode) {
            world.current?.stopPlayer();
        }
    }, [isFocused]);

    //#region effects
    useEffect(() => {
        let mounted = true;
        let loadFailed = false;
        let signal: AbortSignal;
        let pendingSpace: any = null;
        let attachedSpace = false;
        let resizeTimer: ReturnType<typeof setTimeout>;
        // The step that is running, so a failure can be explained in words.
        let stage: WorldLoadStage = "engine";
        const describeFailure = (error: unknown) =>
            describeWorldLoadError(error, {
                stage,
                online:
                    typeof navigator === "undefined"
                        ? undefined
                        : navigator.onLine,
                codes: ERROR_CODES,
                graphics: CANVAS?.dataset?.renderer,
            });
        // One timeline per load, sent (sampled) to analytics when the visitor
        // can play; the stage names are the ones these marks always had.
        const load = startLoadTimeline("world");
        const loadStarted = performance.now();
        markNativeStartup("scene-effect-start");
        const markLoad = (stage: string) => {
            if (!mounted || signal?.aborted) return;
            load.mark(stage);
            tripMark(`world:${stage}`);
            if (process.env.NODE_ENV !== "development") return;
            const elapsed = Math.round(performance.now() - loadStarted);
            const loadTimings = load.stages;
            if (["engine-ready", "loaders-ready", "scene-assets-start", "player-loaded", "space-loaded", "prepared"].includes(stage))
                markNativeStartup(stage);
            CANVAS?.setAttribute("data-world-load-stage", stage);
            CANVAS?.setAttribute("data-world-load-ms", String(elapsed));
            CANVAS?.setAttribute("data-world-load-document-ms", String(Math.round(performance.now())));
            CANVAS?.setAttribute("data-world-load-start-document-ms", String(Math.round(loadStarted)));
            CANVAS?.setAttribute("data-world-load-timings", JSON.stringify(loadTimings));
            publishNativeStartupDiagnostics(CANVAS);
        };
        const checkpoint = () => {
            if (signal.aborted) throw new DOMException("Scene session ended", "AbortError");
        };
        // Starts downloading the file the classic room kit will choose (same
        // options, see classicRoomModelOptions); the loader parses these bytes
        // instead of fetching again. Kitbash ("future") rooms, the editor and
        // the uploader choose or rewrite their file differently: they wait.
        const prefetchRoomModel = (destination: RoomParameters & any) => {
            if (editMode || isUploader || destination?.isFuture) return false;
            const source = selectRoomModelSource(
                destination,
                classicRoomModelOptions({
                    preferLowResolution: isLobbyDestinationPreparing(),
                    gpuTier: GPU_TIER.path,
                    isMobile: IS_MOBILE,
                    compressedSupport: COMPRESSED_SUPPORT,
                    skin: initExhibit.info?.currentSkin,
                    editing: editMode || isUploader,
                })
            );
            if (source.source === "upload" || !source.url) return false;
            return Loader.prefetchModel(source.url, {
                compressedTextures: source.quality === "low_compressed",
            });
        };
        holdLobbyDestinationAudio(audioListener);
        const interact = () => {
            if (!isLobbyDestinationPreparing()) world.current?.setUserInteracted();
        };
        async function initNewSpace() {
            stage = "starting";

            setSceneLoaded(false);
            lobbyDestinationProgress(.1);

            SET_DEFAULT_AVATAR_PICTURE(initExhibit); //! SHOULD REFACTOR

            // These reads are independent of avatar/engine setup. Start them
            // together so room downloads do not sit behind profile requests.
            const avatarImageReady = formatAvatar(userData, (action) => {
                if (mounted && !signal?.aborted && !loadFailed) dispatch(action);
            }, initExhibit);
            const from = param(router.query.from);
            const destinationReady = Promise.all([
                !uploaderParameters
                    ? getDestination(initExhibit?.info?.room, _destination)
                    : uploaderParameters,
                !editMode && from ? getExhibitData(from) : null,
            ]);
            // Cancellation or avatar failure can occur before these are awaited.
            // Observe rejection now; await the original promises at their fences.
            void avatarImageReady.catch(() => {});
            void destinationReady.catch(() => {});

            // The room file depends only on the destination and the GPU tier:
            // its download starts as soon as both are known, while the avatar,
            // options and intro steps below run.
            const gpuTierReady = world.current.resolveGpuTier();
            void gpuTierReady.catch(() => {});
            const sceneInputsReady = atStage("destination", async () => {
                let [destination, portalData] = await destinationReady;

                checkpoint();

                markLoad("destination-metadata-ready");
                if (!destination) {
                    // getDestination returns nothing for a missing destination
                    // and for a failed request alike.
                    throw Object.assign(new Error("no-destination"), {
                        kind: "destination-unavailable" as WorldErrorKind,
                    });
                }

                let cinematic = null;

                if (editMode || CINEMATIC) {
                    const cinematicResp = await atStage("cinematic", () =>
                        getCinematic(initExhibit.id, destination.slug)
                    );

                    checkpoint();

                    if (cinematicResp?.success) {
                        setCinematic(cinematicResp.cinematic);

                        cinematic = cinematicResp.cinematic;
                    } else {
                        setCinematic(null);
                    }
                }

                if (!editMode || (!isUploader && !CINEMATIC)) {
                    if (initExhibit.params) {
                        destination = {
                            ...destination,
                            ...initExhibit.params,
                        };
                    }
                    let coords = String(router.query.coords);
                    destination = overrideInitialCoords(destination, coords);
                }

                destination = merge(
                    deepClone(DefaultRoomParameters),
                    deepClone(destination)
                );
                return { destination, portalData, cinematic };
            });
            void sceneInputsReady.catch(() => {});
            let roomPrefetched = false;
            void Promise.all([sceneInputsReady, gpuTierReady]).then(
                ([{ destination }]) => {
                    if (!mounted || signal.aborted) return;
                    roomPrefetched = prefetchRoomModel(destination);
                    if (roomPrefetched) markLoad("room-download-start");
                },
                () => {}
            );

            markLoad("avatar-metadata-start");
            stage = "avatar";
            const vrm = await initVrm(userData, isAnonymous, initExhibit, _destination);
            markLoad("avatar-metadata-ready");
            stage = "starting";

            checkpoint();

            await yieldLobbyLoadingWork({ signal, force: true });
            const options = await world.current.setOptions({
                editMode,
                uploaderMode: isUploader,
                mode,
                exhibit: initExhibit,
                // @ts-ignore
                userData: {
                    ...userData,
                    VRM: vrm?.url,
                },
            });

            checkpoint();

            markLoad("options-ready");
            setIsPlaying?.(false);

            await world.current.play();

            checkpoint();

            // The engine's star field carries on the entrance's stars and
            // starts revealing it; finishSpaceEntrance below covers loads
            // that never showed any.
            await world.current.setState(APP_STATES.INTRO, {
                handOffStars: handOffSpaceEntranceStars,
            });

            checkpoint();
            finishSpaceEntrance();
            markLoad("intro-ready");

            stage = "scene";
            // From here two chains run at once and each tags its own failure:
            // the visitor's profile, intro assets and avatar; and the room,
            // whose download is usually under way already. Both settle before
            // the space is shown or the session is cleaned up.
            let avatarImg;
            let destination;
            let portalData;
            let cinematic = null;
            const [mainPlayer, space] = await loadSceneAssets(
                () => atStage("starting", async () => {
                    avatarImg = await avatarImageReady;
                    markLoad("profile-image-ready");

                    checkpoint();

                    world.current.setCurrentUser({
                        userData: {
                            ...userData,
                            avatar: avatarImg,
                        },
                        id: userId,
                        token,
                        isAnonymous: !!isAnonymous,
                    });

                    await yieldLobbyLoadingWork({ signal, force: true });
                    await world.current.loadState(APP_STATES.INTRO);

                    checkpoint();

                    markLoad("intro-assets-ready");
                    setWorldState(IntroState);

                    const inputs = await sceneInputsReady;

                    checkpoint();

                    return atStage("avatar", async () => {
                        const loadedPlayer = await world.current.loadMainPlayer({
                            userId,
                            userData: {
                                ...userData,
                                ...options,
                                username: userData?.username || userId || "",

                                avatar: avatarImg,

                                VRM: vrm?.url,

                                walletId: userData?.walletId || "",
                            },
                            roomParameters: inputs.destination,
                            exhibit: initExhibit,
                            vrmMetadata: vrm,
                            initialScale:
                                initExhibit?.params?.avatarSize ||
                                inputs.destination?.avatarSize ||
                                null,
                        });
                        if (process.env.NODE_ENV === "development") {
                            CANVAS?.setAttribute("data-native-avatar", vrm?.url || "");
                            CANVAS?.setAttribute("data-native-motion", loadedPlayer?.avatar3D?.lobbyMotion ? "lobby" : "legacy");
                        }
                        markLoad("player-loaded");
                        return loadedPlayer;
                    });
                }),
                () => atStage("world-model", async () => {
                    ({ destination, portalData, cinematic } =
                        await sceneInputsReady);

                    checkpoint();

                    lobbyDestinationProgress(.3);
                    markLoad("scene-assets-start");
                    // Record completed resources even if the avatar fails, so
                    // the session can dispose the unattached space safely.
                    pendingSpace = await world.current.loadSpace({
                        roomParameters: destination,
                        exhibit: initExhibit,
                        // Prepared room variants reduce initial texture bytes;
                        // artwork detail/video streaming remains independent.
                        preferLowResolution: isLobbyDestinationPreparing(),
                    });
                    markLoad("space-loaded");
                    return pendingSpace;
                })
            );

            checkpoint();

            let backOpts: any = {};

            if (!editMode && portalData) {
                backOpts.from = portalData;

                let fromCoords = parseLocation(param(router.query.at));

                if (fromCoords) {
                    backOpts.backState = {
                        backPosition: fromCoords.position,
                        backRotation: { _x: 0, _y: fromCoords._y, _z: 0 },
                    };
                }

                setHasBackPortal?.(true);
            }

            if (isUploader) {
                initExhibit.portals = {};
                space.portalPlaceholders.forEach((portal) => {
                    const { portalId } = portal;

                    initExhibit.portals[portalId] = {
                        addedBy: "0xf02cb30a8963e6fe8cc7650a6169e603357650ad",
                        cHeroImg:
                            "https://cyber.mypinata.cloud/ipfs/QmRmfkXahzSgnbnSgzQEq5sRLj1Jda59VAT2V3naMzCYUr?filename=Portal_Preview_001.jpg",
                        cHeroImg360:
                            "https://cyber.mypinata.cloud/ipfs/QmYY8rfL4gTrMSqo8R99ZXC4UGJE33ZpwjXd9UQTGL86dV?filename=Portal_Preview_001.jpg",
                        exhibitId: "MqYbx6AbvYGvCLigQQjo",
                        id: portalId,
                    };
                });
            }

            initExhibit.portals = generateStaticPortals(initExhibit);

            if (spline?.export) {
                cinematic = { export: spline.export };
            }

            lobbyDestinationProgress(.75);
            await yieldLobbyLoadingWork({ signal, force: true });
            attachedSpace = true;
            await world.current.setState(APP_STATES.SPACE, {
                userData: {
                    ...userData,

                    username: userData?.username || userId || "",

                    avatar: avatarImg,

                    walletId: userData?.walletId || "",
                },

                user: {
                    id: userId,
                },

                roomParameters: destination,
                exhibit: initExhibit,
                preferLowResolution: isLobbyDestinationPreparing(),
                space,
                mainPlayer,
                cinematic,
                ...backOpts,
            });

            checkpoint();

            if (userData?.settings?.adjustCamera === "manual") {
                world.current.enableAdjustCamera(false);
            }

            markLoad("scene-state-ready");
            setWorldState(SpacePlayingState);

            if (!editMode) {
                await world.current.setState(APP_STATES.IDLE, {});

            checkpoint();

                markLoad("idle-ready");
                load.end("idle-ready", {
                    modelTier: space?.modelSource?.quality ?? null,
                    roomPrefetched,
                    gpuTier: GPU_TIER.path,
                    quality: world.current.getQuality(),
                    qualityChosen: !!world.current.qualityChosen,
                    renderer: CANVAS?.dataset?.renderer ?? null,
                    viaLobby: isLobbyDestinationPreparing(),
                    // The page's own server stages (Server-Timing), so one
                    // event shows the whole visit.
                    server: readDocumentServerTimings(),
                });
                setWorldState(SpaceIdleState);
                // A direct visit that arrived at the mid room file sharpens to
                // high once its frame rate proves good. Lobby entry refines
                // on reveal (DisplayScene) instead.
                if (!isLobbyDestinationPreparing())
                    world.current.sharpenRoomWhenSmooth();
                // Slow frames lower the resolution in steps, unless the
                // visitor chose a quality in settings.
                world.current.startResolutionGovernor();
            }

            if (CINEMATIC) {
                await world.current.loadState(APP_STATES.CINEMATIC);

            checkpoint();

                await world.current.setState(APP_STATES.CINEMATIC, {
                    // edit:
                    //     user?.id &&
                    //     initExhibit.owner.toLowerCase() === user.id.toLowerCase(),

                    cinematic,

                    edit: true,

                    roomParameters: destination,

                    exhibit: initExhibit,
                });

            checkpoint();

                addCinematicGUI();
            }

            await onInitSpace?.(destination);
            markLoad("native-settings-ready");

            checkpoint();

            setSceneLoaded(true);
            markWorldTravelReady();
            if (isLobbyDestinationPreparing()) {
                // nextUpdate resolves after the real renderer's UPDATE/POST_UPDATE
                // cycle, including synchronous shader work, not iframe load.
                await world.current.nextUpdate();
                checkpoint();
                await world.current.pause();
                checkpoint();
                markLoad("prepared");
                lobbyDestinationPrepared();
            }

            // @ts-ignore
            window.$exhibit = initExhibit;
            // @ts-ignore
            window.$roomParamaters = destination;
        }

        function addCinematicGUI() {}

        async function effect() {
            try {
                if (world.current != null) {
                    await initNewSpace();
                }
            } catch (thrown) {
                loadFailed = true;
                load.cancel();
                if (signal.aborted) return;
                // What the failing step threw, without the step's tag.
                const err =
                    thrown instanceof WorldLoadStageError
                        ? (thrown.cause as any)
                        : thrown;
                console.error("space errrrrrrrrrrr", err);

                console.error("space err context", {
                    exhibitId: initExhibit?.id,
                    customLink: initExhibit?.info?.customLink,
                    room: initExhibit?.info?.room,
                    destinationSlug: _destination?.slug,
                    destinationGlb: {
                        path: _destination?.path,
                        path_low: _destination?.path_low,
                        path_mid: _destination?.path_mid,
                        path_high: _destination?.path_high,
                        paths: _destination?.paths,
                    },
                    storageVersion: initExhibit?.storageVersion,
                    portalsCount: Object.keys(initExhibit?.portals || {})
                        .length,
                    artworksCount: Object.keys(initExhibit?.artworks || {})
                        .length,
                    hasKitbash: initExhibit?.hasKitbash,
                    editMode,
                    mode,
                    isUploader,
                    query: router?.query,
                    errStack: err?.stack?.split?.("\n")?.slice(0, 15),
                });

                world.current.pause();

                // A plain title and sentence for the visitor; the technical
                // text stays behind "Show details".
                const failure = describeFailure(thrown);
                const { kind, details } = failure;
                let { title, message } = failure;
                // The engine's own explanations of a rejected model, as the
                // uploader dialog has always shown them.
                const errDesc = ErrorMessages[err?.code];
                if (err?.code && errDesc) {
                    title = errDesc.title || title;
                    message = errDesc.message;
                }

                finishSpaceEntrance();
                finishWorldTravel();
                failLobbyDestination(message);
                setWorldState(ErrorState(message, { kind, title, details }));

                // The error screen already says it; hosts without that
                // screen (uploader, studio) only have the dialog.
                if (!hasErrorScreen) showError(message, title);
            }
        }

        const session = legacySceneSessions.acquire(async (sessionSignal) => {
            signal = sessionSignal;
            markLoad("session-start");
            await yieldLobbyLoadingWork({ signal, force: true });
            world.current = await World.getInstance({});
            markLoad("engine-ready");
            if (process.env.NODE_ENV === "development") console.info("[Scene session] enter " + JSON.stringify({ exhibitId: initExhibit.id, document: performance.timeOrigin }));
            checkpoint();
            // The world chunk has run, so the bake code may load now rather
            // than after the avatar parses. A failure resurfaces in the load.
            void world.current.prepareAvatarBaking().catch(() => {});
            legacyGpuResources.begin();
            await yieldLobbyLoadingWork({ signal, force: true });
            await Loader.beginSession(signal);
            markLoad("loaders-ready");
            checkpoint();
            canvasContainer.current.replaceChildren(CANVAS);
            resizeTimer = setTimeout(resize, 0);
            window.addEventListener("click", interact, { once: true });
            setWorldState(LoadingEndState);
            window.top?.postMessage("cyber-scene-loaded", "*");
            await effect();
        }, async () => {
            clearTimeout(resizeTimer);
            window.removeEventListener("click", interact);
            window.removeEventListener("resize", resize);
            const safely = async (release) => {
                try { await release(); } catch (error) { console.error("Scene cleanup failed", error); }
            };
            try {
                if (typeof disposeMultiplayer === "function") {
                    try { await disposeMultiplayer(); } catch (error) { console.error("Multiplayer cleanup failed", error); }
                }
                if (pendingSpace && !attachedSpace) {
                    await safely(() => pendingSpace.scene?.dispose?.());
                    await safely(() => pendingSpace.scene?.lighting?.dispose?.());
                    await safely(() => pendingSpace.kitbash?.dispose?.());
                }
                await world.current?.setState(APP_STATES.EXIT, {});
            } finally {
                await safely(() => world.current?.pause());
                if (world.current) {
                    const { default: Root } = await import("@3gl/root");
                    await safely(() => Root.releasePlayer());
                }
                await safely(() => ImageCache.evictAll());
                await safely(() => Loader.endSession());
                legacyGpuResources.end();
                if (process.env.NODE_ENV === "development" && world.current) {
                    const [{ default: renderer }, { default: Root }, { default: WorkerPool }] = await Promise.all([
                        import("@3renderer"), import("@3gl/root"), import("@3utils/workerpool")
                    ]);
                    console.info("[Scene session] released " + JSON.stringify({
                        document: performance.timeOrigin,
                        scene: !!Root.currentSpace,
                        player: !!Root.mainPlayer,
                        workers: WorkerPool.activeWorkerCount,
                        geometries: renderer.info.memory.geometries,
                        textures: renderer.info.memory.textures,
                    }));
                }
                CANVAS?.remove();
                pendingSpace = null;
                delete (window as any).$exhibit;
                delete (window as any).$roomParamaters;
            }
        });
        void session.done.catch((error) => {
            load.cancel();
            if (mounted) {
                // Only starting the engine fails here; the load catches its own.
                const { kind, title, message, details } =
                    describeFailure(error);
                finishSpaceEntrance();
                finishWorldTravel();
                failLobbyDestination(message);
                setWorldState(ErrorState(message, { kind, title, details }));
                if (!hasErrorScreen) showError(message, title);
            }
            console.error("Scene session failed", error);
        });
        return () => {
            clearTimeout(resizeTimer);
            window.removeEventListener("click", interact);
            window.removeEventListener("resize", resize);
            mounted = false;
            load.cancel();
            void session.release().catch(() => {});
        };
    }, [initExhibit.id, initExhibit.info?.room, _destination?.slug, token, isAnonymous]);
    //#endregion

    //#region callbacks

    function resize() {
        const w = canvasContainer.current?.clientWidth;
        const h = canvasContainer.current?.clientHeight;
        if (world?.current && w > 0 && h > 0) {
            world.current.resize({ w, h });
        }
    }

    //#endregion

    return (
        <Container
            isDisplayed={isDisplayed}
            ref={sceneContainer}
            id="exhibit"
            style={style}
        >
            <CanvasContainer
                style={styleCanvas}
                isSceneBackground={isSceneBackground}
                ref={canvasContainer}
            />

            {children ? children({ worldState, sceneContainer }) : null}
        </Container>
    );
}

export function Scene3D(props) {
    const sceneLoadedRef = useRef(false);

    return (
        <VrmProvider isSceneLoaded={sceneLoadedRef} vrmUrl={props?.vrmUrl}>
            <Scene3D_Child {...props} sceneLoadedRef={sceneLoadedRef} />
        </VrmProvider>
    );
}

const Container = styled.div<{ isDisplayed?: boolean }>`
    height: 100%;
    width: 100%;
    position: relative;
    display: flex;
    background-color: black;

    overflow: hidden;

    ::backdrop {
        background-color: rgb(255 0 0 / 0%);
    }

    :fullscreen {
        background-color: rgba(255, 255, 255, 0);
    }
    :-webkit-full-screen {
        background-color: rgba(255, 255, 255, 0);
    }
    :-moz-full-screen {
        background-color: rgba(255, 255, 255, 0);
    }

    & .loading-title {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgb(20 20 20 / 30%);
        z-index: 10;
        margin: 0;
        padding: 1rem;
    }

    ${(props) =>
        !props.isDisplayed &&
        css`
            display: none;
        `}
`;

const CanvasContainer = styled.div<{ isSceneBackground?: boolean }>`
    outline: none;
    position: absolute;
    width: 100%;
    height: 100%;

    &.css-interact .css3d {
        pointer-events: auto;
    }
`;
