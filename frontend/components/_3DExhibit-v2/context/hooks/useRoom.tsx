import type { MultiplayerStartupResources } from "../multiplayerStartup";
import { readLobbyGroupCohort } from "@utils/lobbyGroupContext";
import { UserContext } from "@components/context/UserContext";
import { Experience } from "@uitypes/experience";
import { useRouter } from "next/router";
import {
    Dispatch,
    SetStateAction,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { formatAvatar } from "@components/_3DExhibit-v2/utils/avatar";
import SocialApi from "@api/social/_api";

export interface RoomReturn {
    id: string;
    setRoomId: Dispatch<SetStateAction<string>>;
    error: string;
    label: string;
    isMod: boolean;
    canEdit: boolean;
    loading: boolean;
    currentExhibit: Partial<Experience>;
    joinRoom: (
        _label: any,
        token: string,
        opts: any,
        exhibit: Experience,
        preparedAvatar?: string,
        controller?: AbortController,
        service?: any
    ) => Promise<any>;
    init: (
        exhibit: Experience,
        opts: any,
        roomOpts: {
            label: string;
            isMod: boolean;
            avatar?: string;
            signal?: AbortSignal;
        },
        startup?: Pick<MultiplayerStartupResources, "roomService">
    ) => Promise<{
        roomId: string;
        isMod: boolean;
        sessionId: string;
        exhibit: Experience;
        label: string;
        isAnon: boolean;
    }>;
    dispose: () => Promise<void>;
    active: boolean;
    /** The joined room closed without us leaving it: a drop or a removal. */
    lost: boolean;
    numOfUsers: number;
    sessionId: string;
    failedToJoin: boolean;
}

export default function useRoom({ userId, MultiplayerService }) {
    const router = useRouter();

    const abortController = useRef<AbortController>(null);
    const mounted = useRef(true);
    const ownedRoom = useRef<any>(null);
    const removeStateListener = useRef<() => void>();
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            void dispose();
        };
    }, []);

    const isCurrent = (controller: AbortController) =>
        mounted.current &&
        !controller.signal.aborted &&
        abortController.current === controller;
    const checkCurrent = (controller: AbortController) => {
        if (!isCurrent(controller))
            throw new DOMException("Room join cancelled", "AbortError");
    };

    const [active, setActive] = useState(false);

    const [lost, setLost] = useState(false);

    const [roomId, setRoomId] = useState("");

    const [error, setError] = useState("");

    const [label, setLabel] = useState("");

    const [isMod, setIsMod] = useState(false);

    const [canEdit, setCanEdit] = useState(false);

    const [loading, setLoading] = useState(true);

    const [sessionId, setSessionId] = useState("");

    const [numOfUsers, setNumOfUsers] = useState(0);

    const [failedToJoin, setFailedToJoin] = useState(false);

    const { userData, token, dispatch } = useContext(UserContext);

    const [currentExhibit, setCurrentExhibit] =
        useState<Partial<Experience>>(null);

    async function joinRoom(
        _label = null,
        token: string = "",
        opts,
        exhibit,
        preparedAvatar?: string,
        controller = abortController.current,
        service = MultiplayerService.current.roomService
    ) {
        const avatarImg =
            preparedAvatar ??
            (await formatAvatar(
                userData,
                (action) => {
                    if (isCurrent(controller)) dispatch(action);
                },
                exhibit
            ));
        checkCurrent(controller);
        const colyseusRoom = await service.joinMatch(
            "cyber",
            {
                label: _label,
                username: userData?.username || "",
                avatar: avatarImg,
                userId,
                token,
                currentSpace: opts.currentSpace,
                ...opts,
                lobbyGroupCohort: readLobbyGroupCohort(),
            },
            controller
        );
        if (!isCurrent(controller)) {
            // Release this late seat only; never disconnect a newer room.
            if (colyseusRoom && service.room === colyseusRoom)
                await service.leaveMatch();
            else if (colyseusRoom?.leave)
                void Promise.resolve(colyseusRoom.leave(true)).catch(() => {});
            checkCurrent(controller);
        }
        if (!colyseusRoom) throw new Error("Failed to join multiplayer mode");
        ownedRoom.current = colyseusRoom;
        return { ...colyseusRoom, id: _label };
    }

    async function init(
        exhibit: Experience,
        opts: any,
        roomOpts: {
            label: string;
            isMod: boolean;
            avatar?: string;
            signal?: AbortSignal;
        },
        startup?: Pick<MultiplayerStartupResources, "roomService">
    ) {
        const { label, isMod } = roomOpts;
        abortController.current?.abort();
        removeStateListener.current?.();
        removeStateListener.current = undefined;
        const controller = new AbortController();
        abortController.current = controller;
        const cancel = () => controller.abort();
        roomOpts.signal?.addEventListener("abort", cancel, { once: true });
        if (roomOpts.signal?.aborted) cancel();
        try {
            checkCurrent(controller);
            setRoomId(label);
            setLabel(label);
            setError("");
            setFailedToJoin(false);
            setLost(false);
            setLoading(true);

            let service = MultiplayerService.current.roomService;
            if (!service) {
                service = (
                    await (startup?.roomService || import("@utils/arena"))
                ).default;
                checkCurrent(controller);
                MultiplayerService.current.roomService = service;
            }
            checkCurrent(controller);
            setCurrentExhibit(exhibit);
            const room = await joinRoom(
                label,
                token,
                opts,
                exhibit,
                roomOpts.avatar,
                controller,
                service
            );
            checkCurrent(controller);
            setIsMod(isMod);
            setCanEdit(isMod);
            setSessionId(room.sessionId);
            setActive(true);
            const remove = service.room?.onStateChange((state) => {
                if (isCurrent(controller))
                    setNumOfUsers(state?.numOfUsers || 0);
            });
            if (typeof remove === "function")
                removeStateListener.current = remove;
            // Our own leave aborts this controller first, so what reaches
            // here is the server or the network closing the room.
            service.room?.onLeave?.(() => {
                if (isCurrent(controller)) setLost(true);
            });
            return {
                roomId: room.id,
                isMod,
                sessionId: room.sessionId,
                exhibit,
                label,
                isAnon: !userData?.username,
            };
        } catch (err) {
            if (isCurrent(controller)) {
                setFailedToJoin(true);
                setError(err?.message || "Failed to join multiplayer mode");
            }
        } finally {
            roomOpts.signal?.removeEventListener("abort", cancel);
            if (isCurrent(controller)) setLoading(false);
        }
    }

    async function dispose() {
        abortController.current?.abort();
        abortController.current = null;
        removeStateListener.current?.();
        removeStateListener.current = undefined;
        // Reset before awaiting leave so an older disposal cannot reset a retry.
        if (mounted.current) {
            setIsMod(false);
            setCanEdit(false);
            setLoading(false);
            setActive(false);
            setLost(false);
            setNumOfUsers(0);
        }
        const connection = ownedRoom.current;
        ownedRoom.current = null;
        const service = MultiplayerService.current?.roomService;
        if (connection && service?.room === connection)
            await service.leaveMatch(roomId);
        else if (connection?.leave)
            void Promise.resolve(connection.leave(true)).catch(() => {});
    }

    return {
        id: roomId,
        setRoomId,
        error,
        label,
        isMod,
        canEdit,
        loading,
        currentExhibit,
        joinRoom,
        init,
        dispose,
        active,
        lost,
        numOfUsers,
        sessionId,
        setIsMod,
        failedToJoin,
    };
}
