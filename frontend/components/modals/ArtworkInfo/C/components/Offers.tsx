import styled from "styled-components";
import { BuyOrder } from "@dapp/Marketplace";
import { Listings } from "./Listings";

export interface OffersProps {
    offers: BuyOrder[];
}

export function Offers({ offers }: OffersProps) {
    return <Listings listings={offers} emptyTitle="No offers yet." />;
}
