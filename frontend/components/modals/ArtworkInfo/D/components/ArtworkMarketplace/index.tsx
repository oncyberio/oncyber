import styled from "styled-components";
import { blueAction, compactActionSizing } from "@styles/brand";
import { experienceControl } from "@features/content-host/experienceChrome";
import IconImg from "@ui/components/IconImg";
import { IconButton } from "@ui/components/IconButton";
import { NButton } from "@ui/components/NButton";
import InlineError from "@ui/components/InlineError";
import useNftOrderInfo from "@components/context/NftBuyContext";
import { useCyberTranslation } from "@components/context/I18nContext";

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
    } = useNftOrderInfo();

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
            actions = <Label>{t`YOU_LISTED_THIS_ARTWORK`}</Label>;
        } else {
            actions = (
                <Actions
                    className="artwork-order-actions"
                    isMultiple={listing || offer}
                >
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
