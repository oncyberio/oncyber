import { useContext, useRef } from "react";
import styled, { css } from "styled-components";

import { Menu } from "./Menu";

import { UserContext } from "@components/context/UserContext";
import { useRouter } from "next/router";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useWorldState } from "@components/_3DExhibit-v2/hooks/useWorldState";
import IconImg from "@ui/components/IconImg";
import { classes } from "@utils/js";
import { NButton } from "@ui/components/NButton";

export function HeaderNav({ onSwitchUI, guiState, isFuture, onSubmit }) {
    //
    const { user, token, isAnonymous } = useContext(UserContext);

    const worldState = useWorldState();

    const router = useRouter();

    const handleSave = useEventCallback(async () => {
        //
        onSubmit();
    }, []);

    const switchBtn = (icon, opt) => {
        const active = opt === guiState;

        return (
            <SwitchUI
                className={classes({ active })}
                onClick={() => {
                    if (active) return;
                    onSwitchUI(opt);
                }}
            >
                <IconImg className="bar-icon" name={icon} size={20} />
                <span>{opt}</span>
            </SwitchUI>
        );
    };

    return (
        <>
            <Container className={worldState.mode}>
                <div className="horz left">
                    <Menu />
                </div>

                <div className="horz center">
                    {!isFuture && switchBtn("settings", "Settings")}
                    {isFuture && switchBtn("world-build", "World")}
                    {switchBtn("video", "Cinematic")}
                </div>

                <div className="horz right">
                    <NButton
                        overrideTheme="dark"
                        size="small"
                        className="action"
                        onClick={handleSave}
                    >
                        Save
                    </NButton>
                </div>
            </Container>
        </>
    );
}

const Container = styled.div`
    //
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    z-index: 2000;
    padding: 16px 24px 16px 32px;
    user-select: none;

    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    align-items: center;

    background: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.8) 0%,
        rgba(0, 0, 0, 0) 100%
    );

    & .horz {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 24px;

        &.left {
            justify-content: flex-start;
        }

        &.center {
            justify-content: center;
        }

        &.right {
            justify-content: flex-end;
        }
    }
`;

const SwitchUI = styled.div<{ isActive?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    backdrop-filter: blur(4px);

    font-weight: 400;
    font-size: 14px;
    color: #f5f5f5;
    cursor: pointer;

    ${(props) =>
        props.isActive &&
        css`
            color: #ffffff;
        `}

    & > .bar-icon {
        filter: invert(1);
    }

    opacity: 0.6;

    &.active,
    &:hover {
        opacity: 1;
    }
`;

const SaveBtn = styled.button``;
