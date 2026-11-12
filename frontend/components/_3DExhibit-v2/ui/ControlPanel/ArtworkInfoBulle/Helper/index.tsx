import { useCyberTranslation } from "@components/context/I18nContext";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { Divider } from "@ui/components/Divider";
import styled from "styled-components";
import { brandFoundation } from "@styles/brand";
import { Key } from "../shared/Key";
import MintArtworkInfoBulle from "../shared/MintArtworkInfoBulle";
import useArtworkInfoBulle from "../useArtworkInfoBulle";

export default function HelperArtworkInfoBulle({
    artwork,
    exhibit,
    toggleArtworkInfo,
    isPlaying,
    showArtworkInfo,
    selectedMode,
}) {
    const { assetType, creator, owner, moreDetails } = useArtworkInfoBulle({
        exhibit,
        artwork,
        toggleArtworkInfo,
    });

    const { t } = useCyberTranslation();

    const isIframe = assetType === "Youtube" || assetType === "Website";

    if (assetType === "Text") {
        return null;
    }

    if (artwork?.mintable) {
        return (
            <Container className="artwork-info-bulle-container helper">
                <MintArtworkInfoBulle
                    moreDetails={moreDetails}
                    artwork={artwork}
                />
            </Container>
        );
    }

    return (
        <Container className="artwork-info-bulle-container helper">
            <TitleContainer>
                <TitleWrapper>
                    {assetType === "Youtube" ? (
                        <img
                            src="/v2/icons/youtube.svg"
                            style={{ height: "8px", marginRight: 4 }}
                        />
                    ) : null}

                    {artwork?.name ||
                        artwork?.collection?.name + ` #${artwork?.token_id}`}
                </TitleWrapper>

                <CreatorWrapper style={{ marginLeft: 6 }}>
                    {assetType === "Nft" ? (
                        creator ? (
                            <span>
                                {t`BY`} {creator}
                            </span>
                        ) : owner ? (
                            <span>
                                {t`OWNER_BY`} {owner}
                            </span>
                        ) : null
                    ) : null}

                    {assetType === "Youtube" ? (
                        <span>
                            <span className="secondary">{t`BY`}</span>{" "}
                            {artwork.collection?.name}
                        </span>
                    ) : assetType === "Upload" ? (
                        <span>{t`CREATOR` + ": " + creator}</span>
                    ) : (
                        <span>{artwork?.description}</span>
                    )}
                </CreatorWrapper>
            </TitleContainer>

            <TipWrapper>
                {assetType === "Nft" ? (
                    IS_MOBILE ? (
                        <button type="button" onClick={moreDetails}>{t`TAP_FOR_DETAILS`}</button>
                    ) : (
                        <button type="button" onClick={moreDetails}>
                            <Divider
                                style={{
                                    margin: "0 6px",
                                    height: 10,
                                    background: "#ffffff1f",
                                }}
                                direction="vertical"
                            />
                            <Key style={{ marginRight: 6 }}>E</Key>
                            <span>{t`FOR_DETAILS`}</span>
                        </button>
                    )
                ) : isIframe && !IS_MOBILE ? (
                    <div>
                        <Key style={{ marginRight: 6 }}>Esc</Key>
                        <span>{t`TO_CONTROL`}</span>
                    </div>
                ) : null}
            </TipWrapper>
        </Container>
    );
}

const Container = styled.div`
    ${brandFoundation}
    box-sizing: border-box;
    width: 340px;
    background: #14161bcc;
    border: 1px solid #ffffff18;
    color: #f3f3f1;
    font-family: var(--oc-font);
    border-radius: 12px;
    display: flex;
    align-items: center;
    font-size: 11px;
    justify-content: space-between;
    padding: 12px;
    // backdrop-filter: blur(40px);
`;

const TitleContainer = styled.div`
    display: flex;
    align-items: center;

    width: calc(340px - 120px);
`;

const TitleWrapper = styled.div`
    display: flex;
    align-items: center;
    max-width: 100%;
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const CreatorWrapper = styled.div`
    display: flex;
    align-items: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 92px;
    display: inline-block;
    color: #c2c2bd;
`;

const TipWrapper = styled.div`
    display: flex;
    align-items: center;

    & > button {
        background: none;
        border: none;
        color: inherit;
        font: inherit;
        padding: 0;
        cursor: pointer;
    }

    & span {
        color: #c2c2bd;
    }

    & > div, & > button {
        width: fit-content;
        min-width: fit-content;
        display: flex;
        align-items: center;
    }
`;
