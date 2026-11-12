import React from "react";
import styled from "styled-components";
import { studioAction } from "@features/studio/styles/primitives";

interface NftEmptyStateProps {
    title: string;
    children?: React.ReactNode;
    action?: { label: string; onClick: () => void };
}

export function NftEmptyState({ title, children, action }: NftEmptyStateProps) {
    return (
        <Container>
            <div role="status">
                <h3>{title}</h3>
                {children && <p>{children}</p>}
            </div>
            {action && (
                <button type="button" onClick={action.onClick}>
                    {action.label}
                </button>
            )}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    padding: 24px 14px;
    border: 1px solid var(--studio-line);
    border-radius: var(--studio-radius-card);
    background: var(--studio-inset);
    text-align: center;

    h3 {
        margin: 0;
        color: var(--studio-secondary);
        font-size: 13px;
        font-weight: 400;
        line-height: 20px;
    }
    p {
        max-width: 245px;
        margin: 4px auto 0;
        color: var(--nft-muted);
        font-size: 13px;
        line-height: 20px;
    }
    button {
        ${studioAction}
        margin-top: 12px;
        border-color: var(--studio-line);
        background: var(--studio-surface);
        font-weight: 400;
    }
`;
