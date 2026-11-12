import Icon from "@components/Icon";

import { NButton } from "@features/studio/components/StudioButton";
import { useSyncState } from "@components/hooks/useSyncState";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import IconImg from "@ui/components/IconImg";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";

export function HTMLArtworkToggle() {
    //
    const selectedMesh = useSelectedArtwork();

    const { handleChangeHTMLView } = useEditWorld();

    const [isHtmlViewEnabled, toggleHTMLView] = useSyncState(
        selectedMesh?.userData?.enableHTMLView
    );

    const handleHTMLViewChange = useEventCallback(
        async (enableHTMLView: boolean) => {
            //
            toggleHTMLView(enableHTMLView);

            handleChangeHTMLView({ enableHTMLView });
        },
        []
    );

    return (
        <NButton
            style={{
                width: "100%",
                border: "1px solid #777980",
                color: "#777980",
                background: "none",
                borderRadius: "30px",
                marginBottom: 16,
                fontWeight: 400,
            }}
            overrideTheme={"light"}
            // active={isHtmlViewEnabled}
            outline={true}
            onClick={() => handleHTMLViewChange(!isHtmlViewEnabled)}
        >
            {!isHtmlViewEnabled ? (
                <>
                    <IconImg name="play" size={16} className="icon-invert" />
                    &nbsp;&nbsp;&nbsp;
                    <span>Play animation (impacts perf)</span>
                </>
            ) : (
                <>
                    <IconImg name="pause" size={16} className="icon-invert" />
                    &nbsp;&nbsp;&nbsp;&nbsp;
                    <span>Pause animation (better perf)</span>
                </>
            )}
        </NButton>
    );
}
