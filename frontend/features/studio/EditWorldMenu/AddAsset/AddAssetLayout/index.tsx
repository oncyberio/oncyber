import React from "react";
import styled from "styled-components";
import { AssetOption, AssetType } from "../shared/AssetTypes";
import { PanelTypeIcon } from "../shared/PanelTypeIcon";
import { Button } from "@features/studio/styles/Button";
import {
    studioPanel,
    studioHeading,
    studioField,
    studioAction,
} from "@features/studio/styles/primitives";

const panelCopy: Record<AssetType, { title: string; description: string }> = {
    avatar: {
        title: "Avatars",
        description: "Characters and visitor appearance.",
    },
    nft: { title: "NFTs", description: "Curate artwork from your collection." },
    upload: {
        title: "Uploads",
        description: "Your images, videos, audio and 3D models.",
    },
    text: { title: "Text", description: "Make room for a few words." },
    youtube: {
        title: "YouTube",
        description: "Bring videos and live streams into your world.",
    },
    iframe: {
        title: "Websites",
        description: "Put a live webpage on display.",
    },
    portal: {
        title: "Portals",
        description: "Connect your world to another destination.",
    },
    component: {
        title: "World settings",
        description: "Shape the atmosphere and environment.",
    },
    kitbash: {
        title: "Kit assets",
        description: "Build your world, one piece at a time.",
    },
    triggerZone: {
        title: "Interactions",
        description: "Give visitors something to do.",
    },
    globalStream: {
        title: "Audio stream",
        description: "Set the sound of your world.",
    },
};

interface AddAssetLayoutProps {
    option: AssetOption;
    onClose: () => unknown;
    children: React.ReactNode;
}

export function AddAssetLayout({
    option,
    onClose,
    children,
}: AddAssetLayoutProps) {
    const copy = panelCopy[option.value];

    return (
        <Container
            id="asset-layout"
            role="region"
            aria-label={copy.title}
            data-asset-type={option.value}
            data-studio-surface
        >
            <div className="header">
                <div className="heading">
                    <PanelTypeIcon>{option.icon}</PanelTypeIcon>
                    <h2>{copy.title}</h2>
                    <button
                        type="button"
                        className="close"
                        aria-label="Close asset panel"
                        onClick={onClose}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="body scrollbar">{children}</div>
        </Container>
    );
}

const Container = styled.div`
    --nft-ink: var(--studio-ink, #f2f2f3);
    --nft-muted: var(--studio-muted, #a1a1a8);
    --nft-line: var(--studio-line, #303035);
    --nft-mono: var(--studio-mono, monospace);
    display: flex;
    flex-direction: column;
    width: 340px;
    height: min(600px, calc(100dvh - 110px));
    max-height: min(600px, calc(100dvh - 110px));
    overflow: hidden;
    ${studioPanel}

    & > .header {
        flex-shrink: 0;
        padding: 12px var(--studio-panel-padding);
        .heading {
            display: flex;
            align-items: center;
            gap: 10px;
            h2 {
                ${studioHeading}
                font-size: 16px;
                line-height: 22px;
                letter-spacing: 0;
            }
            .close {
                ${studioAction}
                flex-shrink: 0;
                width: 32px;
                height: 32px;
                min-height: 32px;
                margin-left: auto;
                padding: 0;
                color: var(--studio-muted);
            }
        }
    }
    & > .body {
        flex: 1;
        min-height: 0;
        padding: 0 var(--studio-panel-padding) var(--studio-panel-padding);
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: #45454d transparent;
    }
    &[data-asset-type="nft"] > .body {
        padding: 0 var(--studio-panel-padding) var(--studio-panel-padding);
    }

    input:not([type]),
    input[type="text"],
    input[type="url"],
    input[type="search"],
    input[type="email"],
    input[type="number"],
    textarea {
        ${studioField}
    }
    .asset-menu-caption {
        height: 38px;
        background: var(--studio-surface, #1c1c1f);
        border: 1px solid var(--studio-line, #303035);
        border-radius: var(--studio-radius-control);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        &:hover {
            background: var(--studio-hover, #28282c);
        }
    }
    ${Button} {
        min-height: 38px;
        border-radius: var(--studio-radius-control);
    }
    @media (max-width: 600px) {
        width: 100%;
        height: min(420px, calc(100dvh - 150px));
        max-height: min(420px, calc(100dvh - 150px));
        border-radius: var(--studio-radius-panel) var(--studio-radius-panel) 0 0;
        border-bottom: 0;
        & > .header {
            padding: 8px 18px;
            .heading .close {
                width: 44px;
                height: 44px;
                min-height: 44px;
            }
        }
        & > .body {
            padding: 16px 18px;
        }
        &[data-asset-type="nft"] > .body {
            padding: 0 18px;
        }
    }
`;
