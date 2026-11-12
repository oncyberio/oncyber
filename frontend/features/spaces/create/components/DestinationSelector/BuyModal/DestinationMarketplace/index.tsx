import useNftOrderInfo from "@components/context/NftBuyContext";
import {
    CryptoPrice,
    Price,
} from "@components/modals/ArtworkInfo/D/components/Price";
import { Input } from "@components/modals/ArtworkInfo/D/style/Input";
import { Label } from "@components/modals/ArtworkInfo/D/style/Label";
import { IconButton } from "@ui/components/IconButton";
import IconImg from "@ui/components/IconImg";
import { NButton } from "@ui/components/NButton";
import styled from "styled-components";
import { useRooms } from "../../useRooms";

export function DestinationMarketplace() {
    const {
        asset,
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

    const { onRoomBuy } = useRooms();

    let content = null;

    if (loading) {
        content = <div className="loading">Loading…</div>;
    } else if (makingOffer) {
        content = (
            <MakingOfferWrapper>
                <Input
                    style={{
                        background: "var(--field-bg-color)",
                        borderRadius: 200,
                        height: "50px",
                        padding: "0 16px",
                    }}
                    type="text"
                    value={startAmount}
                    onChange={handleAmountChange}
                    placeholder="Offer amount"
                />

                <NButton
                    style={{
                        marginRight: 10,
                        marginLeft: 10,
                    }}
                    className="bid-button btn-primary"
                    overrideTheme="dark"
                    onClick={handleConfirmOffer}
                >
                    Confirm
                </NButton>

                <IconButton className="icon-button" onClick={handleCancelOffer}>
                    <IconImg mode="light" name="x" size={24} />
                </IconButton>
            </MakingOfferWrapper>
        );
    } else {
        let info, actions;

        if (listing != null) {
            info = (
                <div className="price-info">
                    <CryptoPrice
                        price={listing?.currentPrice}
                        paymentToken={listing?.paymentToken}
                        className="crypto-price"
                    />
                    <div className="label">Current price</div>
                </div>
            );
        } else if (offer != null) {
            info = (
                <div className="price-info">
                    <CryptoPrice
                        price={offer.currentPrice}
                        paymentToken={offer.paymentToken}
                        className="crypto-price"
                    />
                    <div className="label">Highest Offer</div>
                </div>
            );
        }

        if (isOwner) {
            actions = <Label>You own this artwork</Label>;
            //}  else if (submitting) {
            // actions = <Label>Submitting ...</Label>;
        } else {
            actions = (
                <Actions>
                    {listing ? (
                        <NButton
                            autoFocus={true}
                            overrideTheme="dark"
                            className="buy primary"
                            onClick={async () => {
                                const success = await buyArtwork("marketplace");

                                if (success && asset.customData) {
                                    onRoomBuy(asset.customData.slug);
                                }
                            }}
                        >
                            Buy now
                        </NButton>
                    ) : null}

                    {/* <NButton
                        outline={true}
                        className="offer"
                        onClick={handleMakeOffer}
                    >
                        Make Offer
                    </NButton> */}
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

    return <Container>{content}</Container>;
}

const Container = styled.div`
    display: flex;
    gap: 30px;

    button {
        padding: 10px 12px;
    }

    & .label {
        font-size: 12px;
        color: var(--content-color);
        margin-top: 2px;
    }

    & .crypto-price {
        font-family: "Aeonik";
        font-style: normal;
        font-weight: 500;
        font-size: 20px;
        line-height: 28px;
        letter-spacing: -0.02em;
    }
`;

const Actions = styled.div`
    display: flex;
    gap: 12px;
    align-items: center;
    flex: 1;

    & > .buy,
    & > .offer {
        flex: 1;
        display: flex;
        justify-content: center;
        padding: 8px 24px;
    }
`;

const MakingOfferWrapper = styled.div`
    display: flex;
    align-items: center;

    & > input {
        border-color: var(--field-border-color);
    }
    & > input:focus {
        border-color: var(--title-color);
    }
`;
