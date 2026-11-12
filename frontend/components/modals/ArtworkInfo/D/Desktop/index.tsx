import styled, { createGlobalStyle } from "styled-components";
import React, { useEffect, useRef } from "react";
import IconImg from "@ui/components/IconImg";
import { brandFoundation } from "@styles/brand";
import { experienceControl } from "@features/content-host/experienceChrome";
import { ArtworkMarketplace } from "../components/ArtworkMarketplace";
import { ArtworkHistory } from "../components/ArtworkHistory";
import { ArtworkDescription } from "./ArtworkDescription";
import { ShareButton } from "../components/ShareButton";
import { Ownership } from "../components/Ownership";
import { ArtworkInfoProps } from "../../types";
import { useArtworkInfo } from "../ArtworkContext";

export function ArtworkInfoDesktop({
    toggle,
}: Pick<ArtworkInfoProps, "toggle"> & Partial<ArtworkInfoProps>) {
    const ref = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const { marketplace } = useArtworkInfo();
    useEffect(() => {
        const previous = document.activeElement as HTMLElement;
        closeRef.current?.focus({ preventScroll: true });
        return () => {
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
    }, []);

    return (
        <Container
            ref={ref}
            data-artwork-details
            role="region"
            aria-label="Artwork details"
            onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                event.stopPropagation();
                toggle(false);
            }}
            onClick={(event) => {
                if (event.target === ref.current) toggle(false);
            }}
        >
            <HideWorldControls />
            <TopBar>
                <ShareButton />
                <Control
                    ref={closeRef}
                    type="button"
                    aria-label="Close artwork details"
                    title="Close"
                    onClick={() => toggle(false)}
                >
                    <IconImg className="img" name="x" size={18} />
                </Control>
            </TopBar>
            <Details
                onClick={(event) => {
                    if (event.target === event.currentTarget) toggle(false);
                }}
            >
                <div className="left">
                    <ArtworkDescription />
                    <Ownership />
                </div>
                {marketplace && (
                    <>
                        <div className="center">
                            <ArtworkMarketplace />
                        </div>
                        <div className="right">
                            <ArtworkHistory className="history-fade" />
                        </div>
                    </>
                )}
            </Details>
        </Container>
    );
}

const Container = styled.div`
    ${brandFoundation}
    --artwork-summary-title-size: 16px;
    --artwork-summary-title-leading: 22px;
    --artwork-summary-description-size: 13px;
    --artwork-summary-description-leading: 20px;
    position: fixed;
    inset: 0;
    z-index: 1000000000;
    isolation: isolate;
    box-sizing: border-box;
    height: 100dvh;
    padding: max(16px, env(safe-area-inset-top))
        max(16px, env(safe-area-inset-right))
        max(20px, env(safe-area-inset-bottom))
        max(16px, env(safe-area-inset-left));
    color: var(--oc-ink);
    font-family: var(--oc-font);
    display: flex;
    flex-direction: column;
    gap: 16px;

    /* A transparent fade protects the metadata even when the world is bright.
       The middle of the view stays clear for the selected artwork. */
    &::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background: linear-gradient(
            180deg,
            rgba(4, 5, 7, 0) 32%,
            rgba(4, 5, 7, 0.35) 58%,
            rgba(4, 5, 7, 0.94) 100%
        );
    }
`;

// The details overlay is transparent around the artwork. Hide the normal HUD
// while it is mounted so its buttons cannot show or receive focus underneath.
const HideWorldControls = createGlobalStyle`
    [data-experience-chrome],
    .chat-container,
    [data-world-tips],
    .mobile-joystick,
    .jump-btn {
        display: none !important;
    }
`;

const Details = styled.div`
    min-height: 0;
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 420px) minmax(0, 1fr) minmax(0, 280px);
    align-items: end;
    align-content: safe end;
    gap: clamp(24px, 2.5vw, 48px);
    padding: 0 8px 4px;
    overflow-y: auto;
    overscroll-behavior: contain;

    & > .left {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .left .d-artwork-ownership > div {
        --min-item-width: 0px;
        --max-item-width: 100%;
        width: 100%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }
    .left .column,
    .left .li-desc {
        min-width: 0;
    }
    .left .li-card {
        width: 100%;
    }
    .left .li-link,
    .left .li-label {
        max-width: 100%;
    }

    & > .center {
        min-width: 0;
        width: 100%;
        max-width: 420px;
        justify-self: center;
    }
    .center .artwork-order-info {
        flex-direction: column;
        align-items: center;
        gap: 12px;
    }
    .center .price-info {
        align-items: center;
    }
    .center .artwork-order-actions {
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
    }

    & > .right {
        min-width: 0;
        width: 100%;
    }
    .history-fade {
        flex-direction: column-reverse;
        padding-right: 0;
        width: 100%;
        min-width: 0;
        max-height: min(300px, 38dvh);
        overflow-y: auto;
        scrollbar-width: thin;
        mask-image: linear-gradient(to bottom, transparent, #000 30%);
    }
    .history-fade:hover {
        mask-image: none;
    }

    @media (max-width: 1100px) {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        & > .right {
            display: none;
        }
    }

    @media (max-width: 700px) {
        --artwork-summary-title-size: 14px;
        --artwork-summary-title-leading: 20px;
        --artwork-summary-description-size: 12px;
        --artwork-summary-description-leading: 18px;
        padding: 0;
        grid-template-columns: minmax(0, 1fr);
        align-content: safe end;
        gap: 20px;
        overflow-y: auto;

        & > .center {
            max-width: none;
        }
        .center .artwork-order-info {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
        }
        .center .price-info {
            align-items: flex-start;
        }
        .center .artwork-order-actions {
            flex: 0 1 auto;
            justify-content: flex-start;
        }
    }
`;

const TopBar = styled.div`
    position: relative;
    z-index: 1;
    flex-shrink: 0;
    align-self: flex-end;
    display: flex;
    gap: 8px;
`;

const Control = styled.button`
    ${experienceControl}
    padding: 0;
    & .img {
        filter: invert(1);
    }
`;
