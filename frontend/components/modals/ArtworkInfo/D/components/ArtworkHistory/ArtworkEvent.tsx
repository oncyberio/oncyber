import { useProfile } from "@components/hooks/useProfile";
import { AssetEvent } from "@dapp/Marketplace";
import styled from "styled-components";
import { getPofileImg } from "../../utils";
import { useCyberTranslation } from "@components/context/I18nContext";

import { Account } from "./Account";
import { EventIcon } from "./EventIcon";
import { ActivityAvatar } from "../../../ActivityAvatar";

const dateOpts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
};

function formatDate(date: Date) {
    return date.toLocaleDateString("en-US", dateOpts);
}

export interface TimelineItemProps {
    event: AssetEvent;
}

function getEventSrcAccount(event: AssetEvent) {
    // @ts-ignore
    return event.to || event.from;
}

export function ArtworkEvent({ event }: TimelineItemProps) {
    const srcAccount = getEventSrcAccount(event);

    const { t, i18n } = useCyberTranslation();

    const srcProfile = useProfile({
        id: srcAccount?.address?.toLowerCase(),
    });

    const pfp = getPofileImg(srcProfile);

    let desc;
    let date = formatDate(event.date);

    if (event.type === "Mint") {
        desc = (
            <>
                {t`MINTED_BY`} <Account account={event.to} />
            </>
        );
    } else if (event.type === "Burn") {
        desc = (
            <>
                {t`BURNED_BY`} <Account account={event.from} />
            </>
        );
    } else if (event.type === "Transfer") {
        desc = (
            <>
                {t`TRANSFERRED_TO`} <Account account={event.to} />
            </>
        );
    } else if (event.type === "Sale") {
        desc = (
            <>
                {t`SOLD_TO`} <Account account={event.to} /> for{" "}
                <span>
                    {event.price.toFixed(3)} {event.paymentToken.symbol}
                </span>
            </>
        );
    } else if (event.type === "Listing") {
        desc = (
            <>
                {t`LISTED_BY`} <Account account={event.from} /> for{" "}
                <span>
                    {event.price.toFixed(3)} {event.paymentToken.symbol}
                </span>
            </>
        );
    }

    return (
        <Container>
            <div className="pfp">
                <ActivityAvatar
                    address={srcAccount?.address}
                    label={srcAccount?.username || srcAccount?.address}
                    fallbackSrc={pfp.src}
                />
            </div>
            <div className="icon">
                <EventIcon type={event.type} />
            </div>
            <div className="detail">
                <div className="desc">{desc}</div>
                <div className="date">{date}</div>
            </div>
        </Container>
    );
}

const Container = styled.div`
    display: grid;
    grid-template-columns: 24px 24px 1fr;
    grid-gap: 12px;

    & > .pfp {
        width: 24px;
        height: 24px;
        border-radius: 100px;
        overflow: hidden;

        & > img {
            width: 100%;
            height: 100%;
        }
    }

    & > .detail {
        display: flex;
        flex-direction: column;

        & > .desc {
            font-weight: 400;
            font-size: 13px;
            color: #ffffff;

            white-space: nowrap;
        }

        & > .date {
            font-weight: 500;
            font-size: 12px;
            color: #7a7a7a;
        }
    }
`;

const Tooltip = styled.p`
    position: absolute;
    right: 45px;
    top: -5.5px;
    padding: 8px 16px;
    color: #f7f7f7;
    border-radius: 900px;
    background: rgba(7, 7, 7, 0.6);
    border: 0px;
    backdrop-filter: blur(10px);
    font-size: 12px;
    line-height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
`;
