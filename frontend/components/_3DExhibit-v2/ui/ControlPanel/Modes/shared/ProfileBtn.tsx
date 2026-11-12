import { UserContext } from "@components/context/UserContext";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import {
    DEFAULT_PLAYER_AVATAR_PICTURE,
    IS_MOBILE,
} from "@components/_3DExhibit-v2/three/constants";
import Avatar from "@ui/components/Avatar";
import { useContext, useEffect, useRef, useState } from "react";
import { EventCallbacks, Events } from "@utils/voiceChat/types";
import { usePanel } from "../../context/PanelProvider";
import { ControlPanelIcon } from "./styles";
import styled from "styled-components";
import { useVrm } from "@components/context/VrmContext";
import { useCyberTranslation } from "@components/context/I18nContext";

export default function ProfileBtn() {
    const { user, userData } = useContext(UserContext);

    const [showTip, setShowTip] = useState(true);

    const {
        currentTab,
        setSelectedUser,
        setCurrentTab,
        addTogglerRef,
        exhibit,
        settings,
        handleSettings,
        setActiveProfileTab,
    } = usePanel();

    const { disableCancel } = useVrm();

    const { t } = useCyberTranslation();

    const { voice, room } = useMultiplayer();

    const { voiceService, voiceUsers } = voice;

    const { sessionId } = room;

    const avatarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        //

        if (voiceService == null) return;

        const handleVolumeIndicator: EventCallbacks["VOLUME_INDICATOR"] = ({
            channel,
            volumes,
        }) => {
            if (channel !== "mic" || avatarRef.current == null) return;

            let _isSpeaking = false;

            const vol = volumes[sessionId];

            if (vol?.isActive) {
                _isSpeaking = true;
            }

            avatarRef.current.classList.toggle("speaking", _isSpeaking);
        };

        voiceService.on(Events.VOLUME_INDICATOR, handleVolumeIndicator);

        return () => {
            voiceService.off(Events.VOLUME_INDICATOR, handleVolumeIndicator);
        };
        //
    }, [sessionId, voiceService]);

    return (
        <ControlPanelIcon
            isMobile={IS_MOBILE}
            ref={(el) => addTogglerRef("profile", el)}
            onMouseEnter={() => {
                if (currentTab !== "profile") {
                    setCurrentTab("");
                }
            }}
            className="control-panel_icon"
        >
            <span>{t`PROFILE_SETTINGS`}</span>

            <AvatarWrapper
                ref={avatarRef}
                onClick={async () => {
                    setSelectedUser({});
                    setActiveProfileTab("profile");

                    if (settings.camera !== "third_person") {
                        handleSettings("camera", "third_person");
                    }

                    if (!disableCancel) {
                        setCurrentTab((state) =>
                            state === "profile" ? "" : "profile"
                        );
                    }
                }}
                // onMouseEnter={() => {
                //     if (!IS_MOBILE) {
                //         setSelectedUser({});
                //         setCurrentTab((state) =>
                //             state === "settings" ? "" : "settings"
                //         );
                //     }
                // }}
            >
                <Avatar
                    style={{ border: "none", cursor: "pointer" }}
                    size="mediumplus"
                    title={userData?.username || user.id}
                    src={
                        userData?.avatar ||
                        exhibit?.params?.pfp?.avatar ||
                        DEFAULT_PLAYER_AVATAR_PICTURE
                    }
                />
            </AvatarWrapper>
        </ControlPanelIcon>
    );
}

const AvatarWrapper = styled.div`
    border: 1px solid transparent;
    box-sizing: initial;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(7, 7, 7, 0.6);

    transition: 0.2s;

    &:hover {
        filter: brightness(95%);
        transform: scale(1.05);
    }

    &.speaking {
        border: 1px solid #00e3bd;
    }
`;
