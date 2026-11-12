import NativeVisitorPanel, {
    nativePanelTitles,
} from "@features/content-host/NativeVisitorPanel";
import React from "react";
import dynamic from "next/dynamic";
import { usePanel } from "../../../context/PanelProvider";
import { useEventCallback } from "@components/hooks/useEventCallback";
import useFeed from "@components/hooks/useFeed";

const UsersList = dynamic(
    () => import("@components/_3DExhibit-v2/ui/ControlPanel/Modals/Users")
);

const Settings = dynamic(
    () => import("@components/_3DExhibit-v2/ui/ControlPanel/Settings")
);

const Feedback = dynamic(
    () => import("@components/_3DExhibit-v2/ui/ControlPanel/Modals/Feedback")
);

const Report = dynamic(
    () => import("@components/_3DExhibit-v2/ui/ControlPanel/Modals/Report")
);

const VoiceRequests = dynamic(
    () =>
        import("@components/_3DExhibit-v2/ui/ControlPanel/Modals/VoiceRequests")
);

const Profile = dynamic(
    () => import("@components/_3DExhibit-v2/ui/ControlPanel/Profile")
);

const Explore = dynamic(
    () => import("@components/_3DExhibit-v2/ui/ControlPanel/Modals/Explore")
);

const ProfileExplore = dynamic(
    () => import("@components/_3DExhibit-v2/ui/ControlPanel/Profile/Explore")
);

export default function Modals() {
    const { currentTab, setCurrentTab, addTogglerRef } = usePanel();

    const handleClose = useEventCallback(() => {
        setCurrentTab("");
    }, []);

    const feed = useFeed({
        initialize: false,
    });

    if (currentTab === "profile") return <Profile isShowing />;

    return (
        <NativeVisitorPanel
            title={nativePanelTitles[currentTab] || "Space options"}
            onClose={handleClose}
        >
            {currentTab === "users" && (
                <UsersList
                    addModalTogglerRef={addTogglerRef}
                    sceneContainer={null}
                    isMobile={true}
                />
            )}

            {currentTab === "feedback" && <Feedback />}

            {currentTab === "settings" && <Settings />}

            {currentTab === "report" && <Report />}

            {currentTab === "voiceRequests" && <VoiceRequests />}

            {currentTab === "explore" && (
                <Explore feed={feed} isMobile={true} />
            )}

            {currentTab === "profile-explore" && (
                <ProfileExplore isMobile={true} />
            )}
        </NativeVisitorPanel>
    );
}
