import styled, { useTheme } from "styled-components";
import EmptyState, { surfaceOfTheme } from "@ui/components/EmptyState";
import { SellOrder } from "@dapp/types/SellOrder";
import { Label } from "../style/Label";
import { CryptoPrice, UsdPrice } from "./Price";
import { Name } from "./Name";
import React from "react";
import { timeLeft } from "../utils";
import { Vert } from "../style/Flex";

export interface ListingsProps {
    listings: SellOrder<unknown>[];
    /** What the empty list says; offers pass their own line. */
    emptyTitle?: string;
}

const icons = {
    opensea: "https://opensea.io/static/images/logos/opensea.svg",
    rarible: "/images/icons/rarible.svg",
    tezos: "/images/icons/tezos.svg",
    "objkt.com": "/images/icons/tezos.svg",
};

export function Listings({
    listings,
    emptyTitle = "No listings yet.",
}: ListingsProps) {
    const theme = useTheme() as any;
    if (!listings?.length) {
        return (
            <EmptyState
                surface={surfaceOfTheme(theme)}
                icon="tag"
                title={emptyTitle}
            />
        );
    }

    // const showExpiry = listings.some((it) => it.expirationDate != null);

    return (
        <Container className="scrollbar">
            <GridHeader>
                <Head></Head>
                <Head>Price</Head>
                <Head>USD Price</Head>
                <Head>Expires in</Head>
                <Head>From</Head>
            </GridHeader>
            <GridBody>
                {listings?.map((listing, idx) => {
                    const sourceName = (
                        listing.source?.name ?? listing.marketplace.name
                    )?.toLowerCase();
                    const sourceIcon = sourceName?.includes("oncyber.")
                        ? "/logo/32.png"
                        : listing.source?.icon ||
                          icons[sourceName.toLowerCase()];

                    return (
                        <GridBodyRow key={idx}>
                            <Cell>
                                {sourceIcon && (
                                    <img
                                        className="icon"
                                        src={sourceIcon}
                                        title={sourceName}
                                        alt={sourceName}
                                    />
                                )}
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
    background-color: ${(props) => props.theme.table.header.background};
    color: ${(props) => props.theme.table.header.color};
`;

const GridBody = styled.div`
    flex: 1;
    overflow: auto;
`;

const GridBodyRow = styled(GridLine)`
    border-bottom: 1px solid;
    border-color: ${(props) => props.theme.table.border.color};
`;

const Head = styled(Label)`
    margin: 0 !important;
    padding: 0 10px;
`;

const Cell = styled.div`
    margin: 0 !important;
    padding: 0 10px;

    & > .icon {
        width: 16px;
        height: 16px;
        margin-top: 4px;
    }
`;
