import styled from "styled-components";
import EmptyState from "@ui/components/EmptyState";
import { SellOrder } from "@dapp/types/SellOrder";
import { Label } from "../style/Label";
import { CryptoPrice, UsdPrice } from "./Price";
import { Name } from "./Name";
import React from "react";
import { timeLeft } from "../utils";
import { Vert } from "../style/Flex";
import { useCyberTranslation } from "@components/context/I18nContext";

export interface ListingsProps {
    listings: SellOrder<unknown>[];
}

const icons = {
    opensea: "https://opensea.io/static/images/logos/opensea.svg",
    rarible: "/images/icons/rarible.svg",
    tezos: "/images/icons/tezos.svg",
    "objkt.com": "/images/icons/tezos.svg",
};

export function Listings({ listings }: ListingsProps) {
    const { t } = useCyberTranslation();

    // The native artwork panels and the destination buy window are dark.
    if (!listings?.length) {
        return <EmptyState icon="tag" title={t`NO_DATA_FOR_THIS_ASSET`} />;
    }

    // const showExpiry = listings.some((it) => it.expirationDate != null);

    return (
        <Container className="scrollbar">
            <GridHeader>
                <Head></Head>
                <Head>{t`PRICE`}</Head>
                <Head>{t`USD_PRICE`}</Head>
                <Head>{t`EXPIRES_IN`}</Head>
                <Head>{t`FROM`}</Head>
            </GridHeader>
            <GridBody>
                {listings?.map((listing, idx) => {
                    const sourceName =
                        listing.source?.name ?? listing.marketplace.name;
                    const sourceIcon =
                        listing.source?.icon || icons[sourceName.toLowerCase()];

                    return (
                        <GridBodyRow key={idx}>
                            <Cell>
                                <img
                                    className="icon"
                                    src={sourceIcon}
                                    title={sourceName}
                                    alt={sourceName}
                                />
                            </Cell>
                            <Cell>
                                <CryptoPrice
                                    price={listing.currentPrice}
                                    paymentToken={listing.paymentToken}
                                />
                            </Cell>
                            <Cell>
                                {listing.paymentToken.usdPrice ? (
                                    <UsdPrice
                                        price={listing.currentPrice}
                                        paymentToken={listing.paymentToken}
                                    />
                                ) : (
                                    "-"
                                )}
                            </Cell>
                            <Cell>
                                {listing.expirationDate
                                    ? timeLeft(listing.expirationDate)
                                    : "-"}
                            </Cell>

                            <Name
                                name={listing.maker.address?.slice(0, 8)}
                                url={listing.maker.link}
                            />
                        </GridBodyRow>
                    );
                })}
            </GridBody>
        </Container>
    );
}

const Msg = styled.div`
    white-space: nowrap;
`;

const Container = styled(Vert)`
    overflow: auto;
    font-size: 14px;
    font-weight: 400;
`;

const GridLine = styled.div`
    display: grid;
    grid-template-columns: 24px 80px 80px 80px 1fr;
    grid-gap: 0.4rem;
    padding-top: 1rem;
    padding-bottom: 1rem;
    align-items: center;
    color: #999999;
    font-size: 12px;

    @media (max-width: 800px) {
        grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
        & > :nth-child(4) {
            display: none;
        }
    }
`;

const GridHeader = styled(GridLine)`
    background-color: #f5f5f5;
    color: #7a7a7a;
`;

const GridBody = styled.div`
    flex: 1;
    overflow: auto;
`;

const GridBodyRow = styled(GridLine)`
    border-bottom: 1px solid;
    border-color: #5c5c5c;
`;

const Head = styled(Label)`
    margin: 0 !important;
    padding: 0 10px;
`;

const Cell = styled.div`
    margin: 0 !important;
    padding: 0 10px;

    & > .icon {
        width: 20px;
        height: 20px;
        padding-top: 4px;
    }
`;
