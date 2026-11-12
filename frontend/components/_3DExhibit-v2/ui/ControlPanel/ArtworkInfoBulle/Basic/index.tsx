import { useCyberTranslation } from "@components/context/I18nContext";
import { UserContext } from "@components/context/UserContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { Divider } from "@ui/components/Divider";
import IconImg from "@ui/components/IconImg";
import { useContext, useEffect } from "react";
import styled, { css } from "styled-components";
import { brandFoundation } from "@styles/brand";
import { Key } from "../shared/Key";
import MintArtworkInfoBulle from "../shared/MintArtworkInfoBulle";
import useArtworkInfoBulle from "../useArtworkInfoBulle";

export default function BasicArtworkInfoBulle({
    artwork,
    exhibit,
    toggleArtworkInfo,
    isPlaying,
    showArtworkInfo,
}) {
    const { user } = useContext(UserContext);
    const world = useWorld();

    const { t } = useCyberTranslation();

    const { assetType, assetIcon, creator, owner, moreDetails } =
        useArtworkInfoBulle({
            exhibit,
            artwork,
            toggleArtworkInfo,
        });

    let content;

    if (artwork?.mintable) {
        content = (
            <MintArtworkInfoBulle moreDetails={moreDetails} artwork={artwork} />
        );
    } else if (assetType === "Nft" || assetType === "Upload") {
        content = (
            <div>
                <img
                    src={assetIcon}
                    style={{ height: "32px", marginRight: "10px" }}
                />
                <div className="artwork">
                    <p
                        className="artwork-name"
                        style={{ wordBreak: "break-word" }}
                    >
                        {artwork?.name ||
                            artwork?.collection?.name +
                                ` #${artwork?.token_id}`}
                    </p>

                    <OwnerWrapper>
                        {creator ? (
                            <span
                                className={`artwork-creator ${
                                    !owner || owner === "NullAddress"
                                        ? "full"
                                        : ""
                                }`}
                                style={{ wordBreak: "break-all" }}
                            >
                                <span className={`secondary`}>
                                    {" "}
                                    {assetType != "Upload"
                                        ? t`CREATOR`
                                        : t`ADDED_BY`}
                                    :{" "}
                                </span>{" "}
                                {creator}
                            </span>
                        ) : null}

                        {owner != "NullAddress" ? (
                            <>
                                {creator ? (
                                    <Divider
                                        style={{
                                            margin: "0 6px",
                                            height: 10,
                                            background: "#ffffff1f",
                                        }}
                                        direction="vertical"
                                    />
                                ) : null}

                                <span className={`${!creator ? "full" : ""}`}>
                                    <span className={`ownerLabel `}>
                                        {t`OWNER`}:{" "}
                                    </span>
                                    {owner}
                                </span>
                            </>
                        ) : null}
                    </OwnerWrapper>
                </div>

                {
                    //Hiding more info for custom uploaded assets
                    assetType != "Upload" && (
                        <>
                            <Divider
                                style={{
                                    margin: "0 12px",
                                    height: 28,
                                    background: "#ffffff1f",
                                }}
                                direction="vertical"
                            />

                            <Button
                                id="info-button"
                                hasBorder={true}
                                data-artwork=""
                                onClick={(e) => toggleArtworkInfo(true)}
                            >
                                {IS_MOBILE ? (
                                    <IconImg
                                        mode="light"
                                        name="icon_tap"
                                        size={18}
                                    />
                                ) : (
                                    <Key>E</Key>
                                )}
                                <span>{t`FOR_DETAILS`}</span>
                            </Button>
                        </>
                    )
                }
            </div>
        );
    } else if (assetType === "Youtube" || assetType === "Website") {
        content = (
            <div>
                <img
                    src={assetIcon}
                    style={{ height: "32px", marginRight: "10px" }}
                />
                <div className="artwork">
                    <p
                        className="artwork-name"
                        style={{ wordBreak: "break-word" }}
                    >
                        {artwork?.name}
                    </p>

                    {assetType === "Youtube" ? (
                        <YoutubeOwnerWrapper>
                            <span className="secondary">By</span>{" "}
                            <span className="secondary-content">
                                {artwork.collection?.name}
                            </span>
                        </YoutubeOwnerWrapper>
                    ) : (
                        <YoutubeOwnerWrapper>
                            <span className="secondary-content">
                                {artwork.description}
                            </span>
                        </YoutubeOwnerWrapper>
                    )}
                </div>

                <Divider
                    style={{
                        margin: "0 12px",
                        height: 28,
                        background: "#ffffff1f",
                    }}
                    direction="vertical"
                />

                <Button
                    id="youtube-button"
                    hasBorder={false}
                    onClick={moreDetails}
                >
                    <Key>Esc</Key>
                    <span>{t`TO_CONTROL`}</span>
                </Button>
            </div>
        );
    } else {
        content = null;
    }

    return (
        <Container
            style={{ height: artwork?.mintable ? "auto" : 56 }}
            isMobile={IS_MOBILE}
            className={
                !artwork || !isPlaying || showArtworkInfo || content == null
                    ? "hide artwork-info-bulle-container basic"
                    : "artwork-info-bulle-container basic"
            }
        >
            {content}
        </Container>
    );
}

const Container = styled.div<{
    isMobile: boolean;
}>`
    ${brandFoundation}
    box-sizing: border-box;
    height: 56px;
    background: #14161bcc;
    border: 1px solid #ffffff18;

    padding: 12px 16px;
    color: #f3f3f1;
    font-family: var(--oc-font);
    border-radius: 12px;
    width: 350px;
    display: flex;
    align-items: center;

    p {
        margin: 0;
        font-weight: 500;
        font-size: 13px;
    }

    & > div {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;
    }

    .artwork {
        width: 8em;
        flex: 1;
    }

    .artwork-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .artwork-creator {
    }

    // backdrop-filter: blur(40px);
`;

const Button = styled.button<{ hasBorder: boolean; isMultiplayer?: boolean }>`
    color: #fff !important;
    background: none;
    border: none;
    padding: 0;
    display: inline-flex;
    gap: 8px;
    align-items: center;
    min-width: 65px;
    white-space: nowrap;

    & > span {
        color: #c2c2bd;
        font-size: 12px;
    }
`;

const OwnerWrapper = styled.div`
    display: flex;
    align-items: center;
    margin-top: 2px;

    & > span {
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #93938e;
        max-width: 50%;
        // width: 50%;

        &.full {
            width: 100%;
            max-width: 100%;
        }
    }
`;

const YoutubeOwnerWrapper = styled.div`
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #93938e;
    margin-top: 4px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: 100%;

    .secondary-content {
        text-overflow: ellipsis;
        width: 100%;
        overflow: hidden;
    }
`;
