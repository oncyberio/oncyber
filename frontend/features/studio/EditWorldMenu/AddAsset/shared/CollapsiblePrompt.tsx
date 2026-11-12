import Icon from "@components/Icon";
import { Label } from "@features/studio/styles/Label";
import IconImg from "@ui/components/IconImg";
import React, { useState } from "react";
import styled from "styled-components";

export interface CollapsiblePromptProps {
    isCollapsed: boolean;
    onCollapseChange: () => void;
    text: React.ReactNode;
    children: React.ReactNode;
}

export function CollapsiblePrompt({
    isCollapsed,
    onCollapseChange,
    text,
    children,
}: CollapsiblePromptProps) {
    return (
        <Label>
            <PromptContainer
                isCollapsed={isCollapsed}
                onClick={onCollapseChange}
            >
                <IconImg
                    className="chevron"
                    name="chevron-right"
                    size={20}
                    style={{ filter: "invert(0.5" }}
                />
                <span className="prompt">{text}</span>
            </PromptContainer>
            {!isCollapsed && (
                <div style={{ paddingLeft: "8px", marginTop: "16px" }}>
                    {children}
                </div>
            )}
        </Label>
    );
}

const PromptContainer = styled.div<{
    isCollapsed: boolean;
}>`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;
    user-select: none;

    & > .prompt {
        font-size: 12px;
    }

    & > .chevron {
        transition: 0.1s;
        ${({ isCollapsed }) => !isCollapsed && "transform: rotate(90deg);"}
    }
`;
