import { useEventCallback } from "@components/hooks/useEventCallback";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import { IconMenuCaption } from "@features/studio/EditWorldMenu/AddAsset/shared/IconMenuCaption";

import { Action, Dropdown } from "./Dropdown";
import dynamic from "next/dynamic";
import { noop } from "@utils/js";
import { useState } from "react";

const Profile = dynamic(() => import("@components/modals/Profile"));

export function Menu() {
    //
    const [currentModal, setCurrentModal] = useState<"auth" | "profile">(null);

    const [isProfile, set] = useState(false);

    const handleAction = useEventCallback((action: Action) => {
        //
        if (action.type === "open-profile") {
            //
            setCurrentModal("profile");
            //
        }
    }, []);

    const caption = ({ toggled }) => (
        <IconMenuCaption
            toggled={toggled}
            style={{ background: "transparent" }}
        >
            <img
                alt={"Oncyber home page"}
                src="/images/logo.png"
                style={{ width: 48, height: 26 }}
            />
        </IconMenuCaption>
    );

    return (
        <>
            {currentModal === "profile" && (
                <Profile
                    toggle={() => setCurrentModal(null)}
                    isShowing={true}
                    handleSettings={noop}
                />
            )}
            <CustomDropdown caption={caption}>
                {({ toggle }) => (
                    <Dropdown
                        onAction={(action) => {
                            //
                            toggle(false);
                            handleAction(action);
                        }}
                    />
                )}
            </CustomDropdown>
        </>
    );
}
