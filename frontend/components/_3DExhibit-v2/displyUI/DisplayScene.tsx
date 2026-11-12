import { replaceExperienceLocation } from "@utils/experienceLocation";
import { showError } from "@components/Dialogs";
import { beginWorldTravel, finishWorldTravel, pendingWorldTravel, WORLD_TRAVEL_READY, yieldWorldTravelWork } from "@utils/nativeWorldTravel";
import { yieldLobbyLoadingWork } from "@utils/lobbyLoadingBudget";
import { markNativeStartup } from "@utils/nativeStartupDiagnostics";
import { prepareNativeEntry } from "@utils/prepareNativeEntry";
import { NATIVE_CAMERA_PREFERENCE_EVENT, readNativeCameraPreference } from "@utils/nativeCameraPreference";
import { type LobbyDestinationEntryOptions } from "@features/lobby/lobbyJourneyProtocol";
import {
    isLobbyDestinationPreparing, registerLobbyDestinationEntry, publishLobbyDestinationLocation,
} from "@utils/lobbyDestinationBridge";
import { registerExperienceDeparture } from "@utils/experienceNavigation";
import SocialApi from "@api/social/_api";
import React, { useContext, useEffect, useRef, useState, useMemo } from "react";

import World from "@3gl/api";

import Events from "@3events";

import {
    APP_STATES,
    CANVAS,
    CINEMATIC,
    CSS_CANVAS,
    CURRENT_STATE,
    DEBUG,
    IS_DEBUG_VIEW,
    IS_DESKTOP,
    IS_FIRST_PERSON,
    IS_MOBILE,
    IS_MULTIPLAYER,
    IS_MULTIPLAYER_ENABLED,
    IS_POINTER_LOCK,
    IS_VR,
    IS_VR_URL,
    SET_EDIT_MODE,
    USER_INTERACTED,
    VIEW,
    FLY_MODE_LERP,
    FLY_SPEED,
} from "@3constants";

import conf from "@3gl/utils/params";

import { isLandscape as _isLandscape } from "@3utils/platform";

import { Scene3D } from "./Scene3D";

import MultiplayerProvider, {
    KICK_COMMAND,
    useMultiplayer,
} from "../context/MultiplayerProvider";

import { WorldProvider } from "../context/WorldProvider";

import Menu from "@3ui/Menu";

import MobileControls from "@3ui/MobileControls";

import dynamic from "next/dynamic";

const HelpModal = dynamic(() => import("@components/_3DExhibit-v2/ui/Help"));

const ControlPanel = dynamic(() => import("../ui/ControlPanel"));

// The cinematic debug panel (?cinematic): its GUI model, TweakPane and the
// colour picker load only in that mode, not for every visitor.
const CinematicTweakPane = dynamic(() =>
    Promise.all([
        import("@3gl/globals/customGui"),
        import("@components/_3DExhibit-v2/ui/TweakPane"),
    ]).then(([{ cinematicGUI }, { TweakPane }]) => {
        const CinematicPanel = () => <TweakPane {...cinematicGUI} />;
        return CinematicPanel;
    })
);

const EditWorldMenu = dynamic(() => import("@features/studio/EditWorldMenu"), {
    ssr: false,
});

import useModal from "@components/modals/useModal";

import { formatLocation, icaseEq } from "@utils/js";
import { bindArtworkHover } from "@utils/artworks/hoverInput";

import {
    TOGGLE_NAVIGATION,
    ALERT_BETA_SPACE,
    UserContext,
} from "@components/context/UserContext";

import { useRouter } from "next/router";

import { IS_FLY } from "../three/camera/constants";

import { useEventCallback } from "@components/hooks/useEventCallback";

import { useWorld } from "../hooks/useWorld";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import { Experience } from "@uitypes/experience";

import { useGatingError } from "@components/context/GatingErrorContext";

import FeedProvider from "@components/context/FeedContext";

import SpaceError from "../ui/Error";

import AlgoliaProvider from "@utils/algolia/AlgoliaProvider";

import { E_INFO_BREAKPOINT } from "../constants";
import { useWorldState } from "../hooks/useWorldState";
import {
    ExhibitProvider,
    ReadOnlyExhibitProvider,
    useCurrentExhibit,
} from "@features/studio/context/ExhibitContext";
import { ExhibitEditorProvider } from "@features/studio/context/ExhibitEditorContext";
import { useHotkey } from "@components/hooks/useHotkey";
import { useDialogTheme } from "@components/Dialogs";
import { soloDefaultSpaces } from "../utils/constants";
import {
    worldPasswordChanged,
    worldPasswordRevision,
} from "@utils/worldPassword/publicGating";

const streamSrc =
    "https://streams.radiomast.io/3141bec2-4886-4b4e-bf17-bf849885bb45";

function getExhibitSlug(exhibit: Experience) {
    return exhibit?.info?.customLink || `s@${exhibit.id}`;
}

function Exhibit3DDisplay_Child(props) {
    //
    const router = useRouter();

    const {
        dispatch,
        user,
        userData,
        // changeScenePlayerMode,
        // // sceneModePlayer,
    } = useContext(UserContext);

    useDialogTheme("dark");

    const {
        chat,
        changeMode,
        mode,
        dispose: disposeMultiplayer,
        switchRoom,
        userId,
        room,
    } = useMultiplayer();

    const { isMod } = room;

    const { isTyping, setIsTyping } = chat;

    const world = useWorld();

    const worldState = useWorldState();

    const hasVisited = useRef(false);

    const [isSceneLoaded, setSceneLoaded] = useState(false);

    const [isInteractionVisible, toggleIntercation] = useState(false);

    const { isShowing: isShowingHelp, toggle: toggleHelp } = useModal();

    const { gatingError, isChecking } = useGatingError();

    const [mobileViewState, setMobileViewState] = useState({
        type: "NO_TUTORIAL",
    });

    const [isPlaying, setIsPlaying] = useState(false);

    const [isInfoSectionVisible, toggleInfoSection] = useState(false);

    const [isDisablePlay, setDisablePlay] = useState(false);

    const [isPointerlock, setIsPointerlock] = useState(false);

    const [isExtaMenuVisible, toggleExtraMenu] = useState(false);

    const [isFlyModeChatDisplayed, setIsFlyModeChatDisplayed] = useState(false);

    const [mobileEmote, setMobileEmote] = useState([]);

    const [isAnimateArtworkInfoBulle, setIsAnimateArtworkInfoBulle] =
        useState(false);

    const [hasBackPortal, setHasBackPortal] = useState(false);
    const { exhibit, setExhibit } = useCurrentExhibit();
    const [destination, setDestination] = useState(props?.destination);

    const [currentArtwork, setCurrentArtwork] = useState(null);
    const [isElevatorLabelHovered, setElevatorLabelHovered] = useState(null);
    const [isArtworkInfoShown, setIsArtworkInfoShown] = useState(false);
    const [isArtInfoTransition, setIsArtInfoTransition] = useState(false);
    const [wasThirdPersonBeforeTrans, setWasThirdPersonBeforeTrans] =
        useState(false);
    const [isLandscape, setLandscape] = useState(_isLandscape());

    const [isCSSInteracting, setIsCSSInteracting] = useState(false);

    const [isMobileChatDisplayed, setIsMobileChatDisplayed] = useState(false);

    const joystickMovingRef = useRef(false);

    const joystickContainerRef = useRef(null);

    const [settings, setSettings] = useState({
        avatar: "VRM",
        quality: "high",
        joystick: "left",
        adjustCamera: "auto",
        fly_mode_show_chat: true,
        fly_mode_show_username: true,
        ...userData?.settings,
        camera: readNativeCameraPreference(userData?.settings?.camera),
    });
    // Until the visitor picks a quality, the settings panel shows the one
    // the engine chose for this device (phones run at medium), not "high".
    useEffect(() => {
        if (!worldState.hasSpace || userData?.settings?.quality) return;
        const running = world.current?.getQuality?.();
        if (running) setSettings((state) => (state.quality === running ? state : { ...state, quality: running }));
    }, [worldState.hasSpace, userData?.settings?.quality]);
    useEffect(() => {
        const syncCameraPreference = () => setSettings((state) => ({ ...state, camera: readNativeCameraPreference(state.camera) }));
        syncCameraPreference();
        window.addEventListener(NATIVE_CAMERA_PREFERENCE_EVENT, syncCameraPreference);
        return () => window.removeEventListener(NATIVE_CAMERA_PREFERENCE_EVENT, syncCameraPreference);
    }, []);

    const audioRef = useRef(null);

    const isStreamPlaying = useRef(false);

    const streamInterval = useRef(null);

    const [isModeMenuOpen, setModeMenuOpen] = useState(false);

    const [wasInVR, setWasInVR] = useState(false);

    if (IS_MOBILE && mode === "solo" && isMobileChatDisplayed) {
        setIsMobileChatDisplayed(false);
    }

    function onInitSpace(destination) {
        if (props.destination !== destination) {
            setDestination(destination);
        }

        const shouldEnterSolo = soloDefaultSpaces.includes(destination?.slug);

        if (
            IS_MULTIPLAYER_ENABLED(destination) &&
            !gatingError &&
            !shouldEnterSolo &&
            !isLobbyDestinationPreparing() && !pendingWorldTravel()
        ) {
            changeMode("multiplayer");
        }

        if (destination?.name === "6529hub") {
            document.cookie = `${
                destination?.name
            }_visited=${new Date().toISOString()}`;
        }

        // The world is loaded and showing: the page may now start work that
        // must not compete with the load (portal previews).
        try {
            props.onWorldRendered?.(destination);
        } catch (error) {
            console.error(error);
        }
    }

    const [worldMode, setWorldMode] = useState("display");
    useEffect(() => {
        if (!isSceneLoaded || worldMode !== "display" || isLobbyDestinationPreparing() || pendingWorldTravel() || !world.current) return;
        const mode = readNativeCameraPreference(settings.camera);
        if ((mode === "first_person") !== IS_FIRST_PERSON)
            void world.current.setThirdPerson({ enabled: mode === "third_person" });
    }, [isSceneLoaded, destination?.id, worldMode]);
    const isSwitchingMode = useRef(false);
    const was3rdPerson = useRef(false);

    const [canEdit, setCanEdit] = useState(false);

    useEffect(() => {
        const _canEdit =
            props.enableEditor &&
            (exhibit.editors.some((ed) => icaseEq(ed, user?.id)) ||
                exhibit?.params?.editionAllowed);
        setCanEdit(_canEdit);
        if (!_canEdit && worldMode === "edit") switchMode("display");
    }, [
        props.enableEditor,
        exhibit?.params?.editionAllowed,
        exhibit?.editors,
        user?.id,
    ]);

    const switchMode = useEventCallback(async (mode: "edit" | "display") => {
        //
        if (
            IS_VR ||
            IS_MOBILE ||
            isArtworkInfoShown ||
            !canEdit ||
            isSwitchingMode.current ||
            CURRENT_STATE !== APP_STATES.SPACE
        )
            return;

        try {
            //
            isSwitchingMode.current = true;

            if (mode === "edit") {
                //
                if (IS_MULTIPLAYER && !IS_FIRST_PERSON) {
                    //
                    was3rdPerson.current = true;

                    // await world.current.setThirdPerson({ enabled: false });
                }
            }

            await world.current.setState(APP_STATES.SPACE, { switch: mode });

            if (mode === "edit") {
                //
                exitPointerLock();

                exitInteractiveMode();
                //
            } else {
                //
                if (was3rdPerson.current) {
                    //
                    await world.current.setThirdPerson({ enabled: true });

                    was3rdPerson.current = false;
                }

                if (CSS_CANVAS) {
                    enterInteractiveMode();
                }
            }

            setWorldMode(mode);
        } finally {
            //
            isSwitchingMode.current = false;
        }
    }, []);

    useHotkey((e) => {
        //

        if (props.enableEditor && !e.repeat && e.shiftKey && e.key === "K") {
            //
            e.preventDefault();

            if (worldMode === "display" && !user.id) {
                return;
            }

            switchMode(worldMode === "display" ? "edit" : "display");
        }
    });

    useEffect(() => {
        if (!IS_MULTIPLAYER_ENABLED(exhibit)) changeMode("solo");
    }, [exhibit?.params?.soloExperience]);

    useEffect(() => {
        //
        const storedEmotes = JSON.parse(
            localStorage.getItem("wheel_dance") || "[]"
        );
        if (storedEmotes) {
            setMobileEmote(storedEmotes);
        }
    }, []);

    useEffect(() => {
        if (destination && destination?.status !== "active") {
            dispatch({
                type: ALERT_BETA_SPACE,
                payload: {
                    isSpaceBeta: true,
                },
            });
        }
    }, [destination]);

    useEffect(() => {
        function is_landscape() {
            return window.innerWidth > window.innerHeight;
        }

        function handleChange(e) {
            if (!is_landscape() && isArtworkInfoShown) {
                toggleArtworkInfo(false);
            }
        }

        window.addEventListener("orientationchange", handleChange);

        return () => {
            window.removeEventListener("orientationchange", handleChange);
        };
    }, [isArtworkInfoShown]);

    // Exhibits carry the password's revision, never the password itself.
    const passwordChanged = worldPasswordChanged(
        props?.exhibit?.gating,
        exhibit?.gating
    );
    const newExhibitGating = worldPasswordRevision(exhibit?.gating);

    useEffect(() => {
        //

        if (!isPlaying) return;

        if (userId && !isMod && passwordChanged) {
            // kick users
            disposeMultiplayer();
        }
    }, [passwordChanged, newExhibitGating, isPlaying, userId, isMod]);

    //#region event handlers
    // IMPORTANT: following callbacks to be invoked from outside React
    //            thus we can safely use useEventCallback
    const handlePointerLockChange = useEventCallback(() => {
        //
        const isPointerlock = IS_POINTER_LOCK();

        setIsPointerlock(isPointerlock);

        if (worldMode === "edit") return;

        if (!isPointerlock) {
            if (!DEBUG) {
                if (IS_DESKTOP) {
                    setDisablePlay(true);

                    setTimeout(() => {
                        setDisablePlay(false);
                    }, 1250);
                }

                if (!isShowingHelp && !isArtworkInfoShown) {
                    if (CSS_CANVAS) {
                        enterInteractiveMode();
                    } else if (!IS_MULTIPLAYER) {
                        // pause(); // Is interactive
                    }

                    // if (IS_MULTIPLAYER && !isTyping) {
                    //     setIsTyping(true);
                    // }
                }
            } else {
                setIsPlaying(false);
            }
        } else {
            if (CSS_CANVAS) {
                exitInteractiveMode();
            }
        }
    }, []);

    const handleMouseDown = useEventCallback(() => {
        //
        if (worldMode === "edit") return;

        if (IS_MOBILE && IS_MULTIPLAYER && isMobileChatDisplayed) {
            setIsMobileChatDisplayed(false);
            return;
        }

        if (
            IS_DESKTOP &&
            isPlaying &&
            !IS_POINTER_LOCK() &&
            CURRENT_STATE !== APP_STATES.EXPOSITION &&
            !isElevatorLabelHovered
        ) {
            return enterPointerLock();
        }

        if (!DEBUG) return;

        if (CURRENT_STATE == APP_STATES.CINEMATIC) {
            return;
        }

        if (isPlaying) return;

        if (!IS_POINTER_LOCK() && !IS_FLY && !IS_DEBUG_VIEW && !IS_MOBILE) {
            play();
        }
    }, []);

    const isFlyMode = useRef(false);

    useHotkey(async (e) => {
        //
        if (!isPlaying) return;

        if (
            IS_MULTIPLAYER &&
            (e.key === "Escape" || e.key === "Enter") &&
            isPointerlock
        ) {
            e.preventDefault();
            setIsTyping(true);
            chat.setIsChatDisplayed(true);
            document.exitPointerLock();
            return;
        }

        if (props.isScreenshotMode && e.key === "c") {
            world.current.takeScreenshot();
        }

        if (isPointerlock && (e.key === "h" || e.key === "H")) {
            toggleHelp();

            if (!isShowingHelp) {
                document.exitPointerLock();
            } else {
                enterPointerLock();
            }

            return;
        }

        if (e.key === "x" || e.key === "X") {
            //

            handleFlyMode();
        }
    });

    // const handleToggleMode = useEventCallback(, []);

    const handleResize = useEventCallback(() => {
        setLandscape(_isLandscape());
    }, []);

    const registerWorldEventHandlers = (isDispose = false) => {
        if (world.current) {
            world.current.setEventListener(
                Events.TRANSITION,
                isDispose ? null : handleMobileTransition
            );

            world.current.setEventListener(
                Events.PANORAMA_OPENING,
                isDispose
                    ? null
                    : (opts) => {
                          world.current.setState(APP_STATES.PANORAMA, opts);
                      }
            );

            world.current.setEventListener(
                Events.PANORAMA_CLOSING,
                isDispose
                    ? null
                    : (opts) => {
                          world.current.setState(APP_STATES.SPACE, opts);
                      }
            );

            world.current.setEventListener(
                Events.CURRENT_ARTWORK_CHANGED,
                isDispose ? null : handleCurrentArtworkChanged
            );

            world.current.setEventListener(
                Events.CURRENT_LABEL_HOVERED,
                isDispose ? null : handleLabelHovered
            );

            world.current.setEventListener(
                Events.PORTAL_TELEPORT_REQUEST,
                isDispose ? null : handleTeleportRequest
            );

            world.current.setEventListener(
                Events.PORTAL_OPENED,
                isDispose ? null : handleOpenedPortal
            );

            // VR session
            world.current.setEventListener(
                Events.VR_SESSION_START,
                isDispose ? null : handleEnterVR
            );

            world.current.setEventListener(
                Events.VR_SESSION_END,
                isDispose ? null : handleExitVR
            );

            world.current.setEventListener(
                Events.PLAYER_LOCATION_CHANGED,
                isDispose ? null : handlePlayerLocationChanged
            );
        }
    };
    //#endregion

    //#region effects
    useEffect(() => {
        window.addEventListener("beforeunload", disposeMultiplayer);

        return () => {
            // Session teardown releases the engine; the provider closes network services.
            window.removeEventListener("beforeunload", disposeMultiplayer);
        };
    }, []);

    useEffect(() => {
        if (!props.isDisplayed) {
            pause();
        }
    }, [props.isDisplayed]);

    useEffect(() => {
        if (!CINEMATIC) {
            registerWorldEventHandlers();

            return () => {
                registerWorldEventHandlers(true);
            };
        }
    }, [CINEMATIC, registerWorldEventHandlers]);

    useEffect(() => {
        if (CANVAS) {
            if (IS_DESKTOP) {
                CANVAS.addEventListener("mousedown", handleMouseDown);
            }

            if (IS_MOBILE) {
                CANVAS.addEventListener("touchend", handleMouseDown);
            }

            document.addEventListener(
                Events.POINTER_LOCK,
                handlePointerLockChange
            );

            document.addEventListener(Events.RESIZE, handleResize);

            return () => {
                if (IS_MOBILE) {
                    CANVAS.removeEventListener("touchend", handleMouseDown);
                }

                if (IS_DESKTOP) {
                    CANVAS.removeEventListener("mousedown", handleMouseDown);
                }

                document.removeEventListener(
                    Events.POINTER_LOCK,
                    handlePointerLockChange
                );

                document.removeEventListener(Events.RESIZE, handleResize);
            };
        }
    }, [
        CANVAS,
        IS_DESKTOP,
        IS_MOBILE,
        handleMouseDown,
        handlePointerLockChange,
        handleResize,
    ]);
    //#endregion

    const enterPointerLock = () => {
        if (
            IS_DESKTOP &&
            !IS_MOBILE &&
            CURRENT_STATE !== APP_STATES.EXPOSITION
        ) {
            // setTimeout of 1250 for it to work every time
            // Embedded browsers can reject pointer lock. Free-cursor controls
            // remain usable; a rejected request must not escape as a page error.
            if (!CANVAS?.isConnected) return;
            try {
                const request = (CANVAS as any).requestPointerLock?.();
                request?.catch?.(() => {});
            } catch {
                // Older implementations may throw synchronously.
            }
        }
    };

    const exitPointerLock = () => {
        if (IS_DESKTOP && !DEBUG && !IS_MOBILE) {
            // setTimeout of 1250 for it to work every time
            document.exitPointerLock();
        }
    };

    const handleCssMouseDown = useEventCallback((e) => {
        //
        if (e.target === CSS_CANVAS) {
            handleMouseDown();
        }
    }, []);

    const handleFlyMode = async () => {
        await world.current.setFlyMode({
            enabled: !isFlyMode.current,
        });

        isFlyMode.current = !isFlyMode.current;

        if (isFlyMode.current) {
            //
            const conf = {
                lerp: settings?.fly_mode_stabilization,
                chat: settings?.fly_mode_show_chat ?? true,
                moveSpeed: FLY_SPEED[settings?.fly_mode_speed],
                username: settings.fly_mode_show_username ?? true,
            };

            setIsFlyModeChatDisplayed(conf.chat);

            if (conf?.moveSpeed) {
                world.current.setFlyModeSpeed(conf.moveSpeed);
            }

            if (conf?.lerp) {
                world.current.setStabilization(conf.lerp);
            }

            await world.current.setShowUsername(conf.username);
        }

        if (!isFlyMode.current) {
            setIsFlyModeChatDisplayed(true);
            await world.current.setShowUsername(true);
        }
    };

    useEffect(() => {
        if (!isCSSInteracting || !CSS_CANVAS) return;
        const overlay = CSS_CANVAS;
        overlay.addEventListener("mousedown", handleCssMouseDown);
        const cleanupHover = IS_DESKTOP
            ? bindArtworkHover(overlay, CANVAS)
            : () => {};
        return () => {
            overlay.removeEventListener("mousedown", handleCssMouseDown);
            cleanupHover();
        };
    }, [isCSSInteracting, CSS_CANVAS, CANVAS, handleCssMouseDown]);

    const enterInteractiveMode = () => {
        //
        if (
            CSS_CANVAS?.style.visibility === "hidden" ||
            CSS_CANVAS?.style.display === "none"
        ) {
            return;
        }
        console.log("enter interactive mode");
        CANVAS.style.pointerEvents = "none";

        CSS_CANVAS.parentElement?.classList.toggle("css-interact", true);

        setIsCSSInteracting(true);
    };

    const exitInteractiveMode = () => {
        //
        console.log("exit interactive mode");
        CANVAS.style.pointerEvents = "";

        CSS_CANVAS.parentElement?.classList.toggle("css-interact", false);

        setIsCSSInteracting(false);
    };

    const play = async (shouldEnterVR = false) => {
        if (!world.current || isPlaying) return;

        dispatch({
            type: TOGGLE_NAVIGATION,
            payload: {
                isNavHidden: props.isNavHidden || true,
            },
        });

        if (!shouldEnterVR && worldMode === "display") {
            // setTimeout of 1250 for it to work every time
            enterPointerLock();
        }

        world.current.play(shouldEnterVR);

        setIsPlaying(true);
    };

    const nativeArrival = useRef<ReturnType<typeof import("../three/utils/lobbyWorldReveal").createNativeLobbyReveal> | ReturnType<typeof import("../three/utils/nativeProfilePortal").createNativeProfilePortal> | null>(null);
    const nativeDeparture = useRef<ReturnType<typeof import("../three/utils/lobbyWorldDeparture").createNativeLobbyDeparture> | null>(null);
    const nativeArrivalGeneration = useRef(0);
    const nativeConnectionAbort = useRef<AbortController | null>(null);
    // A frame prepared in the lobby asks for access while its scene builds,
    // so entry does not wait for the server after the scene is ready.
    const earlyAdmission = useRef<{ slug: string; at: number; answer: Promise<any> } | null>(null);
    const exhibitSlug = exhibit ? getExhibitSlug(exhibit) : null;
    useEffect(() => {
        if (!exhibitSlug || !isLobbyDestinationPreparing()) return;
        const answer = Promise.resolve(SocialApi.opts({ encode: true }).checkGating({ spaceId: exhibitSlug, nbPlayers: 0 }));
        void answer.catch(() => {});
        earlyAdmission.current = { slug: exhibitSlug, at: performance.now(), answer };
    }, [exhibitSlug]);
    const enterFromLobby = useEventCallback(async (options: LobbyDestinationEntryOptions) => {
        markNativeStartup("native-entry-start");
        const generation = ++nativeArrivalGeneration.current;
        nativeConnectionAbort.current?.abort();
        const connectionAbort = new AbortController();
        nativeConnectionAbort.current = connectionAbort;
        const checkpoint = () => {
            if (nativeArrivalGeneration.current !== generation || connectionAbort.signal.aborted)
                throw new Error("Arrival cancelled.");
        };
        if (!world.current || !worldState.hasSpace || gatingError) {
            throw new Error("This world is no longer available. Open it to check access.");
        }
        // The engine is ready: fetch the entrance module while access and room
        // admission run, rather than adding another chunk wait after joining.
        const revealModule = import("../three/utils/nativeLobbyTransitions").then((module) => {
            markNativeStartup("native-reveal-module-ready");
            return module;
        });
        // Access/cancellation may fail before this promise is consumed.
        void revealModule.catch(() => {});
        // Always ask the server during this trip, even if the prepared copy had
        // no gate. The answer is awaited before multiplayer and "entered".
        // An answer asked for during this preparation (within 30s) is used;
        // anything older is asked again.
        const spaceId = getExhibitSlug(exhibit);
        const early = earlyAdmission.current;
        earlyAdmission.current = null;
        const admission = early && early.slug === spaceId && performance.now() - early.at < 30_000
            ? early.answer
            : Promise.resolve(SocialApi.opts({ encode: true }).checkGating({ spaceId, nbPlayers: 0 }));
        const admitted = admission.then((admission) => {
            checkpoint();
            markNativeStartup("native-admission-ready");
            if (admission.type !== "success") {
                throw new Error("Access to this world has changed. Open it to check access.");
            }
        });
        // Rejection is observed at the awaits below (or after cancellation).
        void admitted.catch(() => {});
        const needsMultiplayer = IS_MULTIPLAYER_ENABLED(destination) &&
            !soloDefaultSpaces.includes(destination?.slug);
        await world.current.play(false);
        checkpoint();
        // Social/group continuity belongs to the host. Only scene readiness
        // gates arrival; room coordinates, chat and voice can attach afterward.
        await prepareNativeEntry(async (signal) => {
            if (!needsMultiplayer) return true;
            await admitted;
            return changeMode("multiplayer", { signal, background: true });
        }, async () => {
            const { createNativeLobbyRevealInSlices } = await revealModule;
            checkpoint();
            nativeArrival.current?.dispose();
            nativeArrival.current = null;
            // Partitioning the room into tiles takes hundreds of milliseconds;
            // slice it so the lobby's loading animation keeps its frames.
            const arrival = options.portalView
                ? (await import("../three/utils/nativeProfilePortal")).createNativeProfilePortal(world.current)
                : await createNativeLobbyRevealInSlices(world.current, () => pendingWorldTravel() ? yieldWorldTravelWork() : yieldLobbyLoadingWork());
            try {
                checkpoint();
            } catch (error) {
                arrival.dispose();
                throw error;
            }
            nativeArrival.current = arrival;
            await nativeArrival.current.prepare(options);
            checkpoint();
            markNativeStartup("native-reveal-ready");
            // A refused or failed admission rejects here, so the staged
            // arrival is disposed by the caller like any failed entry.
            await admitted;
            checkpoint();
        }, {
            signal: connectionAbort.signal,
            onConnectionState: (state) => {
                if (nativeArrivalGeneration.current !== generation) return;
                markNativeStartup(state === "connected" ? "native-room-ready" : `native-room-${state}`);
            },
        });
        checkpoint();
        dispatch({ type: TOGGLE_NAVIGATION, payload: { isNavHidden: true } });
        setIsPlaying(true);
        // No pointer-lock request: this is a postMessage, not a trusted click.
        // The first click in the revealed space can acquire pointer lock/audio.
    }, []);
    const stageLobbyReveal = useEventCallback(async (options: LobbyDestinationEntryOptions) => {
        if (!nativeArrival.current) throw new Error("The world is not ready for arrival.");
        await nativeArrival.current.prepare(options);
    }, []);
    const revealFromLobby = useEventCallback(async (options: LobbyDestinationEntryOptions) => {
        if (!nativeArrival.current) throw new Error("The world is not ready for arrival.");
        markNativeStartup("native-reveal-start");
        await nativeArrival.current.reveal(options);
        const coords = world.current?.getCurrentCoords({});
        if (coords) updateURLState({ scope: "location", opts: { location: formatLocation(coords.position, coords.rotation.y) } });
        markNativeStartup("native-revealed");
        world.current?.startRoomTextureUpgrade();
    }, []);
    const restoreNativeDeparture = useEventCallback(() => {
        nativeDeparture.current?.dispose();
        nativeDeparture.current = null;
    }, []);
    const departNativeWorld = useEventCallback(async (options: LobbyDestinationEntryOptions) => {
        if (!world.current) throw new Error("The world is not ready for departure.");
        const generation = ++nativeArrivalGeneration.current;
        world.current.stopRoomTextureUpgrade();
        nativeConnectionAbort.current?.abort();
        nativeArrival.current?.dispose();
        nativeArrival.current = null;
        const { createNativeLobbyDeparture } = await import("../three/utils/nativeLobbyTransitions");
        if (nativeArrivalGeneration.current !== generation) throw new Error("Departure cancelled.");
        if (!nativeDeparture.current) nativeDeparture.current = createNativeLobbyDeparture(world.current, yieldWorldTravelWork);
        const returnView = await nativeDeparture.current.depart(options);
        if (nativeArrivalGeneration.current !== generation) throw new Error("Departure cancelled.");
        return returnView;
    }, []);
    useEffect(() => {
        const dispose = () => {
            nativeArrivalGeneration.current++;
            nativeConnectionAbort.current?.abort();
            nativeConnectionAbort.current = null;
            world.current?.stopRoomTextureUpgrade();
            restoreNativeDeparture();
            nativeArrival.current?.dispose();
            nativeArrival.current = null;
            void world.current?.pause();
            void disposeMultiplayer();
        };
        const unregister = registerLobbyDestinationEntry(enterFromLobby, dispose, {
            prepareReveal: stageLobbyReveal, reveal: revealFromLobby, depart: departNativeWorld,
            previewPortal: (view) => {
                const arrival = nativeArrival.current;
                if (arrival && "preview" in arrival) arrival.preview(view);
            },
        });
        let departureSource: string | null = null;
        const unregisterDeparture = registerExperienceDeparture(async (options) => {
            departureSource = window.location.href;
            return departNativeWorld(options);
        }, () => {
            // The navigation bridge also calls restore on route completion.
            // Only a cancelled trip that leaves this same source visible should
            // resume optional refinement; cleanup above must never restart it.
            const remainedInSource = departureSource === window.location.href;
            departureSource = null;
            restoreNativeDeparture();
            if (remainedInSource) world.current?.startRoomTextureUpgrade();
        });
        return () => { unregister(); unregisterDeparture(); dispose(); };
    }, [enterFromLobby, stageLobbyReveal, revealFromLobby, departNativeWorld, restoreNativeDeparture]);

    useEffect(() => {
        const arrive = () => {
            const travel = pendingWorldTravel();
            if (!travel?.ready || travel.claimed || !world.current || gatingError) return;
            travel.claimed = true;
            const options = { travelView: travel.view, reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true };
            void (async () => {
                try {
                    await enterFromLobby(options);
                    if (pendingWorldTravel() !== travel) return;
                    // prepare() acknowledges a native rendered frame before the
                    // loading cover is removed. Artworks remain independent.
                    finishWorldTravel(travel);
                    await revealFromLobby(options);
                    publishLobbyDestinationLocation();
                } catch (error) {
                    finishWorldTravel(travel);
                    nativeArrival.current?.dispose();
                    nativeArrival.current = null;
                    showError(error);
                }
            })();
        };
        window.addEventListener(WORLD_TRAVEL_READY, arrive);
        arrive();
        return () => window.removeEventListener(WORLD_TRAVEL_READY, arrive);
    }, [isSceneLoaded, enterFromLobby, revealFromLobby, gatingError]);

    const enterVR = () => {
        world.current.play(true);
    };

    const pause = (exitVR = false) => {
        exitPointerLock();

        if (isTyping) {
            setIsTyping(false);
        }

        dispatch({
            type: TOGGLE_NAVIGATION,
            payload: {
                isNavHidden: false,
            },
        });

        world.current?.pause?.(exitVR);
        setIsPlaying(false);
    };

    const openBackPortal = () => {
        if (!isPlaying) {
            play();
        }

        world.current.openBackPortal();
    };

    const toggleArtworkInfo = async (b?: boolean) => {
        //
        if (!isPlaying && !isArtworkInfoShown) return;

        if (worldMode === "edit") return;

        const shouldHideArtworkInfo = b != null ? !b : isArtworkInfoShown;

        if (shouldHideArtworkInfo !== isArtworkInfoShown) return;

        if (shouldHideArtworkInfo) {
            //

            setIsArtworkInfoShown(false);

            enterPointerLock();

            if (
                VIEW.w >= E_INFO_BREAKPOINT.width &&
                VIEW.h > E_INFO_BREAKPOINT.height
            ) {
                await world.current.setState(APP_STATES.SPACE, {});
            }

            // if (wasThirdPersonBeforeTrans) {
            //     world.current.setThirdPerson({ enabled: true });
            //     setWasThirdPersonBeforeTrans(false);
            // }
            // //
        } else if (currentArtwork) {
            //

            if (
                VIEW.w >= E_INFO_BREAKPOINT.width &&
                VIEW.h >= E_INFO_BREAKPOINT.height
            ) {
                //

                const opts = {
                    target: currentArtwork,
                    lookAtDistance: currentArtwork.maxLookatDistance(),
                    checkCollitions: false,
                    highlight: true,
                };

                setIsArtworkInfoShown(true);
                setIsArtInfoTransition(true);

                // if (IS_MULTIPLAYER && !IS_FIRST_PERSON) {
                //     setWasThirdPersonBeforeTrans(true);
                //     await world.current.setThirdPerson({ enabled: false });
                // }

                if (CURRENT_STATE !== APP_STATES.EXPOSITION) {
                    //
                    await world.current.setState(APP_STATES.TRANSITION, opts);
                }

                setIsArtInfoTransition(false);
                //
            } else {
                setIsArtworkInfoShown(true);
            }

            exitPointerLock();
        }
    };

    //#region 3D World event handlers
    const handleMobileTransition = async (opts) => {
        //
        if (worldMode === "edit") return;

        if (
            IS_MOBILE &&
            opts.action === "transition_action_artwork" &&
            opts.target.userData.spaceItem?.enableCSSInteraction
        ) {
            enterInteractiveMode();
        }

        opts = {
            ...opts,
            checkCollitions: true,
        };

        var wasThirdBeforeTrans = false;

        if (IS_MULTIPLAYER && !IS_FIRST_PERSON) {
            wasThirdBeforeTrans = true;
            // setWasThirdPersonBeforeTrans(true);
            await world.current.setThirdPerson({ enabled: false });
        }

        await world.current.setState(APP_STATES.TRANSITION, opts);

        await world.current.setState(APP_STATES.SPACE, {});

        if (wasThirdBeforeTrans) {
            world.current.setThirdPerson({ enabled: true });
        }
    };

    const handleCurrentArtworkChanged = (opts) => {
        //
        if (IS_MOBILE && opts.currentArtwork?.enableCSSInteraction) {
            // enterInteractiveMode();
        }

        if (process.env.NODE_ENV === "development") {
            (window as any).$$currentArtwork = opts.currentArtwork;
        }

        setCurrentArtwork(opts.currentArtwork);
    };

    function handleOpenedPortal(opts) {
        let portalType = "portal";

        if (opts.source) {
            portalType = "summoned";
        } else if (!opts.backState) {
            portalType = "back-portal";
        }

        const payload: any = {
            tookPortalAt: new Date().toISOString(),
            portalType: portalType,
            portal_source: exhibit.id,
            portal_destination: opts.exhibit.id || "",
            ...world.current.getPlayerData({
                isFirstPerson: true,
            }),
            isElevator: !!opts?.currentLevel,
        };

        if (opts.source) {
            payload.source = opts.source;
        }

        amplitude_logAnalyticsEvent("opened_portal", payload);
    }

    function handleLabelHovered({ isHovered }) {
        setElevatorLabelHovered(isHovered);
    }

    const nativeTeleportInFlight = useRef(false);
    const handleTeleportRequest = async (opts) => {
        if (nativeTeleportInFlight.current) return;
        let portalType = "portal";

        if (opts.source) {
            portalType = "summoned";
        } else if (!opts.backState) {
            portalType = "back-portal";
        }

        const payload: any = {
            tookPortalAt: new Date().toISOString(),
            // sessionId,
            sameSpace: opts.sameSpace === true,
            portalType,
            portal_source: exhibit.id,
            portal_destination: opts.exhibit.id,
            ...world.current.getPlayerData({
                isFirstPerson: true,
            }),
            isElevator: opts?.portal?.isElevator,
        };

        if (opts.source) {
            payload.source = opts.source;
        }
        amplitude_logAnalyticsEvent("entered_portal", payload);

        if (opts.sameSpace) {
            return;
        }

        nativeTeleportInFlight.current = true;

        const options: LobbyDestinationEntryOptions = {
            reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
        };
        let travel: ReturnType<typeof beginWorldTravel>;
        try {
            const view = await departNativeWorld(options);
            options.travelView = view || undefined;
            travel = beginWorldTravel(view, CANVAS);
            // This in-place handoff is owned here, not the route-ready listener.
            travel.claimed = true;
            setCurrentArtwork(null);
            setDestination(opts.roomParameters);
            setExhibit(opts.exhibit);
            setIsArtworkInfoShown(false);
            setHasBackPortal(!!opts.backState);
            await world.current.setState(APP_STATES.TELEPORT, opts);
            await world.current.setState(APP_STATES.SPACE, {});
            restoreNativeDeparture();
            const { createNativeLobbyRevealInSlices } = await import("../three/utils/nativeLobbyTransitions");
            const arrival = await createNativeLobbyRevealInSlices(world.current, yieldWorldTravelWork);
            nativeArrival.current = arrival;
            await world.current.play(false);
            await arrival.prepare(options);
            finishWorldTravel(travel);
            await arrival.reveal(options);
            world.current.startRoomTextureUpgrade();
            updateURLState({ scope: "teleport", opts });
            void Promise.resolve(switchRoom({ exhibit: opts.exhibit, destination: opts.roomParameters })).catch(showError);
        } catch (error) {
            finishWorldTravel(travel);
            restoreNativeDeparture();
            nativeArrival.current?.dispose();
            nativeArrival.current = null;
            showError(error);
        } finally {
            nativeTeleportInFlight.current = false;
        }
    };

    const handlePlayerLocationChanged = ({ position, rotation }) => {
        //
        if (pendingWorldTravel() || nativeDeparture.current || nativeTeleportInFlight.current || isLobbyDestinationPreparing()) return;
        const s = formatLocation(position, rotation);

        // console.log("location changed", s);
        updateURLState({ scope: "location", opts: { location: s } });
    };

    const updateURLState = ({ scope, opts }) => {
        if (scope === "teleport") {
            const { exhibit, from, backState } = opts;
            const slug = getExhibitSlug(exhibit);
            const pathname = router.pathname.toLowerCase() === "/spaces/[id]" || !slug
                ? `/spaces/${exhibit.id}` : `/${slug}`;
            const params = new URLSearchParams(window.location.search);
            params.delete("coords");
            params.delete("from");
            params.delete("at");
            const fromSlug = from?.exhibit?.info?.customLink;
            if (fromSlug && backState) {
                params.set("from", fromSlug);
                params.set("at", formatLocation(backState.backPosition, backState.backRotation._y));
            }
            const coords = world.current?.getCurrentCoords({});
            if (coords) params.set("coords", formatLocation(coords.position, coords.rotation.y));
            const search = params.toString();
            const href = pathname + (search ? `?${search}` : "");
            void router.replace(href, href, { shallow: true }).then(() => publishLobbyDestinationLocation()).catch(showError);
        } else if (scope === "location") {
            const { location } = opts;

            const url = new URL(window.location.href);
            url.searchParams.set("coords", location);
            replaceExperienceLocation(url.pathname + url.search + url.hash);
            publishLobbyDestinationLocation();
        }
    };

    const handleEnterVR = () => {
        setWasInVR(true);
        // setTimeout(() => {
        //     amplitude_logAnalyticsEvent("clicked_launch_vr");
        // }, 500);
    };

    const handleExitVR = () => {
        console.log("VR mode exited");

        pause(true);

        // router.push(router.asPath.split("?")[0]);
        // location.reload();
        // pause();
        // setTimeout(() => {
        //     amplitude_logAnalyticsEvent("clicked_exit_vr");
        // }, 500);
    };

    // #endregion

    const controlsType = IS_VR_URL
        ? "vr"
        : IS_DESKTOP
        ? "desktop" //
        : IS_MOBILE
        ? "mobile" //
        : "unknown";

    const isInteractive =
        !IS_MOBILE &&
        isPlaying &&
        !isPointerlock &&
        !isShowingHelp &&
        !isArtworkInfoShown;

    const isPreviewEmbed = router.query.embedp != null;

    const isChatActive =
        mode === "multiplayer" && isPlaying && worldState.hasSpace;

    return (
        <Scene3D
            {...props}
            destination={destination}
            onInitSpace={onInitSpace}
            setIsPlaying={setIsPlaying}
            setSceneLoaded={setSceneLoaded}
            setHasBackPortal={setHasBackPortal}
            hasErrorScreen
        >
            {({ sceneContainer, worldState: _state }) => {
                //

                if (_state.type === "ERROR") {
                    return <SpaceError worldState={_state} />;
                }

                return (
                    <>
                        {/* {isSpaceBeta && isPlaying && (
                            <Alert>
                                🧪 This space is not yet approved for minting.
                                For details on oncyber's space publishing beta,
                                docs.oncyber.io
                            </Alert>
                        )} */}

                        {/* <StateWrapper>
                            {room.loading ? (
                                <div>
                                    <Spinner width={24} /> Loading
                                    multiplayer...
                                </div>
                            ) : room.active ? (
                                <div>
                                    <IconImg
                                        mode="light"
                                        size={24}
                                        name="check"
                                    />{" "}
                                    Multiplayer loaded
                                </div>
                            ) : (
                                <div>
                                    <IconImg mode="light" size={24} name="x" />{" "}
                                    Multiplayer disposed
                                </div>
                            )}
                            {chat.loading ? (
                                <div>
                                    <Spinner width={24} /> Loading chat...
                                </div>
                            ) : room.active ? (
                                <div>
                                    <IconImg
                                        mode="light"
                                        size={24}
                                        name="check"
                                    />{" "}
                                    Chat loaded
                                </div>
                            ) : (
                                <div>
                                    <IconImg mode="light" size={24} name="x" />{" "}
                                    Chat disposed
                                </div>
                            )}
                            {voice.loading ? (
                                <div>
                                    <Spinner width={24} /> Loading voice...
                                </div>
                            ) : room.active ? (
                                <div>
                                    <IconImg
                                        mode="light"
                                        size={24}
                                        name="check"
                                    />{" "}
                                    Voice loaded
                                </div>
                            ) : (
                                <div>
                                    <IconImg mode="light" size={24} name="x" />{" "}
                                    Voice disposed
                                </div>
                            )}
                        </StateWrapper> */}

                        {IS_MOBILE && (
                            <MobileControls
                                exitInteractiveMode={exitInteractiveMode}
                                isCSSInteracting={isCSSInteracting}
                                pause={pause}
                                isPlaying={isPlaying && !isArtworkInfoShown}
                                isLandscape={isLandscape}
                                hasBackPortal={hasBackPortal}
                                containerRef={sceneContainer}
                                openBackPortal={openBackPortal}
                                isChatIconDisplayed={
                                    isChatActive && chat.isChatDisplayed
                                }
                                artwork={currentArtwork?.userData}
                                isInteractive={isInteractive}
                                activateChat={() =>
                                    setIsMobileChatDisplayed(true)
                                }
                                // @ts-ignore
                                viewState={mobileViewState}
                                setViewState={setMobileViewState}
                                toggleChat={chat.setIsChatDisplayed}
                                isModeMenuOpen={isModeMenuOpen}
                                joystickMovingRef={joystickMovingRef}
                            />
                        )}

                        {!DEBUG && !isPreviewEmbed ? (
                            <ControlPanel
                                user={user}
                                artwork={currentArtwork?.userData}
                                exhibit={exhibit}
                                isHub={props.isHub || hasBackPortal}
                                hasBackPortal={hasBackPortal}
                                isPlaying={isPlaying}
                                enterVR={enterVR}
                                showArtworkInfo={isArtworkInfoShown}
                                isArtInfoTransition={isArtInfoTransition}
                                toggleArtworkInfo={toggleArtworkInfo}
                                isChatActive={isChatActive}
                                mobileViewState={mobileViewState}
                                isInteractive={isInteractive}
                                pause={pause}
                                sceneContainer={sceneContainer}
                                setIsAnimateArtworkInfoBulle={
                                    setIsAnimateArtworkInfoBulle
                                }
                                setMobileViewState={setMobileViewState}
                                isModeMenuOpen={isModeMenuOpen}
                                setModeMenuOpen={setModeMenuOpen}
                                settings={settings}
                                setSettings={setSettings}
                                isMobile={IS_MOBILE}
                                joystickContainerRef={joystickContainerRef}
                                setMobileEmote={setMobileEmote}
                                mobileEmote={mobileEmote}
                                toggleExtraMenu={toggleExtraMenu}
                                isExtaMenuVisible={isExtaMenuVisible}
                                toggleIntercation={toggleIntercation}
                                isInteractionVisible={isInteractionVisible}
                                joystickMovingRef={joystickMovingRef}
                                isFlyMode={isFlyMode}
                                switchMode={switchMode}
                                worldMode={worldMode}
                                onFlyMode={handleFlyMode}
                                setIsFlyModeChatDisplayed={
                                    setIsFlyModeChatDisplayed
                                }
                                isFlyModeChatDisplayed={isFlyModeChatDisplayed}
                                destination={destination}
                            />
                        ) : null}

                        {!DEBUG &&
                            world.current &&
                            canEdit &&
                            worldState.hasSpace &&
                            isPlaying &&
                            !isArtworkInfoShown &&
                            worldMode === "edit" && (
                                <div
                                    style={{
                                        zIndex: 11000,
                                    }}
                                >
                                    <EditWorldMenu />
                                </div>
                            )}

                        {!DEBUG ? (
                            <HelpModal
                                isShowing={isShowingHelp}
                                toggle={() => {
                                    toggleHelp();
                                }}
                            />
                        ) : null}

                        {!DEBUG ? (
                            <Menu
                                settings={settings}
                                isMobile={IS_MOBILE}
                                destination={destination}
                                handleToggleMode={changeMode}
                                isActive={props.isActive}
                                setActive={props.setActive}
                                isHub={props.isHub || hasBackPortal}
                                controlsType={controlsType}
                                play={play}
                                enterVR={enterVR}
                                isDisablePlay={isDisablePlay}
                                isPlaying={isPlaying || isArtworkInfoShown}
                                worldState={_state}
                                isSceneBackground={props.isSceneBackground}
                                exhibit={exhibit}
                                hasBackPortal={hasBackPortal}
                                openBackPortal={openBackPortal}
                                parentPage={props?.parentPage}
                                joystickContainerRef={joystickContainerRef}
                                isSceneLoaded={isSceneLoaded}
                                isExtaMenuVisible={isExtaMenuVisible}
                                isCSSInteracting={isCSSInteracting}
                                isInteractionVisible={isInteractionVisible}
                                isChatDisplayed={
                                    isChatActive && chat.isChatDisplayed
                                }
                                joystickMovingRef={joystickMovingRef}
                                toggleInfoSection={toggleInfoSection}
                                isInfoSectionVisible={isInfoSectionVisible}
                                showArtworkInfo={isArtworkInfoShown}
                                artwork={currentArtwork?.userData}
                            />
                        ) : null}

                        {CINEMATIC && <CinematicTweakPane />}
                    </>
                );
            }}
        </Scene3D>
    );
}

export default function Exhibit3DDisplay(props) {
    const world = useRef<World>(null);

    const vrmUrl = useRef(null);

    if (!props.enableEditor) {
        return (
            <WorldProvider world={world}>
                <ReadOnlyExhibitProvider
                    exhibit={props.exhibit}
                    destination={props.destination}
                >
                    <MultiplayerProvider
                        destination={props.destination}
                        exhibit={props.exhibit}
                        vrmUrl={vrmUrl?.current}
                    >
                        <Exhibit3DDisplay_Child {...props} vrmUrl={vrmUrl} />
                    </MultiplayerProvider>
                </ReadOnlyExhibitProvider>
            </WorldProvider>
        );
    }

    return (
        <WorldProvider world={world}>
            <ExhibitProvider
                exhibit={props.exhibit}
                destination={props.destination}
            >
                <ExhibitEditorProvider>
                    <MultiplayerProvider
                        destination={props.destination}
                        exhibit={props.exhibit}
                        vrmUrl={vrmUrl?.current}
                    >
                        <Exhibit3DDisplay_Child {...props} vrmUrl={vrmUrl} />
                    </MultiplayerProvider>
                </ExhibitEditorProvider>
            </ExhibitProvider>
        </WorldProvider>
    );
}
