import { rememberTravelAvatar } from "@utils/travelAvatar";
import useOwnedLobbyAvatars, { ownedFirst } from "./useOwnedLobbyAvatars";
import { flashWallets } from "./useFlashNfts";
import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import styled from "styled-components";
import dynamic from "next/dynamic";
import {
    readFlashArtwork,
    type FlashArtwork,
    type LobbyFlash,
} from "../../../multiplayer/protocol/lobby-flash.js";
const FlashPicker = dynamic(() => import("./FlashPicker"), { ssr: false });
import { brandTokens } from "@styles/brand/tokens";
import { UPDATE_USER_DATA, UserContext } from "@components/context/UserContext";
import InAppLink from "@components/InAppLink";
import InlineError from "@ui/components/InlineError";
import { lobbyErrorMessage } from "./lobbyErrors";
import type { LandingCard } from "../landing-carousel/types";
import Icon from "../landing-carousel/components/Icon";
import LobbyScene from "./LobbyRenderer";
import type { LobbyDestination, LobbySceneProps } from "./sceneTypes";
import { readTransportStyle } from "./lobbyPreviewOptions";
import AvatarCarousel from "./AvatarCarousel";
import useLobbySocial, { lobbyDisplayName } from "./useLobbySocial";
import { activeSpeech } from "./speechBubbles";
import LobbyChat from "./LobbyChat";
import LobbyPlace from "./LobbyPlace";
import LobbyArrivalStatus from "./LobbyArrivalStatus";
import LobbyConversationSurface from "./LobbyConversationSurface";
import { lobbyDockStyles } from "./lobbyDockStyles";
import LobbyExplorePanel from "./LobbyExplorePanel";
import LobbyPeoplePanel from "./LobbyPeoplePanel";
import { lobbyPanelSurface } from "./lobbyPanelStyles";
import EmotePanel from "./EmotePanel";
import LobbyGroupsModal from "./LobbyGroupsModal";
import LobbyGroupNotices from "./LobbyGroupNotices";
import LobbyVoiceRequests from "./LobbyVoiceRequests";
import LobbySummonNotice from "./LobbySummonNotice";
import useLobbyGroupJourney from "./useLobbyGroupJourney";
import { conversationStyles } from "./conversationStyles";
import LobbyDockIcon from "./LobbyDockIcon";
import useLobbyJourney from "./useLobbyJourney";
import { useEnginePrefetch } from "./enginePrefetch";
import { lobbyJourneyView } from "./lobbyJourneyMachine";
import type { LobbyReturnTransition } from "@utils/lobbyReturnTransition";
import { TRAVEL_ISOLATE_MS } from "./worldTravelTiming";
import useLobbyTravelParty from "./useLobbyTravelParty";
import useLobbyToast, { LOBBY_TOAST_MS } from "./useLobbyToast";
import { lobbyGroupPresence } from "./lobbyGroupPresence";
import { isLobbyTravelLive } from "../../../multiplayer/protocol/lobby-groups";
import PartyPanel from "@features/social/PartyPanel";
import { resolveLobbyAvatar } from "./avatarSelection";
import { lobbyPortraitUrl } from "./lobbyIdentity";
import VRMS from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import { EMOTES } from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants";
// Loaded on first open: it pulls in account, bookmark and guestbook code.
const SpaceInfoSidebar = dynamic(
    () => import("@features/space-info/SpaceInfoSidebar"),
    { ssr: false }
);

/** Shown as a toast, and said once to screen readers, when the visitor's own
 * avatar file fails and the scene shows the default avatar instead. */
const AVATAR_FALLBACK_NOTICE = "Couldn’t load your avatar. Using the default.";

function NativeIcon({ name, size = 20 }: { name: string; size?: number }) {
    return (
        <img
            className="native-icon"
            src={`/icons/${name}.svg`}
            width={size}
            height={size}
            alt=""
            aria-hidden="true"
            draggable={false}
        />
    );
}

export default function Lobby({
    cards,
    onExit,
    onReady,
    initialReturn,
}: {
    cards: LandingCard[];
    onExit: () => void;
    onReady: () => void;
    initialReturn?: LobbyReturnTransition | null;
}) {
    const account = useContext(UserContext);
    const { user, userData, token, authenticated, isAnonymous } = account;
    const profilePhoto = lobbyPortraitUrl(userData?.avatar);
    const journey = useLobbyJourney(initialReturn);
    const [lobbyInfoOpen, setLobbyInfoOpen] = useState(false);
    const journeyView = lobbyJourneyView(journey);
    const { entered, returning, preparingReturn } = journeyView;
    // Walking through a portal is no trip: no travel overlay and no
    // entrance, the world is already drawn behind the aperture.
    const crossingPortal =
        journey.phase === "revealing" && journey.portalCrossing;
    const travelling = journeyView.travelling && !crossingPortal;
    const revealing = journeyView.revealing && !crossingPortal;
    const travelControls = useRef<HTMLDivElement>(null);
    // Announced to screen readers only: travel shows no words, here or in
    // the 3D scene.
    const travelTitle = returning
        ? "Lobby"
        : journey.selected?.title?.trim() || "Your world";
    const [ready, setReady] = useState(false);
    const [sceneError, setSceneError] = useState("");
    // Every scene error that reaches here ends the scene, whatever its kind;
    // the renderer decides beforehand whether another backend is worth a try.
    const sceneFailed = useCallback<LobbySceneProps["onError"]>(
        (message) => setSceneError(message),
        []
    );
    const toast = useLobbyToast();
    // The toast has no live region, so its text is also said here, once.
    const [announcement, setAnnouncement] = useState("");
    useEffect(() => {
        if (!announcement) return;
        const timer = window.setTimeout(
            () => setAnnouncement(""),
            LOBBY_TOAST_MS
        );
        return () => window.clearTimeout(timer);
    }, [announcement]);
    const avatarFallbackFor = useRef("");
    useEffect(() => {
        // A renderer failure must expose the existing retry/exit controls.
        if (sceneError && initialReturn && returning) journey.cancel();
    }, [sceneError, initialReturn, returning, journey.cancel]);
    const [sceneAttempt, setSceneAttempt] = useState(0);
    const [avatar, setAvatar] = useState<{
        id: string;
        name: string;
        url: string;
        scale?: number;
    }>(null);
    const [avatarOpen, setAvatarOpen] = useState(false);
    const [loadedAvatar, setLoadedAvatar] = useState<typeof avatar>(null);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [avatarError, setAvatarError] = useState("");
    const avatarButton = useRef<HTMLButtonElement>(null);
    const controlsElement = useRef<HTMLDivElement>(null);
    const closeAvatars = useCallback(() => {
        setAvatarOpen(false);
        requestAnimationFrame(() => avatarButton.current?.focus());
    }, []);
    // The picker's choice becomes the saved avatar once it loads, so travel and
    // the destination space keep it instead of the previously saved one.
    const pickedAvatar = useRef<string | null>(null);
    const saveAvatar = useCallback(
        (choice: typeof avatar) => {
            // Wallet NFT choices are identified by model URL, which settings.vrm can't hold.
            if (!choice?.id || /^[a-z]+:\/\//i.test(choice.id)) return;
            if (choice.id === userData?.settings?.vrm) return;
            const payload = {
                settings: { ...(userData?.settings || {}), vrm: choice.id },
            };
            account.dispatch?.({ type: UPDATE_USER_DATA, payload });
            if (authenticated && !isAnonymous && user?.id && token)
                // Loaded on demand: the account helpers pull in the gallery engine.
                void import("@utils/saveToDb")
                    .then(({ updateUser }) =>
                        updateUser(token, payload, user.id)
                    )
                    .catch(() => {
                        // Keep the lobby avatar; only the saved default is stale.
                    });
        },
        [
            account,
            authenticated,
            isAnonymous,
            token,
            user?.id,
            userData?.settings,
        ]
    );
    const avatarStatus = useCallback<
        NonNullable<LobbySceneProps["onAvatarStatus"]>
    >(
        ({ url, status, fallbackUrl }) => {
            if (url !== avatar?.url) return;
            setAvatarLoading(status === "loading");
            if (status === "ready") {
                setLoadedAvatar(avatar);
                rememberTravelAvatar(userData, avatar);
                setAvatarError("");
                if (pickedAvatar.current === avatar.id) {
                    pickedAvatar.current = null;
                    saveAvatar(avatar);
                }
            } else if (status === "error" && fallbackUrl) {
                // Nothing else was on screen, so the scene now shows the
                // default avatar. Follow it, so the picker and other
                // visitors agree with what this visitor sees.
                const shown = Object.values(VRMS).find(
                    (item) => item.url === fallbackUrl
                );
                setAvatar({
                    id: shown?.id || fallbackUrl,
                    name: shown?.name || "Avatar",
                    url: fallbackUrl,
                    scale: avatar.scale,
                });
                setAvatarError("");
                // News about loading in the background: a toast that goes
                // away by itself, once per failed avatar.
                if (avatarFallbackFor.current !== url) {
                    avatarFallbackFor.current = url;
                    setAnnouncement(AVATAR_FALLBACK_NOTICE);
                    toast(AVATAR_FALLBACK_NOTICE);
                }
            } else if (status === "error")
                setAvatarError("This avatar couldn’t load. Try another one.");
        },
        [avatar, toast, saveAvatar]
    );
    const ownedAvatars = useOwnedLobbyAvatars(
        authenticated && !isAnonymous
            ? user?.id || userData?.walletId || ""
            : "",
        flashWallets(account),
        avatarOpen
    );
    const avatarChoices = useMemo(
        () =>
            ownedFirst(
                ownedAvatars.items,
                Object.values(VRMS).map((item) => ({
                    id: item.id,
                    name: item.name,
                    url: item.url,
                    img: item.image,
                }))
            ),
        [ownedAvatars.items]
    );
    useEffect(() => {
        controlsElement.current?.toggleAttribute("inert", avatarOpen);
    }, [avatarOpen]);
    const [flashOpen, setFlashOpen] = useState(false);
    const [flash, setFlash] = useState<LobbyFlash | null>(null);
    const flashRef = useRef<LobbyFlash | null>(null);
    const [flashStatus, setFlashStatus] = useState<"loading" | "ready">(
        "loading"
    );
    const [flashError, setFlashError] = useState("");
    /** The artwork whose Flash failed to load, for the error's Try again. */
    const [flashRetry, setFlashRetry] = useState<FlashArtwork | null>(null);
    const flashArtwork = useRef<FlashArtwork | null>(null);
    const flashButton = useRef<HTMLButtonElement>(null);
    const closeFlash = useCallback(() => {
        setFlashOpen(false);
        requestAnimationFrame(() => flashButton.current?.focus());
    }, []);
    const [emotesOpen, setEmotesOpen] = useState(false);
    const [emote, setEmote] = useState({ index: -1, nonce: 0 });
    useEffect(() => {
        let cancelled = false;
        void resolveLobbyAvatar(userData)
            .then((source) => {
                if (!cancelled) setAvatar(source);
            })
            .catch(() => {
                if (!cancelled)
                    setSceneError(
                        "Your avatar couldn’t load. Please try again."
                    );
            });
        return () => {
            cancelled = true;
        };
    }, [
        userData?.settings?.vrm,
        userData?.avatarContractAddress,
        userData?.walletId,
    ]);
    const [chatOpen, setChatOpen] = useState(false);
    const [peopleOpen, setPeopleOpen] = useState(false);
    const [exploreOpen, setExploreOpen] = useState(false);
    const [exploreMounted, setExploreMounted] = useState(false);
    const dockBar = useRef<HTMLDivElement>(null);
    const restoreExploreFocus = useRef(false);
    const chatInput = useRef<HTMLInputElement>(null);
    const chatButton = useRef<HTMLButtonElement>(null);
    const peopleButton = useRef<HTMLButtonElement>(null);
    const exploreButton = useRef<HTMLButtonElement>(null);
    const emoteButton = useRef<HTMLButtonElement>(null);
    const lobbyElement = useRef<HTMLDivElement>(null);
    const socialElement = useRef<HTMLDivElement>(null);
    const [groupModal, setGroupModal] = useState<{
        groupId?: string;
        joinCode?: string;
    } | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupRequest, setGroupRequest] = useState<{
        id: string;
        nonce: number;
    }>();
    const [groupError, setGroupError] = useState("");
    /** Runs the party action that failed again, from its error's Retry. */
    const [groupRetry, setGroupRetry] = useState<{ run: () => void } | null>(
        null
    );
    const failGroup = (error: unknown, fallback: string, retry: () => void) => {
        setGroupError(lobbyErrorMessage(error, fallback));
        setGroupRetry({ run: retry });
    };
    const [destinationGroupsOpen, setDestinationGroupsOpen] = useState(false);
    const selectGroup = useCallback((id: string) => {
        if (!id) return;
        setSelectedGroupId(id);
        setGroupRequest((previous) => ({
            id,
            nonce: (previous?.nonce || 0) + 1,
        }));
        setChatOpen(true);
        setDestinationGroupsOpen(true);
    }, []);
    const groupPresence = lobbyGroupPresence(
        journey.phase,
        journey.selected,
        travelling
    );
    const away = entered || travelling;
    const social = useLobbySocial({
        enabled: true,
        ...groupPresence,
        identity: {
            userId: authenticated && !isAnonymous ? user?.id : undefined,
            username:
                authenticated && !isAnonymous ? userData?.username : undefined,
            avatar: profilePhoto,
            token: token || undefined,
            vrmUrl: (loadedAvatar || avatar)?.url,
            scale: (loadedAvatar || avatar)?.scale,
        },
    });
    const stopFlash = useCallback(
        (nonce?: string) => {
            if (nonce && flashRef.current?.nonce !== nonce) return;
            flashRef.current = null;
            setFlash(null);
            social.setFlash?.(null);
        },
        [social.setFlash]
    );
    useEffect(() => {
        setFlashOpen(false);
        setFlashError("");
        stopFlash();
    }, [user?.id, authenticated, isAnonymous, stopFlash]);
    const selectFlash = useCallback(
        (art: FlashArtwork) => {
            const valid = readFlashArtwork(art);
            setFlashRetry(null);
            if (!valid) {
                setFlashError("This NFT’s image couldn’t open.");
                return;
            }
            flashArtwork.current = art;
            const next = {
                ...valid,
                nonce: crypto.randomUUID(),
                startedAt: Date.now(),
            };
            social.setFlash?.(null);
            flashRef.current = next;
            setFlash(next);
            setFlashStatus("loading");
            setFlashError("");
            setEmote((value) => ({ index: -1, nonce: value.nonce + 1 }));
            setFlashOpen(false);
            requestAnimationFrame(() =>
                document
                    .querySelector<HTMLCanvasElement>(".lobby-scene canvas")
                    ?.focus({ preventScroll: true })
            );
        },
        [social.setFlash]
    );
    const flashReady = useCallback(
        (next: LobbyFlash) => {
            if (flashRef.current?.nonce !== next.nonce) return;
            setFlashStatus("ready");
            social.setFlash?.(next);
        },
        [social.setFlash]
    );
    const flashFailed = useCallback(
        (nonce: string, message: string) => {
            if (flashRef.current?.nonce !== nonce) return;
            stopFlash(nonce);
            setFlashError(message);
            setFlashRetry(flashArtwork.current);
        },
        [stopFlash]
    );
    useEffect(() => {
        if (travelling || entered || avatarOpen) {
            setFlashOpen(false);
            stopFlash();
        }
    }, [travelling, entered, avatarOpen, stopFlash]);
    const groupJourney = useLobbyGroupJourney({ social, journey });
    const participatingTravel =
        groupJourney.activeTravel?.responses[social.sessionId] === "accepted" &&
        isLobbyTravelLive(groupJourney.activeTravel.status);
    const groups = social.groups || [];
    const invitations = social.invitations || [];
    const selectedGroup = groups.find((group) => group.id === selectedGroupId);
    useEffect(() => {
        if (!social.groupsSupported) return;
        const code = new URL(window.location.href).searchParams.get("group");
        if (code && /^[A-Za-z0-9_-]{6,128}$/.test(code))
            setGroupModal({ joinCode: code });
    }, [social.groupsSupported]);
    // The party the + in the people list adds to: the one you have open,
    // else the first one you own. Adding the first person starts it.
    const ownParty =
        (selectedGroup?.ownerId === social.sessionId && selectedGroup) ||
        groups.find((group) => group.ownerId === social.sessionId);
    const partyMemberIds = useMemo(
        () => ownParty?.members.map((member) => member.id) || [],
        [ownParty]
    );
    const addToParty = async (id: string) => {
        if (ownParty) {
            await social.groupAction({
                action: "invite",
                groupId: ownParty.id,
                inviteeId: id,
            });
        } else {
            const result = await social.groupAction({
                action: "create",
                name: "Your party",
                memberIds: [id],
            });
            if (result.groupId) selectGroup(result.groupId);
        }
    };
    // The people list, closest first (you on top). The order is set once
    // when the list opens: rows must not move under the pointer as people
    // walk or join your party. Anyone who arrives later goes to the end.
    const peopleOrder = useRef<Map<string, number> | null>(null);
    const [peopleNearby, setPeopleNearby] = useState(true);
    if (!peopleOpen) peopleOrder.current = null;
    const peoplePlayers = useMemo(() => {
        if (!peopleOpen) return social.players;
        if (!peopleOrder.current) {
            const me = social.getPredictedPose?.() ||
                social.players.find((player) => player.isLocal) || {
                    x: 0,
                    z: 0,
                };
            peopleOrder.current = new Map(
                social.players
                    .map((player) => ({
                        id: player.id,
                        name: player.name,
                        d: player.isLocal
                            ? -1
                            : (player.x - me.x) ** 2 + (player.z - me.z) ** 2,
                    }))
                    .sort((a, b) =>
                        peopleNearby || a.d < 0 || b.d < 0
                            ? a.d - b.d
                            : a.name.localeCompare(b.name)
                    )
                    .map(({ id }, index) => [id, index])
            );
        }
        const order = peopleOrder.current;
        for (const player of social.players)
            if (!order.has(player.id)) order.set(player.id, order.size);
        return [...social.players].sort(
            (a, b) => order.get(a.id) - order.get(b.id)
        );
    }, [peopleOpen, peopleNearby, social.players]);
    const closeGroupModal = () => {
        if (groupModal?.joinCode) {
            const url = new URL(window.location.href);
            url.searchParams.delete("group");
            window.history.replaceState(window.history.state, "", url.href);
        }
        setGroupModal(null);
    };
    useEffect(() => {
        if (
            selectedGroupId &&
            !groups.some((group) => group.id === selectedGroupId)
        )
            setSelectedGroupId(null);
    }, [groups, selectedGroupId]);
    useEffect(() => {
        if (
            entered &&
            (invitations.length ||
                groups.some(
                    (group) =>
                        group.travel?.responses[social.sessionId] ===
                            "pending" && group.travel.status === "inviting"
                ))
        )
            setDestinationGroupsOpen(true);
    }, [entered, invitations.length, groups, social.sessionId]);
    // What people just said, shown over their heads in place of their name
    // tags. The scene fades each line out on its own.
    const speech = useMemo(() => {
        // Party messages only reach the party's members, so their lines
        // show above the speaker for the party and nobody else.
        const lines = activeSpeech([
            ...social.messages,
            ...(social.groupMessages || []),
        ]);
        if (social.sessionId && lines[social.sessionId]) {
            lines.self = lines[social.sessionId];
            delete lines[social.sessionId];
        }
        return lines;
    }, [social.messages, social.groupMessages, social.sessionId]);
    const party = useLobbyTravelParty({
        enabled: authenticated && !isAnonymous,
        players: social.players,
        identityKey: user?.id,
    });
    // Choosing a space alone opens a round portal ahead; walking in travels.
    const [portal, setPortal] = useState<LobbyDestination | null>(null);
    // This trip started by walking through the portal.
    const [portalTrip, setPortalTrip] = useState(false);
    const [portalActivated, setPortalActivated] = useState(false);
    // Walked in before the room finished loading: step through once it has.
    const [portalWalkedIn, setPortalWalkedIn] = useState(false);
    useEffect(() => {
        if (!portalWalkedIn || !portal) return;
        if (journey.phase === "ready" && journey.admitted) {
            setPortalWalkedIn(false);
            journey.crossPortal();
        } else if (journey.phase === "error" || journey.phase === "idle") {
            // Preparation failed or was dropped: fall back to a normal trip.
            setPortalWalkedIn(false);
            const destination = portal;
            setPortal(null);
            selectDestination(destination, { instant: true });
        }
    }, [portalWalkedIn, portal, journey.phase, journey.admitted]);
    useEffect(() => {
        if (journey.phase === "idle") setPortalTrip(false);
    }, [journey.travel, journey.phase]);
    const openPortal = (destination: LobbyDestination) => {
        setExploreOpen(false);
        // ?travel=portal opens the round portal first; otherwise travel now.
        if (
            readTransportStyle() !== "portal" ||
            (selectedGroup && social.groupsSupported)
        )
            selectDestination(destination);
        else {
            if (portalActivated) journey.cancel();
            setPortalActivated(false);
            setPortalWalkedIn(false);
            setPortal(destination);
            // Keep the saved capture lightweight until Enter opens the portal.
            // The energy portal looks into the space's saved 360, which cards
            // deliberately don't carry. Fetch it for this one destination.
            if (destination.id)
                void fetchSpacePanorama(destination.id).then((panoramaUrl) => {
                    if (!panoramaUrl) return;
                    setPortal((current) =>
                        current?.id === destination.id
                            ? { ...current, panoramaUrl }
                            : current
                    );
                });
        }
    };
    const activatePortal = () => {
        if (!portal || portalActivated) return;
        setPortalActivated(true);
        journey.select(portal);
    };
    useEffect(() => {
        if (!portal) return;
        const close = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.repeat) return;
            const target = event.target as HTMLElement;
            if (
                target?.closest?.(
                    "input, textarea, select, button, [contenteditable='true']"
                )
            )
                return;
            if (event.key === "Enter") {
                event.preventDefault();
                activatePortal();
                return;
            }
            if (event.key !== "Escape") return;
            setPortal(null);
            journey.cancel();
        };
        document.addEventListener("keydown", close);
        return () => document.removeEventListener("keydown", close);
    }, [portal, portalActivated]);
    const selectDestination = (
        destination: Parameters<typeof journey.go>[0],
        options?: { instant?: boolean }
    ) => {
        setGroupError("");
        setGroupRetry(null);
        setExploreOpen(false);
        if (selectedGroup && social.groupsSupported) {
            setChatOpen(true);
            void groupJourney
                .propose(selectedGroup.id, destination)
                .catch((error) =>
                    failGroup(error, "Couldn’t invite the party.", () =>
                        selectDestination(destination, options)
                    )
                );
        } else {
            void party.refresh().catch(() => {});
            journey.go(destination, options);
        }
    };
    const cancelJourney = useCallback(() => {
        if (participatingTravel) {
            setGroupError("");
            setGroupRetry(null);
            void groupJourney
                .cancel()
                .catch((error) =>
                    failGroup(error, "Couldn’t cancel the trip.", cancelJourney)
                );
        } else journey.cancel();
    }, [participatingTravel, groupJourney.cancel, journey.cancel]);
    useEffect(() => {
        if (!travelling) return;
        if (!selectedGroup) setChatOpen(false);
        else if (chatOpen) setDestinationGroupsOpen(true);
        setPeopleOpen(false);
        setExploreOpen(false);
        setAvatarOpen(false);
        setEmotesOpen(false);
        document.exitPointerLock?.();
        if (!socialElement.current?.contains(document.activeElement))
            travelControls.current?.focus({ preventScroll: true });
    }, [travelling]);
    const population = social.population ?? social.players.length;
    const participants = useMemo(
        () => social.players.filter((player) => !player.isLocal),
        [social.players]
    );
    const sceneReady = useCallback(() => {
        setReady(true);
        onReady();
    }, [onReady]);
    // Downloads (never runs) the world engine while the lobby has nothing
    // else to load, so the first trip skips that download.
    useEnginePrefetch(
        ready && !sceneError && !avatarLoading && journey.phase === "idle"
    );
    const closeChat = useCallback(() => {
        setChatOpen(false);
        chatButton.current?.focus();
    }, []);
    const closePeople = useCallback(() => {
        setPeopleOpen(false);
        peopleButton.current?.focus();
    }, []);
    const openExplore = useCallback(() => {
        setExploreMounted(true);
        setExploreOpen(true);
        setAvatarOpen(false);
        setEmotesOpen(false);
        setFlashOpen(false);
        setPeopleOpen(false);
    }, []);
    const closeExplore = useCallback(() => {
        restoreExploreFocus.current = true;
        setExploreOpen(false);
    }, []);
    useEffect(() => {
        dockBar.current?.toggleAttribute(
            "inert",
            exploreOpen || emotesOpen || flashOpen
        );
        if (exploreOpen) {
            setExploreMounted(true);
            return;
        }
        if (restoreExploreFocus.current) {
            restoreExploreFocus.current = false;
            exploreButton.current?.focus();
        }
        if (!exploreMounted) return;
        // The panel fades normally, but defer its React/DOM cleanup until the
        // opening camera movement has had its frames.
        const openingRemaining =
            journey.travel && !journey.travel.reducedMotion
                ? journey.travel.startedAt +
                  TRAVEL_ISOLATE_MS -
                  performance.now()
                : 0;
        const timer = window.setTimeout(
            () => setExploreMounted(false),
            Math.max(240, openingRemaining)
        );
        return () => window.clearTimeout(timer);
    }, [
        exploreOpen,
        exploreMounted,
        emotesOpen,
        flashOpen,
        journey.travel?.startedAt,
        journey.travel?.reducedMotion,
    ]);
    useEffect(() => {
        lobbyElement.current?.toggleAttribute(
            "inert",
            entered || travelling || !!groupModal
        );
        socialElement.current?.toggleAttribute(
            "inert",
            !!groupModal || flashOpen
        );
        journey.frameRef.current?.toggleAttribute(
            "inert",
            !entered || !!groupModal
        );
    }, [entered, travelling, journey.frameUrl, groupModal, flashOpen]);
    useEffect(() => {
        if (!entered) return;
        setPortal(null);
        setPortalActivated(false);
        setPortalWalkedIn(false);
        if (!selectedGroup) setChatOpen(false);
        else if (chatOpen) setDestinationGroupsOpen(true);
        setPeopleOpen(false);
        setExploreOpen(false);
        setAvatarOpen(false);
        setEmotesOpen(false);
        if (!socialElement.current?.contains(document.activeElement))
            journey.frameRef.current?.focus();
    }, [entered]);
    useEffect(() => {
        const keyboard = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                entered ||
                event.repeat ||
                event.isComposing ||
                event.keyCode === 229 ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                event.shiftKey
            )
                return;
            const target =
                event.target instanceof Element ? event.target : null;
            if (
                target?.closest(
                    'input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]'
                )
            )
                return;
            if (travelling) {
                if (event.key === "Escape") {
                    event.preventDefault();
                    cancelJourney();
                }
                return;
            }
            if (event.key === "Enter") {
                // Enter is for the chat. A button left focused by a click
                // (people, emotes, ...) must not open its panel again.
                const focused = target?.closest("button,a");
                if (focused instanceof HTMLElement) focused.blur();
                event.preventDefault();
                if (journey.phase === "ready" && !participatingTravel)
                    journey.enter();
                else {
                    setChatOpen(true);
                    chatInput.current?.focus();
                }
            } else if (event.key === "Escape") {
                event.preventDefault();
                if (avatarOpen) closeAvatars();
                else if (flashOpen) closeFlash();
                else if (emotesOpen) setEmotesOpen(false);
                else if (peopleOpen) closePeople();
                else if (exploreOpen) closeExplore();
                else if (chatOpen) closeChat();
                else if (flash) stopFlash();
                else if (journey.selected) cancelJourney();
                else onExit();
            }
        };
        window.addEventListener("keydown", keyboard);
        return () => window.removeEventListener("keydown", keyboard);
    }, [
        entered,
        travelling,
        peopleOpen,
        avatarOpen,
        emotesOpen,
        flashOpen,
        flash,
        closeFlash,
        stopFlash,
        exploreOpen,
        chatOpen,
        journey.phase,
        journey.selected,
        journey.enter,
        journey.cancel,
        cancelJourney,
        participatingTravel,
        closePeople,
        closeAvatars,
        closeExplore,
        closeChat,
        onExit,
    ]);

    const stage = social.stage;
    const onStage = !!stage?.speakers.some(
        (speaker) => speaker.sessionId === social.sessionId
    );
    // Lobby voice is admin-approved: until then the mic button asks to speak.
    const voiceGated =
        !!stage?.spatial && !onStage && social.voiceState !== "live";
    const voiceLabel = voiceGated
        ? stage.muted
            ? "An admin muted you"
            : stage.role
            ? "Join voice"
            : stage.requested
            ? "Request sent · Cancel"
            : "Request to speak"
        : social.voiceState === "live"
        ? "Mute microphone"
        : social.voiceState === "connecting"
        ? "Connecting voice…"
        : "Enable microphone";
    const pressVoice = () => {
        if (!voiceGated) return void social.toggleVoice();
        if (stage.muted) return void social.listen();
        if (stage.role) {
            // Admins skip the queue; the server still applies the speaker cap.
            void social.adminAction("stage-add", social.sessionId);
            return void social.toggleVoice();
        }
        social.requestVoice(stage.requested);
        // Hear whoever is on voice while the request waits.
        if (!stage.requested && social.voiceState === "off")
            void social.listen();
    };
    return (
        <>
            <LobbySurface
                ref={lobbyElement}
                data-lobby-surface
                data-machine="lobby-journey"
                data-state={journey.phase}
                data-travelling={travelling || undefined}
                data-portal-live={
                    (portalActivated && journey.admitted && !entered) ||
                    undefined
                }
                data-entered={entered || undefined}
                data-revealing={revealing || undefined}
                data-return-preparing={preparingReturn || undefined}
                data-avatar-picker={avatarOpen || undefined}
                data-ready={ready || !!sceneError || undefined}
                aria-hidden={entered || travelling || undefined}
            >
                <div className="room" aria-label="Oncyber shared lobby">
                    <LobbyScene
                        key={sceneAttempt}
                        active={!entered && !revealing && !sceneError}
                        onTravelView={journey.setTravelView}
                        portal={travelling ? null : portal}
                        portalActivated={portalActivated}
                        renderPortal={journey.renderPortal}
                        onActivatePortal={activatePortal}
                        onEnterPortal={() => {
                            if (!portal || !portalActivated) return;
                            setPortalTrip(true);
                            setPortalWalkedIn(true);
                        }}
                        onReturnReady={journey.markReturnReady}
                        onReturnComplete={journey.finishReturn}
                        travel={
                            journey.travel
                                ? {
                                      ...journey.travel,
                                      partyIds: party.partyIds,
                                      // Progress for the halo's band only;
                                      // the scene draws no name or status.
                                      viaPortal: portalTrip,
                                      label: journey.selected && {
                                          progress:
                                              journey.admitted || revealing
                                                  ? undefined
                                                  : journey.progress,
                                      },
                                  }
                                : undefined
                        }
                        groupFormation={
                            returning ? undefined : groupJourney.formation
                        }
                        renderer="auto"
                        crowdEnabled={true}
                        proceduralMotion={true}
                        participants={participants}
                        initializePose={social.initializePose}
                        advanceMovement={social.advanceMovement}
                        sampleParticipants={social.sampleParticipants}
                        consumeCorrection={social.consumeCorrection}
                        avatarPreview={avatarOpen}
                        onAvatarStatus={avatarStatus}
                        avatarUrl={avatar?.url}
                        avatarScale={avatar?.scale}
                        profilePhoto={profilePhoto}
                        selfName={lobbyDisplayName(
                            authenticated && !isAnonymous
                                ? user?.id
                                : undefined,
                            authenticated && !isAnonymous
                                ? userData?.username
                                : undefined
                        )}
                        speech={speech}
                        emote={emote}
                        flash={flash}
                        flashPreviewOpen={flashOpen}
                        onFlashReady={flashReady}
                        onFlashDismiss={stopFlash}
                        onFlashError={flashFailed}
                        destinations={[]}
                        onMove={social.updatePosition}
                        onSelectDestination={() => {}}
                        travelPartyIds={party.partyIds}
                        onReady={sceneReady}
                        onError={sceneFailed}
                    />
                    {portal && !travelling && (
                        <PortalHint role="status">
                            {journey.phase === "error"
                                ? `${
                                      journey.error?.message ||
                                      "This portal could not open."
                                  } `
                                : portalActivated
                                ? journey.admitted
                                    ? "Walk into the portal to visit "
                                    : "Opening the portal to "
                                : "Open a portal to "}
                            <strong>{portal.title}</strong>
                            {!portalActivated && (
                                <button type="button" onClick={activatePortal}>
                                    Open portal <kbd>Enter</kbd>
                                </button>
                            )}
                            <span aria-hidden="true">·</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setPortal(null);
                                    journey.cancel();
                                }}
                            >
                                Close <kbd>Esc</kbd>
                            </button>
                        </PortalHint>
                    )}
                </div>
                <p className="lobby-announcement" role="status">
                    {announcement}
                </p>
                {!ready && !sceneError && (
                    <div className="arrival" role="status">
                        Opening the lobby<span>One moment.</span>
                    </div>
                )}
                {sceneError && (
                    <div className="scene-error" role="alert">
                        <h1>The lobby couldn’t open.</h1>
                        <p>{sceneError}</p>
                        <button
                            onClick={() => {
                                setSceneError("");
                                setSceneAttempt((value) => value + 1);
                            }}
                        >
                            Try again
                        </button>
                        <button onClick={onExit}>Back to exploring</button>
                    </div>
                )}
                <LobbyPlace
                    title="Lobby"
                    onTitleClick={() => setLobbyInfoOpen(true)}
                    titleExpanded={lobbyInfoOpen}
                    presence={
                        social.status === "connected"
                            ? `${population} here`
                            : social.status === "connecting"
                            ? "Connecting…"
                            : "You’re offline"
                    }
                    onBack={onExit}
                    backLabel="Back to exploring"
                />
                {lobbyInfoOpen && (
                    <SpaceInfoSidebar
                        id="lobby-info"
                        fallback={{
                            title: "Lobby",
                            description:
                                "The shared space between worlds. Meet people, pick an avatar and travel into any space together.",
                            deployer: {
                                name: "oncyber",
                                address: "",
                                avatar: "",
                                href: "",
                            },
                        }}
                        presence={
                            social.status === "connected"
                                ? `${population} here now`
                                : undefined
                        }
                        onClose={() => setLobbyInfoOpen(false)}
                    />
                )}
                <div
                    className="lobby-controls"
                    ref={controlsElement}
                    aria-hidden={avatarOpen || undefined}
                    id="lobby-controls"
                    tabIndex={-1}
                    data-portal-preview={
                        (portalActivated &&
                            journey.admitted &&
                            !entered &&
                            !revealing) ||
                        undefined
                    }
                    data-visible={ready || !!sceneError || undefined}
                    data-search={
                        exploreMounted || emotesOpen || flashOpen || undefined
                    }
                >
                    <div
                        className="lobby-dock"
                        data-explore={
                            exploreOpen || emotesOpen || flashOpen || undefined
                        }
                        role="group"
                        aria-label="Lobby controls"
                    >
                        <div
                            className="dock-bar"
                            ref={dockBar}
                            aria-hidden={
                                exploreOpen ||
                                emotesOpen ||
                                flashOpen ||
                                undefined
                            }
                        >
                            <div className="dock-item">
                                <span>{voiceLabel}</span>
                                <button
                                    className="dock-button"
                                    aria-label={voiceLabel}
                                    aria-pressed={
                                        voiceGated
                                            ? stage.requested
                                            : social.voiceState === "live"
                                    }
                                    disabled={
                                        social.status !== "connected" ||
                                        social.voiceState === "connecting"
                                    }
                                    onClick={pressVoice}
                                >
                                    <LobbyDockIcon
                                        name={
                                            social.voiceState === "live"
                                                ? "mic"
                                                : "mic-off"
                                        }
                                    />
                                </button>
                            </div>
                            <div className="dock-item dock-secondary">
                                <span>Avatars</span>
                                <button
                                    className="dock-button"
                                    ref={avatarButton}
                                    aria-label="Choose avatar"
                                    aria-expanded={avatarOpen}
                                    onClick={() => {
                                        setFlashOpen(false);
                                        stopFlash();
                                        setAvatarOpen((value) => !value);
                                        setEmotesOpen(false);
                                        setExploreOpen(false);
                                        setPeopleOpen(false);
                                    }}
                                >
                                    <LobbyDockIcon name="avatar" />
                                </button>
                            </div>
                            <div className="dock-item dock-secondary">
                                <span>Animations · 1–9</span>
                                <button
                                    className="dock-button"
                                    ref={emoteButton}
                                    aria-label="Emotes"
                                    aria-expanded={emotesOpen}
                                    aria-controls="lobby-emotes"
                                    onClick={() => {
                                        setFlashOpen(false);
                                        setEmotesOpen((value) => !value);
                                        setAvatarOpen(false);
                                        setExploreOpen(false);
                                        setPeopleOpen(false);
                                    }}
                                >
                                    <LobbyDockIcon name="emotes" />
                                </button>
                            </div>
                            <div className="dock-item">
                                <span>Flash</span>
                                <button
                                    className="dock-button"
                                    ref={flashButton}
                                    aria-label="Flash"
                                    aria-pressed={!!flash}
                                    aria-expanded={flashOpen}
                                    aria-controls="lobby-flash-picker"
                                    onClick={() => {
                                        setFlashOpen(true);
                                        setFlashError("");
                                        setAvatarOpen(false);
                                        setEmotesOpen(false);
                                        setExploreOpen(false);
                                        setPeopleOpen(false);
                                    }}
                                >
                                    <LobbyDockIcon name="flash" />
                                </button>
                            </div>
                            <div className="dock-item">
                                <span>Users list</span>
                                <button
                                    ref={peopleButton}
                                    className="dock-button"
                                    aria-label="People in this lobby"
                                    aria-pressed={peopleOpen}
                                    aria-expanded={peopleOpen}
                                    aria-controls="lobby-people"
                                    onClick={() => {
                                        setFlashOpen(false);
                                        setPeopleOpen((value) => !value);
                                        setAvatarOpen(false);
                                        setEmotesOpen(false);
                                        setExploreOpen(false);
                                    }}
                                >
                                    <LobbyDockIcon name="people" />
                                </button>
                                <div
                                    className="text-right-subtract-panel"
                                    aria-hidden="true"
                                >
                                    <div
                                        className={`dot${
                                            social.status === "offline"
                                                ? " red"
                                                : ""
                                        }`}
                                    />
                                    <span>
                                        {social.status === "connected"
                                            ? population
                                            : "—"}
                                    </span>
                                </div>
                            </div>
                            <div className="dock-item">
                                <span>Search worlds</span>
                                <button
                                    ref={exploreButton}
                                    className="dock-button"
                                    aria-label="Search worlds"
                                    aria-pressed={exploreOpen}
                                    aria-expanded={exploreOpen}
                                    aria-controls="lobby-explore"
                                    onClick={openExplore}
                                >
                                    <Icon name="search" size={22} />
                                </button>
                            </div>
                        </div>
                        {flashOpen && (
                            <FlashPicker
                                onSelect={selectFlash}
                                onClose={closeFlash}
                                returnFocusRef={flashButton}
                                showing={!!flash}
                                onStop={() => stopFlash()}
                            />
                        )}
                        {!flashOpen &&
                            !exploreOpen &&
                            !emotesOpen &&
                            (flash || flashError) && (
                                <div className="flash-status">
                                    <span
                                        role={flashError ? "alert" : "status"}
                                    >
                                        {flashError ||
                                            (flashStatus === "loading"
                                                ? "Preparing Flash…"
                                                : flash.title)}
                                    </span>
                                    {flash && (
                                        <button onClick={() => stopFlash()}>
                                            Stop Flash
                                        </button>
                                    )}
                                    {flashError && flashRetry && (
                                        <button
                                            onClick={() =>
                                                selectFlash(flashRetry)
                                            }
                                        >
                                            Try again
                                        </button>
                                    )}
                                    {flashError && (
                                        <button
                                            aria-label="Dismiss Flash error"
                                            onClick={() => setFlashError("")}
                                        >
                                            Dismiss
                                        </button>
                                    )}
                                </div>
                            )}
                        {emotesOpen && (
                            <EmotePanel
                                id="lobby-emotes"
                                items={EMOTES}
                                returnFocusRef={emoteButton}
                                onClose={() => setEmotesOpen(false)}
                                onSelect={(index) => {
                                    stopFlash();
                                    setEmote((value) => ({
                                        index,
                                        nonce: value.nonce + 1,
                                    }));
                                    setEmotesOpen(false);
                                }}
                                onStop={() => {
                                    setEmote((value) => ({
                                        index: -1,
                                        nonce: value.nonce + 1,
                                    }));
                                    setEmotesOpen(false);
                                }}
                            />
                        )}
                        {exploreMounted && (
                            <LobbyExplorePanel
                                active={exploreOpen}
                                cards={cards}
                                groupName={selectedGroup?.name}
                                onClose={closeExplore}
                                onSelect={openPortal}
                            />
                        )}
                    </div>
                </div>
                {social.status === "offline" &&
                    !exploreMounted &&
                    !emotesOpen &&
                    !avatarOpen &&
                    !flashOpen && (
                        <div className="connection-notice" role="status">
                            <span>
                                {social.error ||
                                    "Couldn’t connect to the shared lobby."}
                            </span>
                            {social.stopped !== "removed" && (
                                <button onClick={social.retry}>
                                    Reconnect
                                </button>
                            )}
                        </div>
                    )}
                {social.voiceError && !avatarOpen && (
                    <div
                        className="voice-notice"
                        data-search={exploreMounted || undefined}
                        role="status"
                    >
                        {social.voiceError}
                    </div>
                )}
                {avatarOpen && (
                    <>
                        <AvatarCarousel
                            items={avatarChoices}
                            selectedId={avatar?.id}
                            loading={avatarLoading}
                            ownedLoading={ownedAvatars.loading}
                            error={avatarError || ownedAvatars.error}
                            onSelect={(item) => {
                                if (item.id === avatar?.id) return;
                                setAvatarError("");
                                pickedAvatar.current = item.id;
                                setAvatar({
                                    id: item.id,
                                    name: item.name,
                                    url: item.url,
                                });
                                setEmote((value) => ({
                                    index: -1,
                                    nonce: value.nonce + 1,
                                }));
                            }}
                            onClose={closeAvatars}
                        />
                    </>
                )}
                {!!social.stage?.speakers.length &&
                    social.voiceState === "off" &&
                    !peopleOpen &&
                    !travelling && (
                        <VoiceLivePill
                            type="button"
                            onClick={() => void social.listen()}
                        >
                            <span aria-hidden="true" />
                            {social.stage.speakers
                                .map((speaker) => speaker.name)
                                .slice(0, 2)
                                .join(", ")}
                            {social.stage.speakers.length > 2
                                ? ` +${social.stage.speakers.length - 2}`
                                : ""}{" "}
                            on voice · Listen
                        </VoiceLivePill>
                    )}
                {peopleOpen && (
                    <LobbyPeoplePanel
                        players={peoplePlayers}
                        sort={{
                            nearby: peopleNearby,
                            onToggle: () => {
                                peopleOrder.current = null;
                                setPeopleNearby((value) => !value);
                            },
                        }}
                        party={
                            social.groupsSupported
                                ? {
                                      memberIds: partyMemberIds,
                                      onAdd: addToParty,
                                  }
                                : undefined
                        }
                        population={population}
                        status={social.status}
                        onClose={closePeople}
                        returnFocusRef={peopleButton}
                        voice={
                            social.stage && {
                                stage: social.stage,
                                voiceState: social.voiceState,
                                onListen: () => void social.listen(),
                                onRequest: social.requestVoice,
                                onLeave: social.leaveStage,
                                onAdmin: social.adminAction,
                            }
                        }
                        onGoTo={
                            social.protocol === "v2"
                                ? (id) => social.teleportTo(id)
                                : undefined
                        }
                        onSummonAll={
                            social.protocol === "v2"
                                ? social.summonAll
                                : undefined
                        }
                    >
                        {authenticated && !isAnonymous && (
                            <PartyPanel
                                experienceId={null}
                                onSignIn={() => {}}
                                onTravel={(destination) => {
                                    if (!destination.url) return;
                                    setPeopleOpen(false);
                                    void selectDestination({
                                        id: destination.experienceId,
                                        title: "Your party’s world",
                                        href: destination.url,
                                    });
                                }}
                            />
                        )}
                    </LobbyPeoplePanel>
                )}
                {journey.selected &&
                    !portal &&
                    !travelling &&
                    !participatingTravel &&
                    !peopleOpen &&
                    !exploreOpen &&
                    !avatarOpen &&
                    !emotesOpen && (
                        <section
                            className="native-panel journey-panel"
                            aria-label="Selected world"
                            aria-busy={
                                journey.phase === "loading" ||
                                journey.phase === "entering"
                            }
                        >
                            <div className="journey-copy">
                                <span className="eyebrow">NEXT STOP</span>
                                <h2>{journey.selected.title}</h2>
                                <p role="status">
                                    {journey.phase === "loading"
                                        ? "Preparing your world. Stay a little."
                                        : journey.phase === "ready"
                                        ? "Prepared · Press Enter when you’re ready."
                                        : journey.phase === "entering"
                                        ? "Joining the world…"
                                        : journey.error?.message ||
                                          "Choose when to go."}
                                </p>
                            </div>
                            {journey.phase === "ready" && (
                                <button
                                    className="enter"
                                    onClick={() => journey.enter()}
                                >
                                    Enter{" "}
                                    <NativeIcon name="arrow-right" size={16} />
                                </button>
                            )}
                            {(journey.phase === "loading" ||
                                journey.phase === "entering") && (
                                <span className="loader" aria-hidden="true" />
                            )}
                            {journey.phase === "error" && (
                                <div className="journey-error-actions">
                                    <button
                                        onClick={() =>
                                            void selectDestination(
                                                journey.selected
                                            )
                                        }
                                    >
                                        Try again
                                    </button>
                                    {journey.canOpenNormally && (
                                        <InAppLink href={journey.selected.href}>
                                            Open world{" "}
                                            <NativeIcon
                                                name="arrow-up-right"
                                                size={14}
                                            />
                                        </InAppLink>
                                    )}
                                </div>
                            )}
                            <button
                                className="cancel-journey"
                                onClick={cancelJourney}
                                aria-label="Cancel selected world"
                            >
                                <NativeIcon name="x" size={16} />
                            </button>
                        </section>
                    )}
            </LobbySurface>
            {journey.frameUrl && (
                <DestinationFrame
                    ref={journey.frameRef}
                    key={journey.attempt}
                    src={journey.frameUrl}
                    title={journey.selected?.title || "Prepared world"}
                    data-portal-preview={
                        (portalActivated &&
                            journey.admitted &&
                            !entered &&
                            !revealing) ||
                        undefined
                    }
                    data-visible={
                        entered || revealing || preparingReturn || undefined
                    }
                    data-portal-live={
                        (portalActivated && journey.admitted && !entered) ||
                        undefined
                    }
                    data-entered={entered || undefined}
                    data-lobby-loading-attempt={journey.attempt}
                    data-lobby-loading-start={
                        journey.travel
                            ? performance.timeOrigin + journey.travel.startedAt
                            : undefined
                    }
                    data-lobby-loading-phase={
                        entered
                            ? "active"
                            : revealing
                            ? "revealing"
                            : journey.travel && !preparingReturn
                            ? "opening"
                            : "preparing"
                    }
                    data-lobby-loading-reduced-motion={
                        journey.travel?.reducedMotion ? "true" : undefined
                    }
                    aria-hidden={!entered}
                    tabIndex={entered ? 0 : -1}
                    allow={
                        entered
                            ? "autoplay; fullscreen; gamepad; xr-spatial-tracking"
                            : "autoplay 'none'; fullscreen; gamepad; xr-spatial-tracking"
                    }
                    allowFullScreen
                />
            )}
            <LobbyConversationSurface
                ref={socialElement}
                data-search={exploreOpen || undefined}
                data-entered={away || undefined}
                data-people={peopleOpen || undefined}
                data-collapsed={(away && !destinationGroupsOpen) || undefined}
                data-hidden={
                    exploreOpen ||
                    avatarOpen ||
                    flashOpen ||
                    (away && !groups.length && !invitations.length) ||
                    undefined
                }
                aria-hidden={
                    exploreOpen ||
                    avatarOpen ||
                    flashOpen ||
                    (away && !groups.length && !invitations.length) ||
                    undefined
                }
            >
                {away && (
                    <button
                        className="destination-group-toggle"
                        onClick={() =>
                            setDestinationGroupsOpen((value) => !value)
                        }
                        aria-expanded={destinationGroupsOpen}
                    >
                        <LobbyDockIcon name="people" />
                        <span>{selectedGroup?.name || "Your parties"}</span>
                        <Icon
                            name={destinationGroupsOpen ? "close" : "chevron"}
                            size={13}
                        />
                    </button>
                )}
                <LobbyChat
                    social={social}
                    open={chatOpen}
                    onOpenChange={setChatOpen}
                    inputRef={chatInput}
                    buttonRef={chatButton}
                    hidden={
                        exploreOpen ||
                        avatarOpen ||
                        flashOpen ||
                        (away && !destinationGroupsOpen)
                    }
                    disabledReason={
                        away && !selectedGroup ? "Choose a party to chat" : ""
                    }
                    groupConversations={
                        social.groupsSupported
                            ? {
                                  groups,
                                  messages: social.groupMessages || [],
                                  request: groupRequest,
                                  onSelect: setSelectedGroupId,
                                  onCreate: () => setGroupModal({}),
                                  onManage: (id) =>
                                      setGroupModal({ groupId: id }),
                                  sendMessage: async (groupId, text) => {
                                      await social.groupAction({
                                          action: "message",
                                          groupId,
                                          text,
                                      });
                                      return true;
                                  },
                              }
                            : undefined
                    }
                    notices={
                        <>
                            <LobbySummonNotice
                                summon={social.summon}
                                onGo={(id) => social.teleportTo(id, true)}
                                onStay={social.dismissSummon}
                            />
                            <LobbyVoiceRequests
                                stage={social.stage}
                                onAdmin={social.adminAction}
                                onShowAll={() => {
                                    setFlashOpen(false);
                                    setPeopleOpen(true);
                                    setAvatarOpen(false);
                                    setEmotesOpen(false);
                                    setExploreOpen(false);
                                }}
                            />
                            {social.groupsSupported && (
                                <LobbyGroupNotices
                                    groups={groups}
                                    invitations={invitations}
                                    sessionId={social.sessionId}
                                    clock={social.groupClock}
                                    action={social.groupAction}
                                    onSelected={selectGroup}
                                    onAccept={groupJourney.accept}
                                    onDecline={groupJourney.decline}
                                    onLaunch={groupJourney.launch}
                                    onCancel={groupJourney.cancel}
                                />
                            )}
                        </>
                    }
                />
                <InlineError
                    message={groupError || groupJourney.error}
                    onRetry={groupError ? groupRetry?.run : undefined}
                />
            </LobbyConversationSurface>
            {groupModal && social.groupsSupported && (
                <LobbyGroupsModal
                    key={groupModal.groupId || groupModal.joinCode || "create"}
                    group={groups.find(
                        (group) => group.id === groupModal.groupId
                    )}
                    joinCode={groupModal.joinCode}
                    players={social.players}
                    sessionId={social.sessionId}
                    action={social.groupAction}
                    onClose={closeGroupModal}
                    onSelected={selectGroup}
                />
            )}
            {/* Through the portal there's no "Transporting you" moment. */}
            {travelling && !portalTrip && (
                <LobbyArrivalStatus
                    ref={travelControls}
                    worldName={travelTitle}
                    phase={journey.phase}
                    admitted={journey.admitted}
                    leaving={revealing}
                    onCancel={cancelJourney}
                />
            )}
        </>
    );
}

const LobbySurface = styled.div`
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 4;
    &[data-travelling] {
        z-index: 20;
    }
    &[data-entered],
    &[data-revealing],
    &[data-return-preparing] {
        visibility: hidden;
    }
    &[data-travelling] > :not(.room) {
        visibility: hidden;
        pointer-events: none;
    }
    color: #fff;
    font-family: var(--oc-font);
    font-size: 14px;
    .native-icon {
        display: block;
        flex-shrink: 0;
        filter: invert(1);
    }
    .room {
        position: absolute;
        inset: 0;
        z-index: 1;
        background: #050607;
        opacity: 0;
        transition: opacity 1200ms cubic-bezier(0.22, 0.75, 0.2, 1);
        pointer-events: auto;
    }
    &[data-portal-live] .room {
        background: transparent;
    }
    &[data-ready] .room {
        opacity: 1;
    }
    button,
    a {
        -webkit-tap-highlight-color: transparent;
    }
    button {
        font: inherit;
        cursor: pointer;
        color: inherit;
    }
    button:disabled {
        opacity: 0.42;
        cursor: default;
    }
    button:focus-visible,
    a:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 3px;
    }
    .arrival,
    .scene-error {
        position: absolute;
        z-index: 4;
        top: 49%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: #a6aab3;
    }
    .arrival span {
        display: block;
        font-size: 12px;
        margin-top: 8px;
        opacity: 0.6;
    }
    .lobby-announcement {
        /* For assistive technology only: the visible copy is the toast. */
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        clip-path: inset(50%);
        white-space: nowrap;
    }
    .scene-error {
        pointer-events: auto;
        color: #fff;
        width: min(440px, calc(100% - 48px));
        padding: 28px;
        border-radius: 8px;
        background: rgba(7, 7, 7, 0.78);
    }
    .scene-error h1 {
        font-size: 20px;
        font-weight: 400;
    }
    .scene-error p {
        line-height: 1.5;
        color: #ccc;
    }
    .scene-error button {
        border: 0;
        background: #ffffff20;
        padding: 12px;
        border-radius: 6px;
        margin: 8px 4px 0;
    }
    .lobby-controls {
        position: absolute;
        inset: 0;
        z-index: 4;
        opacity: 0;
        transition: opacity 600ms ease 350ms;
        pointer-events: none;
    }
    .lobby-controls[data-visible] {
        opacity: 1;
    }
    .lobby-controls[data-search] {
        z-index: 6;
    }
    .lobby-dock {
        --lobby-dock-width: 264px;
        --lobby-dock-height: 40px;
        position: absolute;
        left: 50%;
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
        width: var(--lobby-dock-width);
        height: var(--lobby-dock-height);
        max-width: calc(100% - 32px);
        transform: translateX(-50%);
        transition: width 240ms cubic-bezier(0.22, 0.75, 0.2, 1),
            height 240ms cubic-bezier(0.22, 0.75, 0.2, 1);
        pointer-events: auto;
    }
    .lobby-dock[data-explore] {
        width: 356px;
        height: var(--lobby-dock-height);
    }
    /* Panels stay centered even when the compact toolbar sits on the right.
       Keep this anchor through the search panel's closing animation. */
    .lobby-controls[data-search] .lobby-dock {
        left: 50%;
        right: auto;
        transform: translateX(-50%);
    }
    &[data-avatar-picker] .lobby-controls {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
    }
    .dock-bar {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        opacity: 1;
        transform: scale(1);
        transition: opacity 180ms ease,
            transform 240ms cubic-bezier(0.22, 0.75, 0.2, 1);
    }
    .lobby-dock[data-explore] .dock-bar {
        opacity: 0;
        transform: scale(0.92);
        pointer-events: none;
    }
    .flash-status {
        position: absolute;
        bottom: calc(100% + 18px);
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: min(440px, calc(100vw - 32px));
        padding: 10px 12px 10px 16px;
        border: 1px solid #ffffff18;
        border-radius: 14px;
        background: #191919ed;
        color: #d5d4ce;
        font-size: 12px;
        white-space: nowrap;
    }
    .flash-status span {
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .flash-status button {
        flex-shrink: 0;
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid #ffffff20;
        border-radius: 8px;
        color: #f3f3f1;
        background: #ffffff0b;
        cursor: pointer;
        font: inherit;
    }
    .flash-status button:focus-visible {
        outline: 2px solid #3975ff;
        outline-offset: 3px;
    }
    ${lobbyDockStyles}
    .text-right-subtract-panel {
        position: absolute;
        right: -5px;
        bottom: -5px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        min-width: 20px;
        height: 16px;
        padding: 0 4px;
        border: 1px solid #ffffff18;
        border-radius: 6px;
        background: #14161b;
        color: #c2c5cc;
        font-size: 9px;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        pointer-events: none;
    }
    .text-right-subtract-panel .dot {
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: #2cf8d5;
    }
    .text-right-subtract-panel .dot.red {
        background: #ff6161;
    }
    .lobby-chat {
        position: absolute;
        left: 24px;
        bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
        width: 340px;
        max-width: calc(50vw - 170px);
        max-height: 50vh;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        pointer-events: auto;
    }
    ${conversationStyles}
    .native-panel {
        position: absolute;
        z-index: 6;
        bottom: max(82px, calc(env(safe-area-inset-bottom) + 74px));
        left: 50%;
        transform: translateX(-50%);
        width: 390px;
        max-width: calc(100% - 32px);
        background: rgba(20, 20, 20, 0.88);
        backdrop-filter: blur(16px);
        border-radius: 8px;
        pointer-events: auto;
        box-shadow: 0 8px 30px #00000018;
    }
    .panel-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 17px 20px 12px;
    }
    h2 {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.4;
    }
    .panel-heading button,
    .cancel-journey {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border: 1px solid #ffffff18;
        border-radius: 10px;
        background: #14161bcc;
        padding: 6px;
        transition: background 180ms ease;
    }
    .panel-heading button:hover,
    .cancel-journey:hover {
        background: #22252de6;
    }
    .panel-note {
        margin: 4px 20px 20px;
        color: #b0b0b0;
        font-size: 12px;
    }
    .journey-panel {
        width: 450px;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
    }
    .journey-copy {
        flex: 1;
        min-width: 0;
    }
    .eyebrow {
        display: block;
        font: 9px var(--oc-mono);
        letter-spacing: 0.12em;
        color: #a8aaa5;
        margin-bottom: 7px;
    }
    .journey-copy h2 {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .journey-copy p {
        margin: 7px 0 0;
        color: #b8bbb3;
        font-size: 12px;
        line-height: 1.4;
    }
    .enter {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 16px;
        background: #fff;
        color: #151515;
        border: 0;
        border-radius: 5px;
    }
    .enter .native-icon {
        filter: none;
    }
    .journey-error-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 12px;
    }
    .journey-error-actions button,
    .journey-error-actions a {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        background: none;
        padding: 0;
        border: 0;
        color: #fff;
    }
    .loader {
        height: 19px;
        width: 19px;
        flex-shrink: 0;
        border: 1px solid #ffffff30;
        border-top-color: #fff;
        border-radius: 50%;
        animation: lobby-spin 1s linear infinite;
    }
    .connection-notice,
    .voice-notice {
        position: absolute;
        z-index: 5;
        left: 50%;
        bottom: 82px;
        transform: translateX(-50%);
        max-width: calc(100% - 40px);
        width: max-content;
        color: #fff;
        background: rgba(7, 7, 7, 0.65);
        border-radius: 6px;
        padding: 10px 14px;
        font-size: 12px;
        line-height: 1.5;
        pointer-events: auto;
    }
    .connection-notice button {
        border: 0;
        background: transparent;
        text-decoration: underline;
        margin-left: 8px;
    }
    .voice-notice {
        bottom: 125px;
    }
    .voice-notice[data-search] {
        top: max(84px, calc(env(safe-area-inset-top) + 76px));
        bottom: auto;
    }
    @keyframes lobby-spin {
        to {
            transform: rotate(360deg);
        }
    }
    @media (max-width: 850px) {
        .dock-secondary {
            display: none;
        }
        .lobby-dock {
            --lobby-dock-width: 184px;
            left: auto;
            right: 16px;
            transform: none;
        }
        .dock-bar {
            gap: 6px;
        }
        .lobby-chat {
            width: min(340px, calc(100% - 32px));
            max-width: calc(100% - 32px);
            left: 16px;
            bottom: max(80px, calc(env(safe-area-inset-bottom) + 72px));
        }
        .native-panel {
            bottom: max(146px, calc(env(safe-area-inset-bottom) + 138px));
        }
        .connection-notice {
            bottom: 144px;
        }
        .voice-notice {
            bottom: 190px;
        }
    }
    @media (max-width: 680px) {
        .lobby-dock {
            --lobby-dock-width: 194px;
            --lobby-dock-height: 44px;
        }
    }
    @media (max-width: 550px) {
        .lobby-dock {
            /* Search replaces chat, so it can use the bottom composer row. */
            --explore-bottom: calc(
                max(20px, env(safe-area-inset-bottom) + 8px) -
                    max(76px, env(safe-area-inset-bottom) + 68px)
            );
            --lobby-dock-width: 194px;
            left: 50%;
            right: auto;
            bottom: max(76px, calc(env(safe-area-inset-bottom) + 68px));
            transform: translateX(-50%);
        }
        .chat-log {
            max-height: 32vh;
        }
        .dock-bar {
            gap: 6px;
        }
        .dock-button {
            width: 44px;
            height: 44px;
        }
        .dock-item > span {
            display: none;
        }
        .chat-composer {
            height: 44px;
        }
        .chat-input-bar input {
            font-size: 16px;
        }
    }
    @media (max-width: 360px) {
        .dock-bar {
            gap: 4px;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .lobby-chat[data-view-phase] .chat-view {
            opacity: 1;
            transform: none;
            transition: none;
        }
        .room,
        .lobby-controls,
        .lobby-dock,
        .dock-bar,
        .chat-input-bar,
        .chat-people-toggle,
        .dock-item > span,
        .chat-shortcut,
        .lobby-dock-icon,
        .panel-heading button,
        .cancel-journey,
        .dock-button {
            transition: none;
        }
        .loader {
            animation-duration: 2s;
        }
    }
`;

const VoiceLivePill = styled.button`
    ${lobbyPanelSurface}
    position: absolute;
    z-index: 21;
    left: 50%;
    bottom: max(82px, calc(env(safe-area-inset-bottom) + 74px));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100% - 32px);
    min-height: 32px;
    padding: 0 14px;
    border-radius: 999px;
    color: #f3f3f1;
    font: 12px var(--oc-font, sans-serif);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    pointer-events: auto;
    span {
        width: 6px;
        height: 6px;
        flex-shrink: 0;
        border-radius: 50%;
        background: #ff5a4f;
    }
    &:focus-visible {
        outline: 2px solid var(--oc-accent, #2567ff);
        outline-offset: 2px;
    }
    @media (max-width: 850px) {
        bottom: max(146px, calc(env(safe-area-inset-bottom) + 138px));
    }
`;

const DestinationFrame = styled.iframe`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    z-index: 19;
    background: #050607;
    opacity: 0;
    pointer-events: none;
    &[data-visible] {
        opacity: 1;
    }
    &[data-portal-preview] {
        opacity: 1;
        z-index: 3;
    }
    &[data-entered] {
        pointer-events: auto;
    }
`;

const PortalHint = styled.div`
    position: absolute;
    z-index: 4;
    left: 50%;
    top: 96px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100% - 32px);
    padding: 8px 8px 8px 16px;
    border: 1px solid #ffffff2e;
    border-radius: 999px;
    background: #0a0d12a8;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    color: #c2c2bd;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: auto;
    strong {
        overflow: hidden;
        text-overflow: ellipsis;
        color: #f3f3f1;
        font-weight: 500;
    }
    button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #f3f3f1;
        font: inherit;
        cursor: pointer;
    }
    button:hover {
        background: #ffffff12;
    }
    kbd {
        padding: 0 4px;
        border: 1px solid #ffffff30;
        border-radius: 4px;
        font: 10px/14px var(--oc-mono, monospace);
        color: #93938e;
    }
`;

async function fetchSpacePanorama(id: string): Promise<string | undefined> {
    try {
        const response = await fetch(
            `/api/exhibit?type=FETCH_SINGLE_EXHIBIT&id=${encodeURIComponent(
                id
            )}`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: "{}",
            }
        );
        if (!response.ok) return undefined;
        const { exhibit } = await response.json();
        const value = exhibit?.info?.cHeroImg360;
        if (typeof value !== "string" || !value.trim()) return undefined;
        const source = value.trim();
        if (source.startsWith("ipfs://"))
            return `https://cyber.mypinata.cloud/ipfs/${source.slice(7)}`;
        return /^https:\/\//.test(source) ? source : undefined;
    } catch {
        return undefined;
    }
}
