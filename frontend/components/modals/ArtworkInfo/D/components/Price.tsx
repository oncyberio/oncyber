import IconImg from "@ui/components/IconImg";
import { trimZeros } from "@utils/js";
import React from "react";
import styled from "styled-components";

export interface PriceProps {
    price: number;
    paymentToken?: {
        symbol: string;
        usdPrice?: number;
    };
    className?: string;
    style?: any;
}

const usdFormat = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
});

export function UsdPrice({ price, paymentToken, style }: PriceProps) {
    return (
        <span className="usd-price" style={style}>
            {trimZeros(usdFormat.format(paymentToken.usdPrice * price))}
        </span>
    );
}

const tezosIcon = <IconImg name="tezos" size={14} mode="light" />;

export function CryptoPrice({
    price,
    paymentToken,
    className = "",
    style = {},
}: PriceProps) {
    //
    let token: React.ReactNode = paymentToken?.symbol?.toUpperCase();

    // const isWeth = token === "WETH";
    const isEth = token === "ETH";

    return (
        <CryptoContainer className={`crypto-price ${className}`} style={style}>
            {isEth &&
                // <img
                //     className="crypto-icon"
                //     src={`/v2/icons/ethereum.svg`}
                //     title="Ether"
                // />
                "Ξ"}
            {trimZeros(price.toFixed(4))}
            {!isEth && (
                <span
                    className="crypto-symbol"
                    style={{ fontSize: "0.6rem", marginLeft: 2 }}
                >
                    {token === "Ꜩ" ? tezosIcon : token}
                </span>
            )}
        </CryptoContainer>
    );
}

export function Price({
    price,
    paymentToken,
    className = "",
    style = {},
}: PriceProps) {
    return (
        <Container className={className} style={style}>
            <CryptoPrice price={price} paymentToken={paymentToken} />
            {paymentToken.usdPrice && (
                <UsdPrice price={price} paymentToken={paymentToken} />
            )}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: row;
    align-items: baseline;
    min-width: 80px;

    & .crypto-price {
        font-weight: 500;
        font-size: 28px;
        color: #ffffff;
    }

    & > .usd-price {
        font-weight: 400;
        font-size: 14px;
        color: #7a7a7a;
        margin-left: 0.5rem;
    }

    @media (max-width: 600px) {
        & .crypto-price {
            font-weight: 500;
            font-size: 18px;
        }

        & > .usd-price {
            font-size: 14px;
        }
    }
`;

const CryptoContainer = styled.span`
    display: flex;
    align-items: center;

    & .crypto-icon {
        width: 0.8em;
        height: 0.8em;
    }
`;
