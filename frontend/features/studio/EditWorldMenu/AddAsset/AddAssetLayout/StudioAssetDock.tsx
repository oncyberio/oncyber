import React, { useState, type ReactNode } from "react";
import styled from "styled-components";
import { useScreenSize } from "@components/hooks/useScreenSize";
import { AssetIcon } from "../shared/AssetIcon";
import { assetDockOptions, type AssetOption } from "../shared/AssetTypes";
import { AddAssetLayout } from ".";
import { AssetDock, AssetDockButton, AssetDockShell } from "./AssetDock";

export interface StudioAssetDockProps {
    option: AssetOption | null;
    onOptionChange(option: AssetOption | null): void;
    children?: ReactNode;
    isMobile?: boolean;
    /** Optional action for a source-button click, distinct from closing its panel. */
    onToolClick?(option: AssetOption): void;
}

/** Shared source controls and panel shell; each renderer owns the panel contents. */
export function StudioAssetDock({
    option,
    onOptionChange,
    children,
    isMobile,
    onToolClick,
}: StudioAssetDockProps) {
    const { width } = useScreenSize();
    const mobile = isMobile ?? width <= 600;
    const [expanded, setExpanded] = useState(false);
    return (
        <Dock
            isCollapsed
            activeOpt={option?.value}
            isSelectedMesh={false}
            isEditableMesh={false}
            data-studio-asset-dock
        >
            <div className="floatbar">
                <AssetDockShell>
                    {assetDockOptions(mobile, expanded).map((tool) => {
                        const active = tool.value === option?.value;
                        return (
                            <div key={tool.value}>
                                <AssetDockButton
                                    type="button"
                                    data-tool={tool.value}
                                    $active={active}
                                    aria-label={tool.title}
                                    title={tool.title}
                                    aria-pressed={active}
                                    className={active ? "active" : ""}
                                    onClick={() => {
                                        onOptionChange(active ? null : tool);
                                        onToolClick?.(tool);
                                    }}
                                >
                                    <span className="icon-circle">
                                        {tool.icon}
                                    </span>
                                    <span className="desc mobile-only">
                                        <span className="title">
                                            {tool.title}
                                        </span>
                                    </span>
                                </AssetDockButton>
                            </div>
                        );
                    })}
                    <AssetDockButton
                        id="show-more"
                        type="button"
                        aria-label={
                            expanded
                                ? "Show fewer asset types"
                                : "Show more asset types"
                        }
                        aria-expanded={expanded}
                        onClick={() => setExpanded((value) => !value)}
                    >
                        <span className="icon-circle">
                            <AssetIcon name={expanded ? "less" : "more"} />
                        </span>
                    </AssetDockButton>
                </AssetDockShell>
                {option && (
                    <div className="details">
                        <AddAssetLayout
                            option={option}
                            onClose={() => onOptionChange(null)}
                        >
                            {children}
                        </AddAssetLayout>
                    </div>
                )}
            </div>
        </Dock>
    );
}

// Source controls retain their shared appearance inside hosts with broad button rules.
const Dock = styled(AssetDock)`
    && ${AssetDockButton} {
        background: transparent;
        color: var(--studio-ink, #f2f2f3);
        border: 0;
        border-radius: 8px;
        width: var(--asset-tool-size);
        min-height: var(--asset-tool-size);
        padding: 0;
        margin: 0;
        font: 13px/20px var(--studio-font, sans-serif);
    }
    && ${AssetDockButton}:hover {
        background: transparent;
    }
    && ${AssetDockButton}:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
    && ${AssetDockButton}:focus-visible {
        outline: 2px solid var(--studio-ink);
        outline-offset: 2px;
    }
    @media (min-width: 601px) {
        .mobile-only {
            display: none !important;
        }
    }
    @media (max-width: 600px) {
        && ${AssetDockButton} {
            width: 68px;
            height: 100%;
            padding: 2px;
        }
        && ${AssetDockButton}:focus-visible {
            outline-offset: -3px;
        }
    }
`;
