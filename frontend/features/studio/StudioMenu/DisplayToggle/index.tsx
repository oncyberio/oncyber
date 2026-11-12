import IconImg from "@ui/components/IconImg";
import styled from "styled-components";
import { useStudioMenu, WorldModeStatus } from "../context/StudioContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import Spinner from "@ui/components/Spinner";
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

export function PlayToggle() {
    //
    const {
        getModeStatus,
        worldMode,
        setWorldMode,
        baseAnalyticsEvent,
        toggleAuth,
    } = useStudioMenu();

    const { isAnonymous } = useContext(UserContext);

    const status = getModeStatus("display");

    const handleClick = useEventCallback(() => {
        //

        if (isAnonymous) {
            return toggleAuth();
        }

        if (status === "switching") return;

        if (worldMode === "display") {
            //
            setWorldMode("edit");

            amplitude_logAnalyticsEvent("close_display", baseAnalyticsEvent);
            //
        } else {
            //
            setWorldMode("display");

            amplitude_logAnalyticsEvent("visit_display", baseAnalyticsEvent);
        }
        //
    }, []);

    return (
        <Container>
            {status !== "active" && (
                <FullLabel onClick={handleClick}>
                    <Tooltip
                        text="Toggle visitor mode"
                        orientation="bottom"
                        isToggled={false}
                    >
                        <LabelledIcon toggled={false} name="play" />
                    </Tooltip>
                </FullLabel>
            )}

            {status === "active" && (
                <>
                    <Button onClick={handleClick}>Exit Visitor Mode</Button>
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

const Button = styled.div`
    border: none;
    margin: 0;
    outline: none;
    padding: 9px 16px;

    cursor: pointer;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 900px;
    font-size: 14px;
    font-weight: 500;
`;
