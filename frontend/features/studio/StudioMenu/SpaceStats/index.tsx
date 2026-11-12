import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import { LabelledIcon } from "../components/LabeledIcon";
import { useStudioMenu } from "../context/StudioContext";
import { UserContext } from "@components/context/UserContext";
import Tooltip from "@ui/components/Tooltip";
import { Stats } from "./Stats";
import { useContext } from "react";

export function SpaceStats() {
    //

    const { isAnonymous } = useContext(UserContext);

    const caption = ({ toggled }) => (
        <Tooltip text="Review Stats" isToggled={toggled} orientation="bottom">
            <LabelledIcon toggled={toggled} name="bar-chart-2" />
        </Tooltip>
    );

    const { exhibit, toggleAuth } = useStudioMenu();

    return (
        <>
            <CustomDropdown
                caption={caption}
                placement="free"
                toggleAuth={isAnonymous && toggleAuth}
            >
                {({ toggle }) => (
                    <Stats exhibit={exhibit} onClose={() => toggle(false)} />
                )}
            </CustomDropdown>
        </>
    );
}
