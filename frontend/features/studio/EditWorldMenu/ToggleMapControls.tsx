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
import { tx } from "@components/context/I18nContext";

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
                role="button"
                title={tx("Perspective")}
                aria-pressed={!isEnabled}
                onClick={handleClick}
            >
                <IconImg className="tmc-icon" name="map-view" size={20} />
                <span>{tx("Perspective")}</span>
            </div>
            <div
                className={classes({ btn: true, active: isEnabled })}
                role="button"
                title={tx("Map view")}
                aria-pressed={!!isEnabled}
                onClick={() => handleClick(false)}
            >
                <IconImg
                    className="tmc-icon"
                    name="perspective-view"
                    size={20}
                />
                <span>{tx("Map view")}</span>
            </div>
        </Container>
    );
}

/* A segmented icon switch in the studio's control style (like the library
   tabs): 40px tall, the selected view raised on the surface colour. */
const Container = styled.div<{ isToggling: boolean }>`
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 1000;

    box-sizing: border-box;
    display: flex;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--studio-line, #303035);
    border-radius: var(--studio-radius-control, 10px);
    background: var(--studio-inset, #101012);
    box-shadow: var(--panel-shadow);

    transition: opacity 0.2s ease-in-out;
    opacity: ${({ isToggling }) => (isToggling ? 0.3 : 1)};

    user-select: none;

    & > .btn {
        position: relative;
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        margin: 0;
        padding: 0;
        border-radius: 7px;
        cursor: pointer;
        transition: background-color 150ms ease;

        /* The label stays for screen readers; title shows it on hover. */
        & > span {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
        }
        &:hover {
            background: var(--studio-hover, #28282c);
        }
    }

    & .tmc-icon {
        width: 18px;
        height: 18px;
        filter: invert(0.55);
    }

    & > .btn.active {
        background: var(--studio-surface, #1c1c1f);
        box-shadow: var(--studio-edge), 0 1px 3px #00000033;

        & .tmc-icon {
            filter: invert(0.95);
        }
    }

    /* Phones: stacked under the world contents button, clear of the
       bottom sheets. */
    @media (max-width: 600px) {
        top: 124px;
        right: 12px;
        bottom: auto;
        z-index: 1;
        flex-direction: column;
    }
`;
