import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";

import { AssetPreview } from "@components/_3DExhibit-v2/ui/AssetsMenu/shared/ArtworkPreview";

import EnterBg from "@ui/components/Icons/EnterBg";

import styled from "styled-components";

export function placeholderIdtoAsset(placeholderOrArtworkId, world) {
    const asset = world.current.getArtworks().find((artwork) => {
        return (
            placeholderOrArtworkId === artwork?.item?.data?.id ||
            placeholderOrArtworkId == artwork?.userData?.placeholderId
        );
    });

    return asset;
}

function handleSelectArtwork({ placeholderOrArtwork, world }) {
    const asset = placeholderIdtoAsset(
        placeholderOrArtwork?.item?.data?.id ||
            placeholderOrArtwork?.userData?.id,
        world
    );

    if (asset) {
        world.current.edit({
            type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
            items: [asset],
        });
    }
}

function teleport({ placeholderOrArtwork, world }) {
    const asset = placeholderIdtoAsset(
        placeholderOrArtwork?.item?.data?.id ||
            placeholderOrArtwork?.userData?.id,
        world
    );

    if (asset) {
        const coords = world.current.getTeleportCoords({
            artwork: asset?.item?.data,
        });

        if (coords) {
            world.current.teleport(coords);
        }
    }
}

export function getArtworksFeedback({
    title,
    modifiedArtworks,
    placeholders,
    world,
}) {
    return {
        title,
        suggestions: modifiedArtworks.map((asset, index) => {
            return {
                Component: ({ isSelected }) => (
                    <HangNFTFeedback
                        isSelected={isSelected}
                        asset={asset}
                        teleport={() =>
                            teleport({
                                placeholderOrArtwork: placeholders[index],
                                world,
                            })
                        }
                    />
                ),
                onfocus: () =>
                    teleport({
                        placeholderOrArtwork: placeholders[index],
                        world,
                    }),

                onselect: () =>
                    handleSelectArtwork({
                        placeholderOrArtwork: placeholders[index],
                        world,
                    }),
            };
        }),
    };
}

export function HangNFTFeedback({ asset, teleport, isSelected }) {
    return (
        <HangNFTContainer>
            <ImgWrapper>
                <AssetPreview asset={asset} name={asset?.name} index={0} />
            </ImgWrapper>
            <TeleportWrapper>
                {asset.mime_type != "cyber/text" ? (
                    <p>{asset.name}</p>
                ) : (
                    <p>Text asset</p>
                )}
                {/* <SButton onClick={teleport}>teleport</SButton> */}
            </TeleportWrapper>
            {isSelected ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <p>Enter</p>
                    <EnterBg size={18} foreground="#292929" background="#fff" />
                    <p>to select</p>
                </div>
            ) : null}
        </HangNFTContainer>
    );
}

const HangNFTContainer = styled.div`
    font-size: 13px;
    display: flex;
    gap: 12px;
    align-items: center;

    overflow: hidden;

    p {
        margin: 0;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
        display: inline-block;
        text-align: left;
        font-size: 12px;
    }
`;

const TeleportWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    overflow: hidden;
`;

const ImgWrapper = styled.div`
    & > img,
    video {
        width: 57.38px;
        height: 21px;
        object-fit: cover;
        border-radius: 2px;
    }
`;

const SButton = styled.button`
    background: #393b40;
    border: none;
    outline: none;
    color: #ffffff;
    display: inline-block;
    width: fit-content;
    border-radius: 3px;
    cursor: pointer;
    padding: 4px 12px;
`;
