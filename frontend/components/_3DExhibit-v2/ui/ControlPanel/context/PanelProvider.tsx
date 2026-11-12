import { Mode } from "./Mode";
import { releaseArtworkFocus } from "../ArtworkInfoBulle/focusArtwork";
import {
    readNativeCameraPreference,
    rememberNativeCameraPreference,
} from "@utils/nativeCameraPreference";
import { isLobbyDestinationPreparing } from "@utils/lobbyDestinationBridge";
import { getDefaultRepo } from "@components/context/AssetsContext";
import { UPDATE_USER_DATA, UserContext } from "@components/context/UserContext";
import { useOwnedAssets } from "@components/hooks/useAssets";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import useModal from "@components/modals/useModal";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import {
    IS_MOBILE,
    IS_FIRST_PERSON,
} from "@components/_3DExhibit-v2/three/constants";
import { Experience } from "@uitypes/experience";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { updateUser } from "@utils/saveToDb";
import {
    createContext,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    Dispatch,
} from "react";
import { useVrm } from "@components/context/VrmContext";
import {
    legacyPanelTab,
    spacePanelTransition,
    type PanelTab,
    type SpacePanel,
    type SpacePanelEvent,
} from "./spacePanelMachine";

export type { PanelTab } from "./spacePanelMachine";

interface PanelContextState {
    exhibit: Experience;
    selectedUser: any;
    setSelectedUser: any;
    spaces: any;
    setSpaces: any;
    loadNfts: any;
    setLoadNfts: any;
    nfts: any;
    otherNfts: any;
    isPlaying: boolean;
    /** The one panel open over the space, dock panels included. */
    spacePanel: SpacePanel;
    dispatchSpacePanel: (event: SpacePanelEvent) => void;
    /** `spacePanel` as older panel code reads it: "" for a dock panel. */
    currentTab: PanelTab;
    setCurrentTab: React.Dispatch<React.SetStateAction<PanelTab>>;
    toggleAuth: any;
    isAuthShowing: any;
    isModeMenuOpen: any;
    toggleModeMenu: any;
    selectedMode: Mode;
    vrmScale: number;
    openMicSettings: boolean;
    activeProfileTab: string;
    setSelectedMode: Dispatch<SetStateAction<Mode>>;
    addTogglerRef: any;
    clickRef: any;
    artwork: any;
    isPanelHidden: any;
    setHidePanel: any;
    tip: {
        type: "mode" | "speaking" | "artwork" | "tip";
    };
    toggleTip: ({
        type,
        timeout,
        opts,
    }: {
        type: "mode" | "speaking" | "artwork" | "tip";
        timeout: null | number;
        opts?: any;
    }) => NodeJS.Timeout;
    enterVR: () => unknown;
    isFirstTimeOpenModeMenu: boolean;
    setIsFirstTimeOpenModeMenu: Dispatch<SetStateAction<boolean>>;
    setMobileViewState: any;
    activeArtworkInfoBulle: ArtworkInfoBulleTypes;
    setActiveArtworkInfoBulle: Dispatch<SetStateAction<ArtworkInfoBulleTypes>>;
    isMobileArtworkInfoOpened: boolean;
    setActiveProfileTab: Dispatch<SetStateAction<string>>;
    setIsMobileArtworkInfoOpened: Dispatch<SetStateAction<boolean>>;
    toggleMicSettings: Dispatch<SetStateAction<boolean>>;
    applyVrmSettings: (vrm: any) => Promise<void>;
    handleSaveSettings: (key: string, value: string) => Promise<void>;
    sceneContainer: React.MutableRefObject<HTMLDivElement>;
    settings: {
        avatar: "COIN" | "VRM";
        quality: "high" | "medium" | "low";
        camera: "first_person" | "third_person";
        vrm: string;
        default_vrm_scale: number;
        joystick: "left" | "right";
        adjustCamera: "auto" | "manual";
        fly_mode_show_username: boolean;
        fly_mode_show_chat: boolean;
        fly_mode_stabilization: "OFF" | "MEDIUM" | "HIGH";
        fly_mode_speed: "SLOWEST" | "SLOW" | "NORMAL" | "FAST";
    };
    handleSettings: (key: any, value: any, force?: boolean) => Promise<void>;
    settingsLoading: "" | "avatar" | "quality" | "camera";
    isEditionAllowed: boolean;
    getBaseAnalytics: () => any;
}

export { Mode } from "./Mode";

export type ArtworkInfoBulleTypes = "" | "basic" | "helper" | "mobile";

export const PanelContext = createContext<PanelContextState>(null);

export default function PanelProvider({
    children,
    exhibit,
    isArtworkInfoShowing,
    isPlaying,
    artwork,
    enterVR,
    setMobileViewState,
    isModeMenuOpen,
    setModeMenuOpen,
    sceneContainer,
    settings,
    setSettings,
    destination,
}) {
    const { user, userData, dispatch, token } = useContext(UserContext);

    const [selectedUser, setSelectedUser] = useState<Player>({} as any);

    const { initVrm } = useVrm();

    const { chat, mode, voice, _onChangeModeCallback, _onConnect, room } =
        useMultiplayer();

    const { hasSpeakingUsers, voiceUsers, voiceState } = voice;

    const [activeProfileTab, setActiveProfileTab] = useState("profile");

    const [spaces, setSpaces] = useState([]);

    const [tip, toggleTip] = useState(null);

    const [loadNfts, setLoadNfts] = useState(false);

    const [openMicSettings, toggleMicSettings] = useState(false);

    const [isPanelHidden, setHidePanel] = useState(false);

    const [settingsLoading, setSettingsLoading] = useState<
        "avatar" | "quality" | "camera" | ""
    >("");

    const world = useWorld();

    const [selectedMode, setSelectedMode] = useState<Mode>(
        mode === "solo" ? Mode.SOLO : Mode.MULTIPLAYER
    );

    const nfts = useOwnedAssets(user.id, getDefaultRepo(user.id), loadNfts);

    const otherNfts = useOwnedAssets(
        selectedUser?.userData?.walletId || "",
        getDefaultRepo(selectedUser?.userData?.walletId || ""),
        loadNfts
    );

    // One value for every panel over the space, so two are never open at
    // once. The moves are listed in spacePanelMachine.ts.
    const [spacePanel, setSpacePanel] = useState<SpacePanel>("");

    const dispatchSpacePanel = useCallback(
        (event: SpacePanelEvent) =>
            setSpacePanel((panel) => spacePanelTransition(panel, event)),
        []
    );

    const currentTab = legacyPanelTab(spacePanel);

    const setCurrentTab: Dispatch<SetStateAction<PanelTab>> = useCallback(
        (action) =>
            setSpacePanel((panel) =>
                spacePanelTransition(panel, {
                    type: "tab",
                    tab:
                        typeof action === "function"
                            ? action(legacyPanelTab(panel))
                            : action,
                })
            ),
        []
    );

    const { toggle, isShowing } = useModal();

    const [isMobileArtworkInfoOpened, setIsMobileArtworkInfoOpened] =
        useState(false);

    const [activeArtworkInfoBulle, setActiveArtworkInfoBulle] = useState<
        "" | "basic" | "helper" | "mobile"
    >("");

    const { clickRef, addTogglerRef } = useOnClickOutside({ handler });

    const tipTimeout = useRef(null);

    const [isFirstTimeOpenModeMenu, setIsFirstTimeOpenModeMenu] =
        useState(false);

    const [isEditionAllowed, setIsEditionAllowed] = useState(false);

    function handler() {
        setCurrentTab("");
    }

    useEffect(() => {
        setIsEditionAllowed(exhibit?.params?.editionAllowed);
    }, [exhibit?.params?.editionAllowed]);

    useEffect(() => {
        if (currentTab) {
            amplitude_logAnalyticsEvent(`open_panel_modal`, {
                type: currentTab,
                label: room.label,
                isMod: room.isMod,
                roomId: room.id,
                numberOfUsers: room.numOfUsers,
            });
        }
    }, [currentTab]);

    const { _handleSaveSettings, _handleSettings, _settings } = useVrm();

    useEffect(() => {
        _handleSaveSettings.current = handleSaveSettings;
        _handleSettings.current = handleSettings;
    }, [settings, userData]);

    useEffect(() => {
        _settings.current = settings;
    }, [settings]);

    useEffect(() => {
        function handleKeydown(e) {
            if (
                e.target.nodeName === "INPUT" ||
                e.target.nodeName === "TEXTAREA"
            ) {
                return;
            }

            if (e.key === "c" || e.key === "C") {
                if (settingsLoading === "camera") return;

                handleSettings(
                    "camera",
                    settings.camera === "first_person"
                        ? "third_person"
                        : "first_person"
                );
            }
        }

        window.addEventListener("keydown", handleKeydown);

        return () => {
            window.removeEventListener("keydown", handleKeydown);
        };
    }, [settings.camera, settingsLoading, userData?.settings]);

    async function onConnect(userData) {
        if (!userData?.settings) {
            const camera = readNativeCameraPreference(settings?.camera);
            setSettings((state) => ({ ...state, camera }));
            await applySetting("camera", camera, userData);
            return;
        }
        if (userData?.settings) {
            setSettings((state) => ({
                ...state,
                ...userData.settings,
                camera: readNativeCameraPreference(userData.settings.camera),
            }));

            await applySettings(userData);

            await initVrm(userData, false, exhibit, destination.params);
        }
    }

    function handleToggleTip({
        type,
        timeout = null,
        opts,
    }: {
        type: "mode" | "speaking" | "artwork" | "tip" | null;
        timeout?: null | number;
        opts?: any;
    }) {
        if (!type) {
            toggleTip(null);
        } else {
            toggleTip({ type });
        }

        if (tipTimeout.current) {
            clearTimeout(tipTimeout.current);
        }
        if (timeout) {
            return (tipTimeout.current = setTimeout(() => {
                toggleTip(null);

                if (type === "mode" && opts?.mode === Mode.MULTIPLAYER) {
                    handleToggleTip({
                        type: "tip",
                        timeout: 5000,
                    });
                }
            }, timeout));
        }
    }

    async function applySettings(userData) {
        applySetting(
            "camera",
            readNativeCameraPreference(userData?.settings?.camera),
            userData
        );

        // applySetting("avatar", userData?.settings?.avatar, userData);

        applySetting("quality", userData?.settings?.quality, userData);

        //applySetting("vrm", userData?.settings?.vrm, userData);
    }

    async function applySetting(key, value, userData) {
        if (
            key === "camera" &&
            !isLobbyDestinationPreparing() &&
            (value === "first_person") !== IS_FIRST_PERSON
        ) {
            await world.current.setThirdPerson({
                enabled: value !== "first_person",
            });
        }

        if (key === "quality" && value !== settings?.quality) {
            // @ts-ignore

            world.current.setQuality({
                quality: value,
            });
            // world.current.resize({
            //     quality: value,
            // });
        }

        // if (
        //     key === "avatar" &&
        //     userData.settings?.avatar !== settings?.avatar
        // ) {
        //     world.current.toggleAvatarMode(value);
        // }
    }

    async function handleSettings(key, value, force = false) {
        if (
            !force &&
            (key === "camera"
                ? settings?.camera
                : userData?.settings?.[key]) === value
        ) {
            return;
        }

        setSettingsLoading(key);

        await applySetting(key, value, userData);

        await handleSaveSettings(key, value);
    }

    async function handleSaveSettings(key, value) {
        if (key === "camera") rememberNativeCameraPreference(value);
        setSettings((state) => ({
            ...state,
            [key]: value,
        }));

        setSettingsLoading("");

        console.log("userData", userData);

        const payload = {
            settings: {
                ...(userData?.settings || {}),
                [key]: value,
            },
        };

        dispatch({
            type: UPDATE_USER_DATA,
            payload,
        });

        try {
            if (user.id) {
                const response = await updateUser(token, payload, user.id);
                if (response?.success) {
                    // show message
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    function getBaseAnalytics() {
        return {
            exhibitId: exhibit.id,
            ownerId: exhibit.owner,
            collab: exhibit.editors?.length > 1,
            destination: exhibit.info?.room,
            user_id: user.id,
            exhibitName: exhibit.info?.headline,
            number_of_artworks: Object.keys(exhibit.artworks || {}).length,
        };
    }

    function toggleModeMenu(isVRSelect = false) {
        if (!isPlaying) return;

        setModeMenuOpen((state) => {
            if (!isVRSelect) {
                if (state && isFirstTimeOpenModeMenu) {
                    setIsFirstTimeOpenModeMenu(false); // Close Alternate menu if the mode menu gets closed the first time
                }

                if (!state) {
                    if (!IS_MOBILE) {
                        document.exitPointerLock();
                    }
                    world.current.pause();
                } else {
                    if (!isShowing && !isArtworkInfoShowing) {
                        // CANVAS.requestPointerLock();
                    }

                    world.current.play();
                }
            }

            return !state;
        });

        setCurrentTab("");
    }

    // useEffect(() => {
    //     setSelectedMode(mode === "solo" ? Mode.SOLO : Mode.MULTIPLAYER);
    // }, [mode]);

    useEffect(() => {
        _onConnect.current = onConnect;

        _onChangeModeCallback.current = (mode) => {
            setSelectedMode(mode);
        };
    }, []);

    // Small-screen artwork details open only for the artwork whose bubble
    // was tapped. Looking at another artwork closes them, so they never
    // open by themselves for the next one.
    const lastArtworkIdRef = useRef(null);
    useEffect(() => {
        if (artwork?.id == null) return;
        if (
            lastArtworkIdRef.current != null &&
            lastArtworkIdRef.current !== artwork.id
        ) {
            setIsMobileArtworkInfoOpened(false);
        }
        lastArtworkIdRef.current = artwork.id;
    }, [artwork?.id]);

    // The small-screen details keep first person; closing them, however
    // it happens, gives the camera back.
    useEffect(() => {
        if (!isMobileArtworkInfoOpened) releaseArtworkFocus(world.current);
    }, [isMobileArtworkInfoOpened]);

    useEffect(() => {
        if (selectedMode === Mode.VIRTUAL_TOUR && artwork) {
            handleToggleTip({ type: "artwork" });
        }
    }, [artwork, selectedMode]);

    useEffect(() => {
        const hasPlayingUsers =
            (voiceState.type === "enabled" && voiceState.state.isPlaying) ||
            Object.values(voiceUsers).some((it) => {
                return it.isPlaying;
            });

        let hasLiveAudio = hasSpeakingUsers || hasPlayingUsers;

        if (
            selectedMode === Mode.MULTIPLAYER &&
            hasLiveAudio &&
            tip?.type !== "speaking"
        ) {
            handleToggleTip({ type: "speaking" });
        }

        if (tip?.type === "speaking" && !hasLiveAudio) {
            handleToggleTip({ type: null });
        }
    }, [!hasSpeakingUsers, voiceUsers, voiceState, tip]);

    useEffect(() => {
        function handleKeys(e) {
            if (
                e.target.nodeName === "INPUT" ||
                e.target.nodeName === "TEXTAREA"
            ) {
                return;
            }

            if (e.key === "Tab") {
                e.preventDefault();
                toggleModeMenu();
            }

            if (e.key === "p" || e.key === "P") {
                if (!IS_MOBILE) {
                    document.exitPointerLock();
                }

                setSelectedUser({} as any);

                if (!user.id) {
                    toggle();
                    return;
                }

                setCurrentTab((state) =>
                    state === "profile" ? "" : "profile"
                );
            }
            if (e.key === "v" || e.key === "V") {
                chat.setIsChatDisplayed((state) => !state);
                // setCurrentTab(state => state === "profile" ? "" : "profile");
            }

            if (e.key === "u" || e.key === "U") {
                if (!IS_MOBILE) {
                    document.exitPointerLock();
                }

                setCurrentTab((state) => (state === "users" ? "" : "users"));
            }
            // if (e.key === "n" || e.key === "N") {
            //     document.exitPointerLock();

            //     setCurrentTab((state) => (state === "camera" ? "" : "camera"));
            // }
            // if (e.key === "l" || e.key === "L") {
            //     document.exitPointerLock();

            //     setCurrentTab((state) =>
            //         state === "settings" ? "" : "settings"
            //     );
            // }
        }

        window.addEventListener("keydown", handleKeys);

        return () => {
            window.removeEventListener("keydown", handleKeys);
        };
    }, [user.id, isShowing, isArtworkInfoShowing, isPlaying]);

    const value = {
        isPlaying,
        exhibit,
        selectedUser,
        setSelectedUser,
        spaces,
        setSpaces,
        loadNfts,
        openMicSettings,
        setLoadNfts,
        activeProfileTab,
        nfts,
        otherNfts,
        spacePanel,
        dispatchSpacePanel,
        currentTab,
        setCurrentTab,
        toggleAuth: toggle,
        isAuthShowing: isShowing,
        isModeMenuOpen,
        toggleModeMenu,
        selectedMode,
        setSelectedMode,
        clickRef,
        addTogglerRef,
        artwork,
        tip,
        toggleTip: handleToggleTip,
        enterVR,
        isPanelHidden,
        setHidePanel,
        isFirstTimeOpenModeMenu,
        setIsFirstTimeOpenModeMenu,
        setMobileViewState,
        activeArtworkInfoBulle,
        setActiveArtworkInfoBulle,
        isMobileArtworkInfoOpened,
        setIsMobileArtworkInfoOpened,
        setActiveProfileTab,
        sceneContainer,
        settings,
        settingsLoading,
        handleSettings,
        toggleMicSettings,
        handleSaveSettings,
        isEditionAllowed,
        getBaseAnalytics,
    };

    return (
        <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
    );
}

export function usePanel() {
    const context = useContext(PanelContext);

    if (!context) {
        throw Error("usePanel needs to be called within PanelContext.");
    }

    return context;
}
