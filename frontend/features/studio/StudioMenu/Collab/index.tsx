import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import IconImg from "@ui/components/IconImg";
import { Collaborate } from "./Collaborate";
import Tooltip from "@ui/components/Tooltip";
import { ToolbarButton } from "../components/ToolbarButton";

export function Collab({ className = "" }) {
    //
    const caption = ({ toggled }) => (
        <Tooltip
            text="Add Collaborators"
            orientation="bottom"
            isToggled={toggled}
        >
            <ToolbarButton
                toggled={toggled}
                aria-label="Collaborators"
                aria-expanded={toggled}
            >
                <IconImg name="user-plus" size={20} mode="light" />
            </ToolbarButton>
        </Tooltip>
    );

    return (
        <CustomDropdown
            caption={caption}
            align="center"
            padding={30}
            className={className}
        >
            {({ toggle }) => {
                //
                return <Collaborate />;
            }}
        </CustomDropdown>
    );
}
