import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { IS_MAP_VIEW } from "@components/_3DExhibit-v2/three/constants";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSyncState } from "@components/hooks/useSyncState";
import { classes } from "@utils/js";
import { useRef, useState } from "react";
import styled from "styled-components";
import { useCurrentExhibit } from "../context/ExhibitContext";
import { useSelectedComponent, useSelectedItem } from "./hooks/worldHooks";
import IconImg from "@ui/components/IconImg";

export function ToggleMapControls() {
    //
    const target = useSelectedItem();

    const { destination } = useCurrentExhibit();

    const [isEnabled, setIsEnabled] = useSyncState(IS_MAP_VIEW);

    const [isToggling, setIsToggling] = useState(false);

    const world = useWorld();

    const handleClick = useEventCallback(async (enable) => {
        //
        if (isToggling) return;

        try {
            setIsToggling(true);

            setIsEnabled(!isEnabled);

            world.current.toggleMapControls({
                enabled: !isEnabled,
                transition: true,
                target,
            });
            //
        } finally {
            //
            setIsToggling(false);
        }
    }, []);

    if (!destination.isFuture) return null;

    return (
        <Container isToggling={isToggling}>
            <div
                className={classes({ btn: true, active: !isEnabled })}
                onClick={handleClick}
            >
                <IconImg className="tmc-icon" name="map-view" size={20} />
                <span>Perspective</span>
            </div>
            <div
                className={classes({ btn: true, active: isEnabled })}
                onClick={() => handleClick(false)}
            >
                <IconImg
                    className="tmc-icon"
                    name="perspective-view"
                    size={20}
                />
                <span>Map View</span>
            </div>
        </Container>
    );
}

const Container = styled.div<{ isToggling: boolean }>`
    position: fixed;
    bottom: 1em;
    right: 1em;
    z-index: 1000;

    display: flex;
    gap: 2px;

    transition: opacity 0.2s ease-in-out;
    opacity: ${({ isToggling }) => (isToggling ? 0.3 : 1)};

    user-select: none;

    @media (max-width: 600px) {
        bottom: 6em;
        z-index: 1;
    }

    & > .btn {
        border: none;
        margin: 0;
        width: 83px;
        box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.25);
        border-radius: 12px;
        padding: 1rem;
        cursor: pointer;

        font-family: var(--studio-font, sans-serif);
        font-size: 10px;
        font-weight: 400;
        background: var(--world-builder-bg);
        color: #a7a7a7;

        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1rem;

        user-select: none;
    }

    & .tmc-icon {
        filter: invert(0.5);
    }

    & > .btn.active {
        background: #fff;
        color: #000;
        box-shadow: 0px 2px 30px 0px rgba(0, 0, 0, 0.32);

        & .tmc-icon {
            filter: invert(0);
        }
    }
`;
