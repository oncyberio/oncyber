import ProfileBtn from "../shared/ProfileBtn";
import { usePanel } from "../../context/PanelProvider";
import ScreenshotBtn from "../shared/ScreenshotBtn";
import { ControlPanelIcon, PanelContainer } from "../shared/styles";
import ExtraBtn from "../shared/ExtraBtn";

export default function SoloPanel() {
    const { currentTab } = usePanel();

    return (
        <PanelContainer currentTab={currentTab} isModeSolo={true}>
            <ScreenshotBtn />

            <ExtraBtn />

            <ProfileBtn />
        </PanelContainer>
    );
}
