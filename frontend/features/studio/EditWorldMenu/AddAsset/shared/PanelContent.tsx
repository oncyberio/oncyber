import React from "react";
import styled from "styled-components";
import { studioField, studioAction } from "@features/studio/styles/primitives";
import { AssetIcon } from "./AssetIcon";

export const PanelField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;

    & > label {
        color: var(--studio-secondary);
        font: 12px/20px var(--studio-font, sans-serif);
        letter-spacing: 0;
    }
`;

export const PanelInput = styled.input`
    ${studioField}
    width: 100%;
`;

export const PanelButton = styled.button`
    ${studioAction}
    background: var(--studio-ink, #f2f2f3);
    color: var(--studio-bg, #141416);
    &:hover:not(:disabled) {
        background: #fff;
    }
`;

export const PanelNote = styled.p`
    margin: 0;
    color: var(--studio-muted);
    font-size: 13px;
    line-height: 20px;
`;

export const PanelSectionHeading = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 30px;

    & > h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        color: var(--studio-ink);
        font: 12px/20px var(--studio-font, sans-serif);
        letter-spacing: 0;

        & > span {
            color: var(--studio-muted);
            font-size: 11px;
            font-variant-numeric: tabular-nums;
        }
    }
`;

export function PanelEmptyState({
    title,
    children,
}: {
    title: string;
    children?: React.ReactNode;
}) {
    return (
        <EmptyState role="status">
            <h3>{title}</h3>
            {children && <p>{children}</p>}
        </EmptyState>
    );
}

export function PanelPlaceholder({
    icon,
    title,
}: {
    icon: React.ComponentProps<typeof AssetIcon>["name"];
    title: string;
}) {
    return (
        <Placeholder role="status">
            <AssetIcon name={icon} />
            <h3>{title}</h3>
        </Placeholder>
    );
}

const EmptyState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 28px 16px;
    text-align: center;

    & > h3 {
        margin: 0;
        color: var(--studio-muted, #a1a1a8);
        font-size: 13px;
        font-weight: 400;
        line-height: 20px;
    }

    & > p {
        max-width: 240px;
        margin: 6px 0 0;
        color: var(--studio-muted);
        font-size: 13px;
        line-height: 20px;

        & > a {
            color: var(--studio-secondary);
            text-decoration: underline;
            text-underline-offset: 3px;
        }
    }
`;

const Placeholder = styled(EmptyState)`
    flex: 1;
    min-height: 160px;
    border: 1px solid var(--studio-line);
    border-radius: var(--studio-radius-card);
    background: var(--studio-inset);
    gap: 12px;
    color: var(--studio-muted, #a1a1a8);

    & > svg {
        width: 44px;
        height: 44px;
        padding: 10px;
        border: 1px solid var(--studio-line);
        border-radius: var(--studio-radius-control);
        background: var(--studio-surface);
    }
`;
