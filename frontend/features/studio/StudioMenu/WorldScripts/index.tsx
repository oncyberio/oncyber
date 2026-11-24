import dynamic from "next/dynamic";
import { useContext } from "react";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import { UserContext } from "@components/context/UserContext";
import Tooltip from "@ui/components/Tooltip";
import { LabelledIcon } from "../components/LabeledIcon";
import { useStudioMenu } from "../context/StudioContext";
import { WORLD_SCRIPTS_ENABLED } from "@features/world-scripts/store";

const ScriptsPanel = dynamic(
    () => import("@features/world-scripts/ScriptsPanel"),
    {
        ssr: false,
    }
);
const WorldScriptLayer = dynamic(
    () => import("@features/world-scripts/WorldScriptLayer"),
    {
        ssr: false,
    }
);

/** The toolbar's Scripts button and the layer that runs the script. Off unless NEXT_PUBLIC_WORLD_SCRIPTS is on. */
export function WorldScripts() {
    const { isAnonymous } = useContext(UserContext);
    const { exhibit } = useStudioMenu();
    if (!WORLD_SCRIPTS_ENABLED || isAnonymous || !exhibit) return null;
    const caption = ({ toggled }) => (
        <Tooltip
            text="Scripts and games"
            isToggled={toggled}
            orientation="bottom"
        >
            <LabelledIcon toggled={toggled} name="code" label={null} />
        </Tooltip>
    );
    return (
        <>
            <WorldScriptLayer experience={exhibit} />
            <CustomDropdown caption={caption} placement="free">
                {({ toggle }) => <ScriptsPanel onClose={() => toggle(false)} />}
            </CustomDropdown>
        </>
    );
}
