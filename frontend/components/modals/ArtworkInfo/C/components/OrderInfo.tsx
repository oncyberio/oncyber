import React, { useCallback, useState, useContext, useEffect } from "react";
import styled, { css } from "styled-components";
import { BuyOrder } from "@dapp/Marketplace";
import { SellOrder } from "@dapp/types/SellOrder";
import { Input } from "../style/Input";
import { Horz } from "../style/Flex";
import { Label } from "../style/Label";
import { Price } from "./Price";
import { Button } from "../style/Button";
import CloseCircle from "@ui/icons/CloseCircle";
import { useArtworkInfo } from "./ArtworkContext";
import CloseIcon from "@components/Icons/CloseIcon";
import { IconButton } from "@ui/components/IconButton.tsx";
import { UserContext } from "@components/context/UserContext";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import InlineError from "@ui/components/InlineError";
import useOrderInfo from "../hooks/useOrderInfo";

export interface OrderInfoProps {
    // platform: string;
    listing: SellOrder<any>;
    offer: BuyOrder;
    loading: boolean;
    isOwner: boolean;
    submitting: boolean;
    onBuyArtwork: () => any;
    onMakeOffer: (amount: number, token?: any) => any;
}

export function OrderInfo({
    surface = "dark",
}: {
    /** The panel is light on the profile page in the light theme. */
    surface?: "dark" | "light";
}) {
    const {
        orderError,
        retryOrder,
        amountError,
        loading,
        makingOffer,
        startAmount,
        handleAmountChange,
        handleConfirmOffer,
        submitting,
        handleCancelOffer,
        listing,
        offer,
        isOwner,
        buyArtwork,
        handleMakeOffer,
    } = useOrderInfo();

    const { asset, isRedirect, purchase } = useArtworkInfo();

    let content = null;

    if (loading) {
        content = <div className="loading">Loading…</div>;
    } else if (makingOffer) {
        content = (
            <Horz>
                <Input
                    style={{
                        background: "var(--oc-canvas, white)",
                        color: "var(--oc-ink, #070707)",
                        borderRadius: "var(--oc-radius-control, 200px)",
                        height: "50px",
                        padding: "0 16px",
                    }}
                    type="text"
                    value={startAmount}
                    onChange={handleAmountChange}
                    placeholder="Offer amount"
                />

                <Button
                    style={{
                        marginRight: 10,
                        marginLeft: 10,
                    }}
                    primary={false}
                    className="bid-button btn-primary"
                    onClick={handleConfirmOffer}
                >
                    Confirm
                </Button>

                <IconButton
                    disabled={submitting}
                    size={"50px"}
                    className="icon-button"
                    onClick={handleCancelOffer}
                >
                    <CloseIcon size={24} />
                </IconButton>
            </Horz>
        );
    } else {
        let info, actions;

        if (listing != null) {
            info = (
                <div className="price-info">
                    <Price
                        price={listing?.currentPrice}
                        paymentToken={listing?.paymentToken}
                    />
                    <div className="label">Current price</div>
                </div>
            );
        } else if (offer != null) {
            info = (
                <div className="price-info">
                    <Price
                        price={offer.currentPrice}
                        paymentToken={offer.paymentToken}
                    />
                    <div className="label">Highest Offer</div>
                </div>
            );
        }
        if (isOwner) {
            actions = <Label>You own this artwork</Label>;
        } else if (submitting) {
            actions = <Label>Submitting…</Label>;
        } else {
            actions = (
                <Inline className="artwork-order-actions">
                    {listing && (
                        <BuyNowBtn
                            primary={false}
                            autoFocus={!submitting}
                            disabled={submitting}
                            style={{
                                marginRight: 10,
                            }}
                            className="bid-button primary"
                            onClick={buyArtwork}
                        >
                            Buy now
                        </BuyNowBtn>
                    )}
                    <MakeOfferBtn
                        strong={true}
                        disabled={submitting}
                        primary={false}
                        onClick={() => {
                            if (isRedirect) {
                                window
                                    .open(
                                        `https://surpriseland.xyz/pieces/${asset?.token_id}`,
                                        "_blank"
                                    )
                                    .focus();
                            } else {
                                handleMakeOffer();
                            }
                        }}
                    >
                        {isRedirect ? "Bid on website" : "Make Offer"}
                    </MakeOfferBtn>
                </Inline>
            );
        }

        content = (
            <>
                {info}
                {actions}
            </>
        );
    }

    // A failed purchase or offer is explained here, beside the controls that
    // started it, with a way to try again. See docs/feedback.md.
    const failure = makingOffer ? (
        <OrderFailure
            className="artwork-order-error"
            surface={surface}
            message={amountError}
        />
    ) : (
        <OrderFailure
            className="artwork-order-error"
            surface={surface}
            message={!submitting && orderError?.message}
            onRetry={retryOrder}
        />
    );

    return (
        <>
            <Container
                className="artwork-order-info"
                data-machine="purchase"
                data-state={purchase?.status}
            >
                {content}
            </Container>
            {failure}
        </>
    );
}

const OrderFailure = styled(InlineError)`
    flex: none;
    margin: 12px 16px 0;

    @media (min-width: 1368px) {
        margin: 12px 0 0;
    }
`;

const Container = styled(Horz)`
    padding: 0 16px;
    flex: 0 0 60px;
    border-top: 1px solid;
    margin-top: 24px;
    justify-items: center;
    border-color: #5c5c5c;
    @media (max-width: 830px) {
        padding-bottom: 10px;
        border-color: transparent;
        // margin-top: 8px;
        margin: 16px 0;
    }

    & > div,
    & > button {
        margin-top: 16px;
    }

    button {
        height: 50px !important;
        font-size: 14px;
    }

    .icon-button {
        width: 50px;
        padding: 12px;
    }

    @media (min-width: 1368px) {
        padding: 0;
        padding-top: 1rem;
        align-items: center;
        width: 100%;
        & > div,
        & > button {
            margin-top: 0;
        }
    }

    & .loading {
        font-size: 24px;
        font-weight: 500;
        margin: auto;
    }

    & .price-info {
        flex: 1;
    }

    & .action {
        cursor: pointer;
        width: 120px;
    }

    & .label {
        margin-bottom: 0.5em;
    }

    & .crypto-price {
        font-size: 24px;
    }

    & .usd-price {
        font-size: 12px;
    }
`;

const MakeOfferBtn = styled(Button)`
    padding: 12px 24px;
    border-color: #ffffff;
    font-weight: 500;
    font-size: 16px;
    line-height: 100%;
    color: #ffffff;
    background: transparent;

    @media (max-width: 830px) and (orientation: portrait) {
        padding: 11px 24px;
        background: #ffffff;
        font-size: 14px;
        color: #070707;
    }
`;

const BuyNowBtn = styled(Button)`
    padding: 12px 24px;
    background: #ffffff;
    font-weight: 500;
    font-size: 17px;
    line-height: 100%;
    color: #070707;
    border-radius: 200px;
    border-color: #ffffff;

    @media (max-width: 830px) and (orientation: portrait) {
        padding: 12px 24px;
        height: 40px;
    }

    &:focus {
        outline: none;
    }
`;

const Inline = styled.div`
    width: 100%;
    display: flex;
    margin-left: 10px;
    justify-items: center;
    justify-content: flex-end;
`;
