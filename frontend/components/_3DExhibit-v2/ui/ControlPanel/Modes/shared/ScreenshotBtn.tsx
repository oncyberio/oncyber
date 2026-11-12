import { useCyberTranslation } from "@components/context/I18nContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { IconButton } from "@ui/components/IconButton";
import { usePanel } from "../../context/PanelProvider";
import { ControlPanelIcon } from "./styles";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

export default function ScreenshotBtn() {
    const { setCurrentTab, addTogglerRef, currentTab, getBaseAnalytics } =
        usePanel();

    const { t } = useCyberTranslation();

    const world = useWorld();

    function handleClick() {
        setCurrentTab("");

        amplitude_logAnalyticsEvent("take_screenshot", {
            source: "click",
            ...getBaseAnalytics(),
        });

        const data = world.current.takeScreenshot({
            color: null,
            download: true,
        });
        console.log(data);
    }

    return (
        <ControlPanelIcon
            isMobile={IS_MOBILE}
            ref={(el) => addTogglerRef("screenShot", el)}
            onMouseEnter={() => {
                if (currentTab !== "screenShot") {
                    setCurrentTab("");
                }
            }}
        >
            {!IS_MOBILE ? (
                <span>
                    {t`SCREENSHOT`} <span>(B)</span>
                </span>
            ) : null}

            <IconButton
                onClick={handleClick}
                onTouchStart={handleClick}
                mode="light"
                name="camera"
                variants="studio"
                size="medium-plus"
                className="icon-btn-panel"
            />
        </ControlPanelIcon>
    );
}
