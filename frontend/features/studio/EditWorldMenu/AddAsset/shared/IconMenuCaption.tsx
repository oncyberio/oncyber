//

import IconImg from "@ui/components/IconImg";
import React from "react";
import styled from "styled-components";

export interface IconMenuCaptionProps {
    toggled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}

export function IconMenuCaption({
    toggled = false,
    children,
    className = "",
    style = {},
}: IconMenuCaptionProps) {
    //
    return (
        <Container className={`asset-menu-caption ${className}`} style={style}>
            {children}
            <IconImg
                className="expand"
                name={toggled ? "chevron-up" : "chevron-down"}
                size={16}
            />
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 4px;

    width: 50px;
    height: 32px;
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    border: var(--glass-border-subtle);
    border-radius: var(--radius-pill);
    cursor: pointer;

    &:hover {
        background: var(--glass-bg-hover);
    }

    & > .expand {
        filter: invert(1);
    }

    &:hover > .expand {
        opacity: 0.7;
    }
`;
