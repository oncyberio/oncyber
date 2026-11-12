import { AssetEvent } from "@dapp/Marketplace";
import { useMemo, useState } from "react";
import styled from "styled-components";
import { Vert } from "../../style/Flex";
import { TimelineDay } from "./TimelineDay";

interface TimelineItem {
    date: Date;
    events: AssetEvent[];
}

function groupEvents(events: AssetEvent[]): TimelineItem[] {
    //
    const map: Record<string, AssetEvent[]> = {};

    let result: TimelineItem[] = [];

    events.forEach((it) => {
        // if (it.type === "Offer") return;

        const date = new Date(
            it.date.getFullYear(),
            it.date.getMonth(),
            it.date.getDate()
        );

        const key = date.toDateString();

        let items = map[key];

        if (items == null) {
            items = [];
            map[key] = items;

            result.push({
                date,
                events: items,
            });
        }

        items.push(it);
    });

    result.sort((a, b) => b.date.getTime() - a.date.getTime());

    return result;
}

export function AssetTimeline({ events }) {
    const data = useMemo(() => {
        return groupEvents(events);
    }, [events]);

    return (
        <Container>
            <tbody>
                {data.map((it, index) => {
                    return (
                        <TimelineDay
                            key={index}
                            date={it.date}
                            events={it.events}
                        />
                    );
                })}
            </tbody>
        </Container>
    );
}

const Container = styled.table`
    --timeline-border-color: #e0e0e0;

    table-layout: fixed;
    height: 100%;
    font-size: 14px;
    font-weight: 400;
    border-collapse: collapse;
    border-spacing: 0;

    & tr > td:nth-child(2) {
        border-left: 1px solid;
        border-color: var(--timeline-border-color);
    }

    & tr:last-child > td {
        border-color: transparent !important;
    }

    & .sep {
        position: relative;
    }

    /* & .sep::before {
        position: absolute;
        left: 0;
        bottom: 35%;
        transform: translateX(-12%);
        content: url("data:image/svg+xml,%3Csvg width='13' height='30' viewBox='0 0 13 30' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 -5.24546e-07L1 21C1 25.4183 4.58172 29 9 29L13 29' stroke='%23E0E0E0'/%3E%3C/svg%3E%0A");
    } */
`;
