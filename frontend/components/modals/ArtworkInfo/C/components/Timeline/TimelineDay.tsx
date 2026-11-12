import { AssetEvent } from "@dapp/Marketplace";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

import { EventIcon, EventIconType } from "./EventIcon";
import { Sep } from "./Sep";
import { Td, Tr } from "./TableStyles";
import { TimelineItem } from "./TimelineItem";

export interface TimelineItemProps {
    date: Date;
    events: AssetEvent[];
    prefItemsNb?: number;
}

const dateFormat = new Intl.DateTimeFormat([], {
    year: "numeric",
    month: "long",
    day: "numeric",
});

interface DateFormatPart {
    type: string;
    value: string;
}

function getPart(
    parts: Intl.DateTimeFormatPart[],
    key: Intl.DateTimeFormatPartTypes
) {
    return parts.find((it) => it.type === key)?.value;
}

function formatDate(date: Date) {
    const parts = dateFormat.formatToParts(date);

    const year = getPart(parts, "year");
    const month = getPart(parts, "month");
    const day = getPart(parts, "day");

    return `${day} ${month} ${year}`;
}

export function TimelineDay({
    date,
    events,
    prefItemsNb = 2,
}: TimelineItemProps) {
    const [isExpanded, setExpanded] = useState(false);

    const filteredEvents = useMemo(() => {
        if (isExpanded) return events;

        if (events.length <= prefItemsNb) return events;

        return events.filter((it, idx) => idx < prefItemsNb);
    }, [events, isExpanded]);

    const handleToggleExpand = useCallback(() => {
        setExpanded((state) => !state);
    }, [setExpanded]);

    const iconType: EventIconType = isExpanded ? "ShowLess" : "ShowMore";

    const hasCommand = events.length > prefItemsNb;

    return (
        <>
            <tr>
                <td colSpan={6}>
                    <DateHeader>{formatDate(date)}</DateHeader>
                </td>
            </tr>

            {filteredEvents.map((event, index) => {
                const showSep =
                    !hasCommand && index === filteredEvents.length - 1;

                return (
                    <TimelineItem key={index} event={event} showSep={showSep} />
                );
            })}

            {hasCommand && (
                <Tr>
                    <Td width="45px" />

                    <Td width="50px" align="center" className="sep">
                        <EventIcon type={iconType} />
                        <Sep />
                    </Td>
                    <Td width="auto" colSpan={4}>
                        <Command onClick={handleToggleExpand}>
                            {isExpanded
                                ? "Show less"
                                : `Show ${
                                      events.length - filteredEvents.length
                                  } more activities`}
                        </Command>
                    </Td>
                </Tr>
            )}
        </>
    );
}

const Container = styled.div``;

const DateHeader = styled.div`
    grid-column-start: 1;
    grid-column-end: 7;
    width: 135px;
    padding: 5px 10px;
    border-radius: 12px;
    font-size: 12px;
    text-align: center;
    border: 1px solid;
    border-color: var(--timeline-border-color);
    color: #999999;
`;

const Command = styled.div`
    cursor: pointer;
`;
