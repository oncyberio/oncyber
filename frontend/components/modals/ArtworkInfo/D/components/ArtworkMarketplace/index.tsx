import styled from "styled-components";
import { blueAction, compactActionSizing } from "@styles/brand";
import { experienceControl } from "@features/content-host/experienceChrome";
import IconImg from "@ui/components/IconImg";
import { IconButton } from "@ui/components/IconButton";
import { NButton } from "@ui/components/NButton";
import InlineError from "@ui/components/InlineError";
import useNftOrderInfo from "@components/context/NftBuyContext";
import { useCyberTranslation } from "@components/context/I18nContext";
import {
    marketplaceLink,
    MarketplaceLink,
} from "@utils/artworks/marketplaceLink";

import { Price } from "../Price";
import { Input } from "../../style/Input";
import { Label } from "../../style/Label";

export function ArtworkMarketplace({ isMobile = false }) {
    const {
        amountError,
        loading,
        makingOffer,
        startAmount,
        handleAmountChange,
        handleConfirmOffer,
        handleCancelOffer,
        listing,
        offer,
        isOwner,
        buyArtwork,
        handleMakeOffer,
        asset,
    } = useNftOrderInfo();

    const market = marketplaceLink(asset);

    const { t } = useCyberTranslation();

    let content = null;

    if (loading) {
        content = <div className="loading"></div>;
    } else if (makingOffer) {
        content = (
            <MakingOfferWrapper isMobile={isMobile}>
                <Input
                    style={{
                        background: "#14161bcc",
                        color: "#f3f3f1",
                        border: "1px solid #ffffff2e",
                        borderRadius: "12px",
                        padding: "0 14px",
                        height: "40px",
                        ...(isMobile && { outline: "none" }),
                    }}
                    type="text"
                    value={startAmount}
                    className="input"
                    onChange={handleAmountChange}
                    placeholder="Offer amount"
                />

                <NButton
                    className="bid-button btn-primary"
                    overrideTheme="dark"
                    onClick={handleConfirmOffer}
                >
                    {t`CONFIRM`}
                </NButton>

                <IconButton
                    aria-label="Cancel offer"
                    className="icon-button"
                    onClick={handleCancelOffer}
                >
                    <IconImg mode="light" name="x" size={18} />
                </IconButton>
            </MakingOfferWrapper>
        );
    } else {
        let info, actions;

        if (listing != null) {
            info = (
                <div className="price-info">
                    <div className="label">{t`CURRENT_PRICE`}</div>
                    <Price
                        price={listing?.currentPrice}
                        paymentToken={listing?.paymentToken}
                        className="crypto-price"
                    />
                </div>
            );
        } else if (offer != null) {
            info = (
                <div className="price-info">
                    <div className="label">{t`HIGHEST_OFFER`}</div>
                    <Price
                        price={offer.currentPrice}
                        paymentToken={offer.paymentToken}
                    />
                </div>
            );
        }

        if (isOwner) {
            actions = (
                <Actions className="artwork-order-actions" isMultiple>
                    <Label>{t`YOU_LISTED_THIS_ARTWORK`}</Label>
                    {market && <MarketplaceButton market={market} />}
                </Actions>
            );
        } else {
            actions = (
                <Actions
                    className="artwork-order-actions"
                    isMultiple={listing || offer}
                >
                    {market && <MarketplaceButton market={market} />}

                    {listing ? (
                        <NButton
                            outline={true}
                            className="buy"
                            onClick={() => buyArtwork()}
                        >
                            {t`COLLECT_NOW`}
                        </NButton>
                    ) : null}

                    <NButton
                        className={listing ? "offer" : "offer primary"}
                        onClick={handleMakeOffer}
                    >
                        {t`OFFER`}
                    </NButton>
                </Actions>
            );
        }

        content = (
            <>
                {info}
                {actions}
            </>
        );
    }

    return (
        <>
            <Container className="artwork-order-info">{content}</Container>
            {/* An invalid offer amount, under the field (docs/feedback.md). */}
            <InlineError
                className="artwork-order-error"
                message={makingOffer && !loading && amountError}
                style={{ marginTop: 12 }}
            />
        </>
    );
}

// The marketplace's mark: OpenSea's is drawn as a mask so it takes the brand
// blue; the others are colour images already.
const MARKETPLACE_ICONS: Record<
    MarketplaceLink["id"],
    { src: string; color?: string }
> = {
    opensea: {
        src: "/images/icons/opensea-transparent.svg",
        color: "#2081e2",
    },
    objkt: { src: "/images/icons/tezos.svg" },
    magiceden: { src: "/images/icons/solana.png" },
};

function MarketplaceButton({ market }: { market: MarketplaceLink }) {
    const icon = MARKETPLACE_ICONS[market.id];
    return (
        <a
            className="marketplace"
            href={market.href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open on ${market.name}`}
            aria-label={`Open on ${market.name}`}
        >
            {icon.color ? (
                <MarketplaceMask
                    aria-hidden="true"
                    $src={icon.src}
                    $color={icon.color}
                />
            ) : (
                <img alt="" aria-hidden="true" src={icon.src} />
            )}
            <span>{market.name}</span>
        </a>
    );
}

const MarketplaceMask = styled.span<{ $src: string; $color: string }>`
    background: ${({ $color }) => $color};
    mask: url(${({ $src }) => $src}) center / contain no-repeat;
    -webkit-mask: url(${({ $src }) => $src}) center / contain no-repeat;
`;

const Container = styled.div`
    margin-top: auto;
    display: flex;
    gap: 20px;

    button {
        padding: 10px 12px;
    }

    & .loading {
        text-align: center;
    }

    & .price-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    & .label {
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        color: #93938e;
        text-align: left;
    }
`;

const Actions = styled.div<{ isMultiple?: any }>`
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: ${({ isMultiple }) =>
        isMultiple ? "flex-end" : "center"};
    flex: 1;

    & > .buy,
    & > .offer {
        ${compactActionSizing}
        height: 40px;
        padding: 10px 18px;
        border: 0;
        cursor: pointer;
    }

    & > .marketplace {
        ${compactActionSizing}
        height: 40px;
        padding: 10px 16px 10px 12px;
        gap: 8px;
        color: #0f1013;
        background: #ffffff;
        text-decoration: none;
        box-shadow: 0 1px 2px #0000001f;
        transition: background 180ms ease, transform 150ms ease;

        &:hover {
            color: #0f1013;
            background: #ececea;
        }

        &:focus-visible {
            outline: 2px solid #ffffff;
            outline-offset: 2px;
        }

        & > img,
        & > span[aria-hidden] {
            display: block;
            width: 20px;
            height: 20px;
            flex: none;
            object-fit: contain;
        }
    }

    & > .buy,
    & > .offer.primary {
        ${blueAction}
    }

    & > .offer:not(.primary) {
        color: #f3f3f1;
        background: #14161bcc;
        box-shadow: inset 0 0 0 1px #ffffff2e;
        transition: background 180ms ease;

        &:hover {
            color: #f3f3f1;
            background: #22252de6;
        }
    }
`;

const MakingOfferWrapper = styled.div<{ isMobile: boolean }>`
    display: flex;
    align-items: center;
    width: 100%;
    justify-content: center;

    gap: 8px;

    & > .input {
        flex: 1;
        max-width: 300px;
        box-sizing: border-box;
    }

    & > .bid-button {
        ${compactActionSizing}
        ${blueAction}
        height: 40px;
        border: 0;
    }

    & > .icon-button {
        ${experienceControl}
        padding: 0;
    }
`;
