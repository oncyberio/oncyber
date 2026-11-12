import { AssetEventType } from "@dapp/types/AssetEvent";
import styled from "styled-components";

export type EventIconType = AssetEventType | "ShowMore" | "ShowLess";

export interface EventIconProps {
    type?: EventIconType;
}

const iconMap: Record<EventIconType, string> = {
    Mint: "/v2/icons/event-mint.svg",
    Burn: "/v2/icons/event-burn.svg",
    Transfer: "/v2/icons/event-transfer.svg",
    Offer: "/v2/icons/event-offer.svg",
    Listing: "/v2/icons/event-listing.svg",
    Sale: "/v2/icons/event-sale.svg",
    ShowMore: "/v2/icons/event-show-more.svg",
    ShowLess: "/v2/icons/event-show-less.svg",
};

export function EventIcon({ type }: EventIconProps) {
    //
    const src = iconMap[type];

    return <Icon src={src} />;
}

export const Icon = styled.img`
    margin-top: 4px;
    width: 14px;
    height: 14px;
    align-self: center;
    filter: invert(1);
`;
