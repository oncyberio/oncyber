import { AssetEvent } from "@dapp/Marketplace";
import styled from "styled-components";
import { Label } from "../../style/Label";
import { Account } from "./Account";
import { EventIcon } from "./EventIcon";
import { Sep } from "./Sep";
import { Td, Tr } from "./TableStyles";

const timeFormat = new Intl.DateTimeFormat([], {
    timeStyle: "short",
    hour12: false,
});

export interface TimelineItemProps {
    event: AssetEvent;
    showSep: boolean;
}

const empty = <div />;

export function TimelineItem({ event, showSep }: TimelineItemProps) {
    let suffix1 = empty;
    let label = empty;
    let suffix2 = empty;

    if (event.type === "Mint") {
        suffix1 = <Account account={event?.to} />;
    } else if (event.type === "Burn") {
        suffix1 = <Account account={event?.from} />;
    } else if (event.type === "Transfer") {
        suffix1 = <Account account={event?.from} />;
        label = <TimelineLabel>to</TimelineLabel>;
        suffix2 = <Account account={event?.to} />;
    } else if (event.type === "Sale") {
        suffix1 = <Account account={event?.to} />;
        label = <TimelineLabel>for</TimelineLabel>;
        suffix2 = (
            <div>
                {event.price.toFixed(3)} {event.paymentToken.symbol}
            </div>
        );
    } else if (event.type === "Offer" || event.type === "Listing") {
        suffix1 = <Account account={event?.from} />;
        label = <TimelineLabel>for</TimelineLabel>;
        suffix2 = (
            <div>
                {event.price.toFixed(3)} {event.paymentToken.symbol}
            </div>
        );
    }

    return (
        <Tr>
            <Td width="45px">
                <Hour>{timeFormat.format(event.date)}</Hour>
            </Td>
            <Td width="50px" align="center">
                <EventIcon type={event.type} />
                {showSep && <Sep />}
            </Td>
            <Td width="80px">{event.type}</Td>
            <Td width="100px">{suffix1}</Td>
            <Td width="40px">{label}</Td>
            <Td width="100px">{suffix2}</Td>
        </Tr>
    );
}

const TimelineLabel = styled(Label)`
    font-size: 14px;
`;

const Hour = styled(Label)`
    font-size: 12px;
    font-weight: 400;
    margin-left: 5px;
    color: ${({ theme }) => theme.tab.header.color};
`;
