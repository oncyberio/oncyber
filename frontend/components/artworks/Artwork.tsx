import { useRouter } from "next/router";
import React from "react";
import styled from "styled-components";

export default function Artwork({
    asset,
    showPayment,
    id,
    hideOwnership = false,
    handleTeleport,
}) {
    const creator =
        asset?.creator?.address &&
        (asset?.creator?.user?.username ||
            asset?.creator?.username ||
            asset?.creator?.address?.slice(0, 10) + "...");

    const owner =
        asset?.owner?.user?.username ||
        asset?.owner?.address?.slice(0, 9) + "...";

    const ownerImg =
        asset?.owner?.user?.profile_img_url || "/images/opensea-black.png";

    const router = useRouter();

    return (
        <ArtworkWrapper key={id}>
            <ImageWrapper>
                <img
                    onError={(e) => {
                        (e.target as HTMLImageElement).onerror = null;
                        (e.target as HTMLImageElement).src = asset?.image_url;
                    }}
                    src={
                        asset?.image_preview_url ||
                        asset?.image_url ||
                        asset?.image_original_url ||
                        "../images/sq_image_placeholder.png"
                    }
                    alt={asset?.name}
                />
            </ImageWrapper>
            <TextCard className="textCard">
                <Title>
                    {asset?.name ||
                        asset?.collection?.name + ` #${asset.token_id}`}
                </Title>
                <p id="creator-name">Created by {creator}</p>

                {!hideOwnership ? (
                    <Bottom
                        grid={handleTeleport != null}
                        ownerPresent={owner != "NullAddress"}
                    >
                        {owner != "NullAddress" && (
                            <Ownership>
                                <div id="creator-container">
                                    <img src={ownerImg} id="owner-img" />
                                    <div>
                                        <span
                                            id="owner-name-title"
                                            style={{
                                                wordBreak: "break-all",
                                                whiteSpace: "nowrap",
                                                textOverflow: "ellipsis",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {owner}
                                        </span>
                                        <span className="ownerLabel">
                                            owner
                                        </span>
                                    </div>
                                </div>
                            </Ownership>
                        )}
                        <Button
                            id="info-button"
                            data-artwork=""
                            onClick={() => showPayment(asset)}
                        >
                            Details
                        </Button>
                        {handleTeleport != null &&
                            router?.query?.slug?.[0] !== "@" && (
                                <Button
                                    id="info-button"
                                    data-artwork=""
                                    onClick={() => {
                                        handleTeleport(asset);
                                    }}
                                >
                                    Teleport
                                </Button>
                            )}
                    </Bottom>
                ) : null}
            </TextCard>
        </ArtworkWrapper>
    );
}

const ArtworkWrapper = styled.div`
    width: 100%;
    cursor: pointer;
    overflow: hidden;
    position: relative;

    transition: 0.4s;
    color: #000;
    cursor: pointer;
    margin: 8px 0;
    // border: 1px solid grey;
    // box-shadow: 0 5px 10px rgba(0, 0, 0, 0.12);
    position: relative;
    width: 100%;

    .textCard {
        opacity: 0;
        transition: 0.1s;
    }

    &:hover {
        .textCard {
            opacity: 1;
        }
    }
`;

const TextCard = styled.div`
    padding: 8px 16px;
    padding-top: 16px;
    background: linear-gradient(
        to top,
        rgba(0, 0, 0, 0.4),
        rgba(0, 0, 0, 0.25),
        rgba(0, 0, 0, 0.1),
        transparent
    );
    position: absolute;
    width: 100%;
    bottom: 0px;
    color: white;

    p {
        margin: 0;
    }

    #creator-name {
        font-size: 13px;
        opacity: 0.8;
        font-weight: 400;
        margin: 0;
    }

    // @media(max-width: 800px) {
    //     // padding: 8px 8px 12px 8px;
    // }
`;

const Title = styled.h4`
    font-size: 16px;
    margin: 0;
    max-height: 70px;
    // overflow: auto;
    padding: 4px 0px;
    font-weight: 500;

    width: 100%;
    word-break: break-all;
`;

const Ownership = styled.div`
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    text-align: center;

    & > div {
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;

        & > div {
            margin-left: 6px;
            display: flex;
            flex-direction: column;
            align-items: start;
        }
    }

    img {
        height: 30px;
        border-radius: 100%;
        margin-top: 6px;
    }

    span {
        font-size: 12px;
        max-width: 12ch;
        overflow: hidden;
        word-break: inherit;
    }

    .ownerLabel {
        opacity: 0.5;
        font-size: 11px;
        font-weight: 400;
        margin: 0;
    }

    @media (max-width: 600px) {
        font-size: 15px;
        img {
            height: 30px;
        }
        p {
            font-size: 13px;
        }
    }
`;

const Bottom = styled.div`
    width: 100%;
    display: grid;
    grid-template-columns: ${({ ownerPresent, grid }) =>
        ownerPresent
            ? grid
                ? "10fr 7fr 7fr"
                : "10fr 8fr"
            : grid
            ? "1fr 1fr"
            : "1fr"};
    grid-gap: 8px;
    margin-top: 12px;
    padding-top: 0px;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.3);
`;

const Button = styled.button`
    margin: 12px 0 8px 0;
    padding: 8px 12px;
    color: #fff;
    background: transparent;
    outline: none;
    border: 1px solid #fff;
    border-radius: 50px;
    font-size: 12px;
    cursor: pointer;
    outline: none;
    width: 100%;
    display: flex;
    align-items: center;
    text-align: center;
    justify-content: center;
    text-transform: uppercase;
    font-weight: 400;

    @media (max-width: 600px) {
        padding: 8px;
        font-size: 11px;
        margin: 8px 0;
    }
`;

const ImageWrapper = styled.div`
    position: relative;
    background: #f7f7f7;
    width: 100%;

    img,
    video {
        margin-bottom: -4px;
        width: 100%;
    }
`;
