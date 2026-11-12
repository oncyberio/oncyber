import React, { useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";
import Download from "./Download";
import Preview from "./Preview";
import Record from "./Record";
import { useCinematic } from "../../context/CinematicContext";

export function CinematicUI() {
    const { isRecordCompleted, step, videoFormat, bgPreviewRef } =
        useCinematic();

    const containerRef = useRef<HTMLDivElement>(null);

    return ReactDOM.createPortal(
        <div>
            {!isRecordCompleted && step === "processing" && (
                <CinematicBg>
                    <canvas
                        width={videoFormat?.width}
                        height={videoFormat?.height}
                        style={{
                            borderRadius: 8,
                            background: "#000",
                        }}
                        ref={bgPreviewRef}
                    />
                </CinematicBg>
            )}
            <Container
                ref={(el) => {
                    containerRef.current = el;
                }}
            >
                {step === "preview" ? (
                    <Preview containerRef={containerRef} />
                ) : step === "processing" ? (
                    <Record />
                ) : (
                    <Download />
                )}
            </Container>
        </div>,
        document.body
    );
}

export const Container = styled.div.attrs({ "data-studio-surface": true })`
    --bg-color: var(--studio-panel, #181818);
    --color: var(--studio-ink, #f2f2f3);
    --color-sec: var(--studio-secondary);
    --color-label: var(--studio-muted, #a1a1a8);
    --border-color: var(--studio-line, #303035);

    left: 50%;
    top: 49%;
    width: 594px;
    position: fixed;
    overflow-y: auto;
    background: transparent;
    border-radius: var(--studio-radius-panel) !important;
    border: 1px solid var(--studio-line);
    box-shadow: var(--panel-shadow);
    max-height: calc(100vh - 250px);
    transform: translate(-50%, -50%);

    &::-webkit-scrollbar {
        width: 6px;
        border-top-right-radius: 8px;
        border-bottom-right-radius: 8px;
    }

    &::-webkit-scrollbar {
        background: var(--studio-inset);
    }

    &::-webkit-scrollbar-thumb {
        width: 5px;
        border-radius: 8px;
        background: var(--studio-line-strong);
    }

    @media (max-width: 1000px) {
        display: none;
    }

    @media (max-height: 920px) {
        max-height: calc(100vh - 130px);
        border-radius: 0px;

        &::-webkit-scrollbar {
            width: 6px;
            border-radius: 0px;
        }

        &::-webkit-scrollbar-thumb {
            width: 5px;
            border-radius: 0px;
            background: var(--studio-line-strong);
        }
    }

    button:disabled,
    button[disabled] {
        color: var(--studio-muted);
        background: var(--studio-surface);
    }
`;

export const CinematicBg = styled.div`
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    position: fixed;

    canvas {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
`;
