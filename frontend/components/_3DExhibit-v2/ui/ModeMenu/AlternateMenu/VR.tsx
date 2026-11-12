import {
    Mode,
    usePanel,
} from "@components/_3DExhibit-v2/ui/ControlPanel/context/PanelProvider";
import IconImg from "@ui/components/IconImg";
import { NButton } from "@ui/components/NButton";
import { useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { Container } from "./shared";

export default function VR_AlternateMenu({ handleChangeMode }) {
    const {
        toggleModeMenu,
        selectedMode,
        setSelectedMode,
        isModeMenuOpen,
        toggleTip,
        enterVR,
        setHidePanel,
        setIsFirstTimeOpenModeMenu,
    } = usePanel();

    function handleClick() {
        handleChangeMode(selectedMode);
    }

    return (
        <Container>
            <h3>ARE YOU USING A VR DEVICE?</h3>

            <ButtonsContainer>
                <ButtonContainer
                    onClick={() => {
                        handleChangeMode(Mode.VR);
                    }}
                >
                    <ButtonImgContainer>
                        <IconImg name="not-in-vr" mode="light" size={74} />
                    </ButtonImgContainer>
                    <p>I'm in VR</p>
                </ButtonContainer>
                <ButtonContainer onClick={handleClick}>
                    <ButtonImgContainer>
                        <IconImg name="singleplayer" mode="light" size={74} />
                    </ButtonImgContainer>
                    <p>No</p>
                </ButtonContainer>
            </ButtonsContainer>
            <div style={{ cursor: "pointer" }} onClick={handleClick}>
                <IconImg name="x" mode="light" size={64} />
            </div>
        </Container>
    );
}

const ButtonsContainer = styled.div`
    display: inline-flex;
    gap: 45px;
    margin-bottom: 54px;

    @media (max-width: 550px) {
        gap: 12px;
    }
`;

const ButtonContainer = styled.div<{
    isActive?: boolean;
}>`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 200px;
    height: 180px;
    backdrop-filter: blur(28px);
    border-radius: 12px;
    cursor: pointer;
    user-select: none;

    &:hover {
        background: rgba(7, 7, 7, 0.8);
    }

    ${({ isActive }) => {
        return (
            isActive &&
            css`
                background: rgba(7, 7, 7, 0.8);
            `
        );
    }}

    transition: 0.3s all ease;

    @media (max-width: 550px) {
        width: 150px;
        height: 130px;

        .icon-img {
            width: 44px !important;
            height: 44px !important;
            min-height: 44px !important;
            min-width: 44px !important;
        }
    }
`;

const ButtonImgContainer = styled.div`
    margin-bottom: 18px;

    @media (max-width: 550px) {
        margin-bottom: 8px;
    }
`;
