import styled from "styled-components";
import React from "react";

import { ArtworkInfoProps } from "../types";
import { ArtworkInfo_Data } from "./ArtworkInfo_Data";
import { Horz, Vert } from "./style/Flex";
import { Button } from "./style/Button";
import CloseIcon from "@components/Icons/CloseIcon";
import { useArtworkInfo } from "./components/ArtworkContext";
import { ShareButton } from "./components/ShareButton";
import Modal from "@components/modals/Modal";
import { AssetPreview } from "./components/AssetPreview";
import { IconButton } from "@ui/components/IconButton.tsx";

export const ArtworkInfo_Full: React.FC<ArtworkInfoProps> = ({
    toggle,
    isShowing,
    handleTeleport,
}) => {
    const { asset} = useArtworkInfo();

    const title =
        asset == null
            ? ""
            : asset?.name ||
              `${asset?.collection?.name} #${asset.token_id}` ||
              `${asset?.contract_address}`;

    return (
        <Modal
            isShowing={isShowing}
            toggle={toggle}
            noShowClose={true}
            hasBackground
            isBackdrop
            style={{
                maxHeight: "100vh",
                height: "100vh",
                width: "100vw",
                maxWidth: "100vw",
                marginLeft: 0,
                overflow: "hidden",
                zIndex: 100000,
            }}
            wide={true}
        >
            <Container>
                <Header>
                    <AssetTitle className="truncated">{title}</AssetTitle>

                    {handleTeleport && (
                        <TeleportButton condensed onClick={handleTeleport}>
                            Teleport to location
                        </TeleportButton>
                    )}
                    <Buttons>
                        <ShareButton
                            size="40px"
                            onlyDark
                            dropdownStyle={{
                                transform: "translateX(80px)",
                            }}
                        />
                        <IconButton
                            title="Close Info page"
                            size="40px"
                            onClick={toggle}
                        >
                            <CloseIcon size={24} />
                        </IconButton>
                    </Buttons>
                </Header>
                <Content>
                    <div className="preview desktop">
                        <AssetPreview />
                    </div>
                    <div className="data">
                        <ArtworkInfo_Data />
                    </div>
                </Content>
            </Container>
        </Modal>
    );
};

const Container = styled(Vert)`
    color: ${(props) => props.theme.color};
    background-color: ${(props) => props.theme.background};
    width: 100%;
    height: 100%;

    @media (max-width: 1024px) {
        & .desktop {
            display: none !important;
        }
    }

    @media (min-width: 1024px) {
        & .mobile {
            display: none !important;
        }
    }
`;

const Content = styled.div`
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    font-family: "Aeonik";

    @media (min-width: 1024px) {
        display: grid;
        grid-template-columns: auto auto;
        justify-content: space-evenly;
        align-items: center;
        height: 100%;
        width: 100%;

        & > .data {
            flex: 0;
            width: 532px;
            height: 700px;
        }

        & > .preview {
            flex: 1;
            width: 400px;
            height: 400px;
        }
    }
`;

const Header = styled(Horz)`
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    flex: 0;
    border-bottom: 1px solid ${({ theme }) => theme?.separator?.color || "gray"};

    @media (min-width: 1024px) {
        padding: 16px 32px;
    }
`;

const AssetTitle = styled.div`
    font-size: 16px;
    flex: 1;

    @media (max-width: 1024px) {
        display: none;
    }
`;

const TeleportButton = styled(Button)`
    flex: 0 0 180px;
    height: 40px;

    @media (min-width: 1024px) {
        // margin-right: 16px;
    }
`;

const Buttons = styled(Horz)`
    flex: 1;
    justify-content: end;

    & > button {
        margin-left: 5px;
    }

    @media (min-width: 1024px) {
        flex: 0;
        & > button,
        & > div {
            margin-left: 16px;
        }
    }
`;
