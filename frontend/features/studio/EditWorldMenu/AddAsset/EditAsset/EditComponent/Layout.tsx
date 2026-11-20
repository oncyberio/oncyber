import {
    studioPanel,
    studioHeading,
    studioAction,
} from "@features/studio/styles/primitives";
//

import { getMediaType } from "@components/_3DExhibit-v2/three/utils/mediatype";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { getAssetType } from "@features/studio/EditWorldMenu/utils";
import IconImg from "@ui/components/IconImg";
import styled from "styled-components";
import React, { Component } from "react";
import { AssetType } from "../../shared/AssetTypes";
import { createPortal } from "react-dom";

interface AddAssetLayoutProps {
    title: React.ReactNode;
    help?: { desc?: string; tip?: string };
    tip?: React.ReactNode;
    image?: string;
    style?: React.CSSProperties;
    sideAction?: React.ReactNode;
    children: React.ReactNode;
}

export function EditComponentLayout({
    title,
    help,
    tip,
    image,
    style = {},
    sideAction,
    children,
}: AddAssetLayoutProps) {
    //

    return (
        <Container data-studio-surface style={style}>
            <div className="header">
                {image && (
                    <div className="thumbnail">
                        <img src={image} width={32} height={32} />
                    </div>
                )}

                <div className="title">{title}</div>

                {sideAction && <div className="side-action">{sideAction}</div>}
            </div>
            <div className="body y-scroll">
                {help && (
                    <div className="cl-help">
                        {help.desc && (
                            <div className="cl-desc">{help.desc}</div>
                        )}
                        {help.tip && <div className="cl-tip">{help.tip}</div>}
                    </div>
                )}
                {children}
            </div>
        </Container>
    );
}

const Container = styled.div`
    //
    --separator-color: var(--studio-line, #303035);

    width: 340px;
    z-index: 100;

    display: flex;
    flex-direction: column;
    padding: var(--studio-panel-padding);

    max-height: calc(100vh - var(--edit-asset-top) - 32px);

    @media (max-width: 600px) {
        /* The bottom sheet around it sets the height on phones. */
        max-height: none;
        padding: 12px 18px 0;
        border: 0;
        border-radius: 0 !important;
        width: 100% !important;
        background: transparent;
        box-shadow: none;

        & > .header {
            padding-bottom: 10px;
            & > .side-action {
                gap: 0;
                & > * {
                    display: grid;
                    place-items: center;
                    width: 40px;
                    height: 40px;
                }
                img {
                    filter: invert(0.8) !important;
                }
            }
        }
        & > .body {
            padding-bottom: 16px;
        }
        & > .body > .cl-help > .cl-desc,
        & > .body > .cl-help > .cl-tip {
            font-size: 13px;
            line-height: 18px;
        }
        /* The property editor is built for a mouse (24px rows). Scale it up
           as a whole so every row, label and field grows together. */
        & > .body > .cl-gui {
            zoom: 1.25;
        }
    }

    color: #ffffff;

    background: var(--studio-bg, #141416);
    border: 1px solid var(--studio-line, #303035);
    box-shadow: 0px 2px 40px rgba(0, 0, 0, 0.15);
    ${studioPanel}

    & > .header {
        display: flex;
        flex-direction: row;
        gap: 8px;
        align-items: center;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--separator-color);

        & > .title {
            ${studioHeading}
            color: var(--studio-ink);
        }

        & > .thumbnail {
            width: 32px;
            height: 32px;
            border-radius: var(--studio-radius-preview);
            overflow: hidden;
        }

        & > .side-action {
            margin-left: auto;

            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
    }

    & > .body {
        flex: 1;
        padding-top: 14px;
        min-height: 0;

        display: flex;
        flex-direction: column;
        gap: 16px;

        & > .cl-help {
            flex: 1;
            display: flex;
            flex-direction: column;

            & > .cl-desc,
            & > .cl-tip {
                color: #a7a7a7;
                font-family: var(--studio-font, sans-serif);
                font-size: 12px;
                font-style: normal;
                font-weight: 400;
                line-height: 16px;
            }

            & > .cl-tip {
                font-style: italic;
            }
        }
    }
`;
