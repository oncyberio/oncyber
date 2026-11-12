import { studioAction } from "@features/studio/styles/primitives";
import IconImg from "@ui/components/IconImg";
import styled from "styled-components";
import { useStudioMenu, WorldModeStatus } from "../context/StudioContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import Spinner from "@ui/components/Spinner";
import { CinematicUI } from "./Cinematic";
import { LabelledIcon } from "../components/LabeledIcon";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UserContext } from "@components/context/UserContext";
import { useContext } from "react";
import Tooltip from "@ui/components/Tooltip";

const icons: Record<WorldModeStatus, React.ReactNode> = {
    inactive: (
        <IconImg name="video" size={24} style={{ filter: "invert(0.5)" }} />
    ),
    active: <IconImg name="video" size={24} style={{ filter: "invert(1)" }} />,
    switching: <Spinner width={24} />,
};

export function CinematicToggle() {
    //
    const {
        getModeStatus,
        worldMode,
        setWorldMode,
        baseAnalyticsEvent,
        toggleAuth,
    } = useStudioMenu();

    const { isAnonymous } = useContext(UserContext);

    const status = getModeStatus("cinematic");

    const handleClick = useEventCallback(() => {
        //

        if (isAnonymous) {
            return toggleAuth();
        }

        if (status === "switching") return;

        if (worldMode === "cinematic") {
            //
            setWorldMode("edit");

            amplitude_logAnalyticsEvent("close_cinematic", baseAnalyticsEvent);
            //
        } else {
            //
            setWorldMode("cinematic");

            amplitude_logAnalyticsEvent("visit_cinematic", baseAnalyticsEvent);
        }
        //
    }, []);

    return (
        <Container>
            <FullLabel onClick={handleClick}>
                {status !== "active" && (
                    <Tooltip
                        text="Export Video Teaser"
                        orientation="bottom"
                        isToggled={false}
                    >
                        <LabelledIcon toggled={false} name="video" />
                    </Tooltip>
                )}
                {/* {status == "active" && <IconImg name="eye-off" mode="light" size={20} />} */}
            </FullLabel>

            {status === "active" && (
                <>
                    <Button onClick={handleClick}>Exit Cinematic</Button>
                    <CinematicUI />
                </>
            )}
        </Container>
    );
}

const Container = styled.div`
    & > .icon {
        cursor: pointer;
    }
`;

const FullLabel = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
`;

const Button = styled.button.attrs({ type: "button" })`
    ${studioAction}
    border: none;
    margin: 0;
    padding: 9px 16px;

    cursor: pointer;
    color: #ffffff;
    background: var(--studio-surface, #1c1c1f);
    border-radius: 8px;
    font: 13px/20px var(--studio-font, sans-serif);
    font-weight: 500;
`;
