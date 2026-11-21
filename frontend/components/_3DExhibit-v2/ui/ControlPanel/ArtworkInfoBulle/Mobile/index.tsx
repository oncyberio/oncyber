import { IconButton } from "@ui/components/IconButton";
import React, { useRef } from "react";
import styled from "styled-components";
import { useArtworkInfo } from "@components/modals/ArtworkInfo/D/ArtworkContext";
import { ArtworkInfoMint_Data } from "@components/modals/ArtworkInfo/D/Mint/ArtworkInfoMint_Data";
import { ArtworkInfoDesktop } from "@components/modals/ArtworkInfo/D/Desktop";
import { usePanel } from "../../context/PanelProvider";

export default function MobileArtworkInfoBulle() {
    const { asset } = useArtworkInfo();

    const { setIsMobileArtworkInfoOpened } = usePanel();

    const assetInfoRef = useRef<HTMLDivElement>(null);

    if (!asset?.mintable)
        return (
            <ArtworkInfoDesktop
                type="3d"
                keepWorldHeader
                toggle={() => setIsMobileArtworkInfoOpened(false)}
            />
        );

    const ArtworkInfo = ArtworkInfoMint_Data;

    return (
        <Container>
            <IconButton
                name="x"
                mode="light"
                className="close"
                size={"medium"}
                onClick={() => {
                    setIsMobileArtworkInfoOpened(false);
                }}
            />
            <ArtworkInfo themeDark={true} assetInfoRef={assetInfoRef} />
        </Container>
    );
}

const Container = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: var(--100-vh);
    max-height: var(--100-vh);
    /* Under the world chrome (10010): its header stays in place on top. */
    z-index: 10005;
    padding-top: calc(max(22px, env(safe-area-inset-top)) + 44px + 8px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40px;
    justify-content: flex-start;
    background: rgba(7, 7, 7, 0.8);
    // backdrop-filter: blur(20px);
    border-radius: 0px !important;
    overflow: auto;

    & > .close {
        margin-top: 24px;
    }
`;
