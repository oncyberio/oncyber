import React, { useEffect, useRef } from "react";
import styled, { ThemeProvider } from "styled-components";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import Icon from "@features/landing-carousel/components/Icon";
import { experienceControl } from "@features/content-host/experienceChrome";
import { brandFoundation } from "@styles/brand";
import { brandTokens as brand } from "@styles/brand/tokens";
import { hasOpenWindow } from "@utils/windowStack";
import { ShareButton } from "./components/ShareButton";

/** Shared visitor artwork shell; NFT data and transaction controls stay in their existing providers. */
export function ArtworkDialog({
    children,
    preview,
    onClose,
    tokenLink,
    shareAction,
}: {
    children: React.ReactNode;
    preview: React.ReactNode;
    onClose: () => void;
    tokenLink?: string;
    shareAction?: React.ReactNode;
}) {
    const { clickRef } = useOnClickOutside({
        handler: (event: MouseEvent | TouchEvent) => {
            // Wallet/transaction prompts use a separate portal above this panel.
            // Interacting with them must not unmount the NFT provider beneath it.
            const target = event.target;
            if (
                target instanceof Element &&
                target.closest(
                    '#dialogs-root, [role="dialog"], [aria-modal="true"]'
                )
            )
                return;
            onClose();
        },
    });
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement;
        closeRef.current?.focus({ preventScroll: true });
        return () => {
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
    }, []);

    function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Escape") {
            // A window above this panel, such as the purchase overlay,
            // answers Escape or ignores it on purpose. The panel stays.
            if (hasOpenWindow()) return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
        } else if (event.key === "Tab") {
            const controls = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
                )
            ).filter((element) => {
                if (element.tabIndex < 0) return false;
                for (
                    let ancestor = element;
                    ancestor && ancestor !== event.currentTarget;
                    ancestor = ancestor.parentElement
                ) {
                    const style = window.getComputedStyle(ancestor);
                    if (
                        ancestor.hidden ||
                        ancestor.hasAttribute("inert") ||
                        ancestor.getAttribute("aria-hidden") === "true" ||
                        style.display === "none" ||
                        style.visibility === "hidden" ||
                        style.visibility === "collapse"
                    )
                        return false;
                }
                return true;
            });
            const first = controls[0],
                last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        }
    }

    return (
        <ThemeProvider
            theme={(theme) => ({
                ...theme,
                // The panel is dark on every page: parts that read the
                // theme type (buttons, fields, charts) must draw for dark.
                type: "dark",
                color: brand.color.ink,
                background: brand.color.panel,
                label: { color: brand.color.muted },
                tab: { header: { color: brand.color.secondary } },
                separator: { color: brand.color.lineStrong },
                border: { ...theme?.border, color: brand.color.lineStrong },
                button: {
                    border: {
                        strong: brand.color.lineStrong,
                        light: brand.color.line,
                    },
                },
                dropdown: { background: brand.color.surface },
            })}
        >
            <Card
                ref={clickRef}
                role="dialog"
                aria-modal="true"
                aria-label="Artwork details"
                data-artwork-dialog
                onKeyDown={onKeyDown}
            >
                <Header>
                    <Label>Artwork details</Label>
                    <Actions>
                        {shareAction ?? (
                            <ShareButton
                                size="40px"
                                onlyDark
                                experience
                                tokenLink={tokenLink}
                            />
                        )}
                        <CloseButton
                            ref={closeRef}
                            type="button"
                            aria-label="Close artwork details"
                            title="Close artwork details"
                            onClick={onClose}
                        >
                            <Icon name="close" size={18} />
                        </CloseButton>
                    </Actions>
                </Header>
                <Body>
                    <Preview>{preview}</Preview>
                    <Details>{children}</Details>
                </Body>
            </Card>
        </ThemeProvider>
    );
}

const Card = styled.div`
    ${brandFoundation};
    --artwork-title-inset: 0px;
    position: fixed;
    inset: 0;
    margin: auto;
    width: min(960px, calc(100vw - 48px));
    height: min(680px, calc(100vh - 80px));
    height: min(680px, calc(100dvh - 80px));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    color: var(--oc-ink);
    background: var(--oc-panel);
    border: 1px solid var(--oc-line-strong);
    border-radius: 24px;
    box-shadow: 0 24px 80px #00000066, var(--oc-shadow);
    overflow: hidden;
    z-index: 100001;

    &,
    * {
        box-sizing: border-box;
    }
    button,
    input,
    select {
        font-family: var(--oc-font);
    }
    button,
    a,
    input {
        &:focus-visible {
            outline: 2px solid var(--oc-accent);
            outline-offset: 3px;
        }
    }
    button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
    .artwork-data {
        height: 100%;
        min-height: 0;
        padding: 0;
        .label,
        .li-label {
            color: var(--oc-muted);
            font-size: 12px;
        }
        button {
            border-radius: var(--oc-radius-control);
        }
        .artwork-asset-info {
            flex: 1;
            min-height: 0;
            padding: 0;
            scrollbar-width: thin;
            scrollbar-color: var(--oc-line-strong) transparent;
        }
        .artwork-ownership {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin: 0 0 20px !important;
            .ownership-separator {
                display: none;
            }
            .labelled-img {
                min-width: 0;
                padding: 10px;
                background: var(--oc-canvas);
                border-radius: 12px;
                gap: 8px;
            }
            .desktop.labelled-img {
                display: flex;
            }
            .li-link {
                color: var(--oc-ink);
                max-width: 100%;
            }
            .labelled-img > div:last-child {
                min-width: 0;
            }
            img {
                width: 32px;
                height: 32px;
            }
        }
        .artwork-title {
            margin: 0 0 20px;
            font-size: 24px;
            line-height: 1.2;
            font-weight: 500;
            overflow-wrap: anywhere;
        }
        .d-artwork-ownership {
            margin: 0 0 20px !important;
            width: 100%;
        }
        .d-artwork-ownership > div {
            --min-item-width: 0px;
            --max-item-width: 100%;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
            gap: 12px;
        }
        .d-artwork-ownership .column {
            min-width: 0;
            align-items: stretch;
        }
        .d-artwork-ownership .li-card {
            min-width: 0;
            width: 100%;
            border-radius: 12px;
            background: var(--oc-canvas);
            border-color: var(--oc-line);
            padding: 10px;
            gap: 8px;
        }
        .d-artwork-ownership .popover.top {
            top: calc(100% + 8px);
            bottom: auto;
            left: 0;
            width: min(320px, calc(100vw - 88px));
            max-height: min(320px, 50dvh);
            padding: 16px;
            border: 1px solid var(--oc-line-strong);
            border-radius: 12px;
            background: var(--oc-panel);
        }
        .d-artwork-ownership .column:last-child:not(:first-child) .popover.top {
            left: auto;
            right: 0;
        }
        .d-artwork-ownership .popover.top::after {
            display: none;
        }
        .d-artwork-ownership .li-desc {
            min-width: 0;
        }
        .d-artwork-ownership .li-link {
            max-width: 100%;
        }
        .d-artwork-ownership .li-label {
            opacity: 1;
            max-width: 100%;
        }
        .artwork-description {
            margin: 0 0 20px;
        }
        .artwork-description .text {
            padding: 0;
            max-height: none;
            overflow: visible;
            margin: 8px 0 0;
            font-size: 14px;
            line-height: 1.6;
            color: var(--oc-secondary);
            opacity: 1;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }
        .artwork-tabs {
            margin-top: 20px !important;
        }
        table {
            --timeline-border-color: var(--oc-line-strong);
        }
        .artwork-order-info {
            padding: 16px 0 0;
            margin: 20px 0 0;
            flex: 0 0 auto;
            gap: 12px;
            flex-wrap: wrap;
            border-color: var(--oc-line-strong);
        }
        .artwork-order-info > * {
            margin-top: 0;
        }
        .artwork-order-error {
            margin: 12px 0 0;
        }
        .artwork-order-info button {
            min-height: 44px;
            height: 44px !important;
            padding: 10px 16px;
            border-color: var(--oc-line-strong);
            background: var(--oc-surface);
            color: var(--oc-ink);
        }
        .artwork-order-info button:hover:not(:disabled) {
            background: var(--oc-hover);
        }
        .artwork-order-info button.primary,
        .artwork-order-info button.buy {
            background: var(--oc-paper);
            color: var(--oc-paper-ink);
        }
        .artwork-order-info .artwork-order-actions {
            margin-left: 0;
            flex: 1;
            width: auto;
            gap: 8px;
            flex-wrap: wrap;
        }
        .artwork-order-info input {
            min-width: 0;
            width: 100%;
        }
    }
    .artwork-mint-data {
        overflow-y: auto;
    }
    @media (max-width: 700px) {
        width: calc(100vw - 24px);
        height: calc(100vh - 32px);
        height: calc(100dvh - 32px);
        border-radius: 16px;
        .artwork-data {
            height: auto;
            overflow: visible;
        }
        .artwork-data .artwork-asset-info {
            overflow: visible;
        }
    }
    @media (max-height: 500px) and (min-width: 701px) {
        height: calc(100vh - 24px);
        height: calc(100dvh - 24px);
    }
`;
const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--oc-line);
    @media (max-width: 700px) {
        padding: 12px 16px;
    }
`;
const Label = styled.span`
    font-size: 14px;
    font-weight: 500;
    color: var(--oc-secondary);
`;
const Actions = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;
const CloseButton = styled.button`
    ${experienceControl};
    background: var(--oc-surface);
`;
const Body = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr);
    min-height: 0;
    @media (max-width: 700px) {
        display: block;
        overflow-y: auto;
        overscroll-behavior: contain;
    }
`;
const Preview = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    padding: 24px;
    background: var(--oc-canvas);
    border-right: 1px solid var(--oc-line);
    img,
    video {
        display: block;
        width: auto;
        max-width: 100%;
        height: auto;
        max-height: 100%;
        object-fit: contain;
        border-radius: 8px;
    }
    @media (max-width: 700px) {
        height: clamp(180px, 28vh, 280px);
        padding: 20px;
        border-right: 0;
        border-bottom: 1px solid var(--oc-line);
    }
`;
const Details = styled.div`
    padding: 24px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    @media (max-width: 700px) {
        padding: 20px;
        overflow: visible;
    }
`;
