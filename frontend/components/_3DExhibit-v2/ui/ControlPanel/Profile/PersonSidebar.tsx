import { useContext } from "react";
import dynamic from "next/dynamic";
import { UserContext } from "@components/context/UserContext";
import { useCyberTranslation } from "@components/context/I18nContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { TELEPORT_TO_USER } from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";
import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import { usePanel } from "../context/PanelProvider";
import { visitorInWorld, visitorProfile } from "./personSidebar";

const SpaceInfoSidebar = dynamic(
    () => import("@features/space-info/SpaceInfoSidebar"),
    { ssr: false }
);

/**
 * Someone picked inside a space: the same person sidebar as the lobby and
 * the space details, plus Teleport while they are in this world.
 */
export default function PersonSidebar() {
    const { selectedUser, setSelectedUser, setCurrentTab } = usePanel();
    const { userData } = useContext(UserContext);
    const { chat } = useMultiplayer();
    const world = useWorld();
    const { t } = useCyberTranslation();

    const profile = visitorProfile(selectedUser);
    const here = visitorInWorld(
        selectedUser,
        [...(chat?.users || []), ...(chat?.admins || [])],
        userData?.id
    );

    const close = () => {
        setCurrentTab("");
        setSelectedUser({} as any);
    };

    const teleport = () => {
        const response: any = world.current?.handleCommand({
            type: TELEPORT_TO_USER,
            payload: {
                username: here?.userData?.username,
                sessionId: here?.sessionId,
            },
        });
        close();
        if (!response?.success) {
            if (response?.message)
                chat.pushMessage(response.message, CHAT_TYPES.ALERT.label);
            return;
        }
        chat.pushMessage(
            response.summon
                ? t`SUCCESSFULLY_TELEPORTED_TO_SPACE`
                : t`SUCCESSFULLY_TELEPORTED`,
            CHAT_TYPES.INFO.label
        );
    };

    if (!profile) return null;
    const label = t`TELEPORT`;
    return (
        <SpaceInfoSidebar
            id="person-info"
            key={profile.id}
            fallback={{ title: profile.name }}
            initialProfile={profile}
            profileActions={
                here ? (
                    <button type="button" onClick={teleport}>
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                    </button>
                ) : undefined
            }
            onClose={close}
        />
    );
}
