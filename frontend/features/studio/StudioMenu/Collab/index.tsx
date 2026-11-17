import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import IconImg from "@ui/components/IconImg";
import { Collaborate } from "./Collaborate";
import Tooltip from "@ui/components/Tooltip";
import { ToolbarButton } from "../components/ToolbarButton";
import { tx } from "@components/context/I18nContext";

export function Collab({ className = "" }) {
    //
    const caption = ({ toggled }) => (
        <Tooltip
            text={tx("Add Collaborators")}
            orientation="bottom"
            isToggled={toggled}
        >
            <ToolbarButton
                toggled={toggled}
                aria-label={tx("Collaborators")}
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
