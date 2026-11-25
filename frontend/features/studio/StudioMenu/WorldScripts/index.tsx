import dynamic from "next/dynamic";
import { useContext } from "react";
import { UserContext } from "@components/context/UserContext";
import Tooltip from "@ui/components/Tooltip";
import { LabelledIcon } from "../components/LabeledIcon";
import { useStudioMenu } from "../context/StudioContext";
import {
    offersAiSidebar,
    setWorldScripts,
    useWorldScripts,
    WORLD_SCRIPTS_ENABLED,
} from "@features/world-scripts/store";

const WorldScriptLayer = dynamic(
    () => import("@features/world-scripts/WorldScriptLayer"),
    {
        ssr: false,
    }
);

/** The toolbar's AI button and the layer that runs the script. Off unless NEXT_PUBLIC_WORLD_SCRIPTS is on. */
export function WorldScripts() {
    const { isAnonymous } = useContext(UserContext);
    const { exhibit } = useStudioMenu();
    const state = useWorldScripts();
    const { panelOpen } = state;
    if (!WORLD_SCRIPTS_ENABLED || isAnonymous || !exhibit) return null;
    return (
        <>
            <WorldScriptLayer experience={exhibit} />
            {/* The space's script runs for everyone; the AI is early access. */}
            {offersAiSidebar(state) && <AiButton panelOpen={panelOpen} />}
        </>
    );
}

function AiButton({ panelOpen }: { panelOpen: boolean }) {
    return (
        <Tooltip
            text="Build with AI"
            isToggled={panelOpen}
            orientation="bottom"
        >
            <LabelledIcon
                toggled={panelOpen}
                name="code"
                label={null}
                onClick={() => setWorldScripts({ panelOpen: !panelOpen })}
            />
        </Tooltip>
    );
}
