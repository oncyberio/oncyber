import IconImg from "@ui/components/IconImg";
import { trimZeros } from "@utils/js";
import styled from "styled-components";
import { Horz } from "../style/Flex";

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

const cryptoSymbols = {
    ETH: "/v2/icons/ethereum.svg",
    polygon: "/v2/icons/polygon.svg",
};

export function UsdPrice({ price, paymentToken, style }: PriceProps) {
    return (
        <span className="usd-price" style={style}>
            {trimZeros(usdFormat.format(paymentToken.usdPrice * price))}
        </span>
    );
}

export function CryptoPrice({
    price,
    paymentToken,
    className = "",
    style = {},
}: PriceProps) {
    const token = paymentToken?.symbol?.toUpperCase();

    // const isWeth = token === "WETH";
    const isEth = token === "ETH";

    return (
        <CryptoContainer className={`crypto-price ${className}`} style={style}>
            {isEth && (
                <img
                    className="crypto-icon"
                    src={`/v2/icons/ethereum.svg`}
                    title="Ether"
                />
            )}
            {trimZeros(price.toFixed(4))}
            {!isEth && (
                <span
                    className="crypto-symbol"
                    style={{ fontSize: "0.6rem", marginLeft: 2 }}
                >
                    {token === "Ꜩ" ? (
                        <IconImg name="tezos" size={14} mode="light" />
                    ) : (
                        token
                    )}
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

const Container = styled(Horz)`
    align-items: baseline;
    min-width: 80px;

    & > .usd-price {
        color: ${({ theme }) => theme?.label?.color || "#070707"};
        margin-left: 0.5rem;
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
