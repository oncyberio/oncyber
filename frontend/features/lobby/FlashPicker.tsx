import { rememberFlashPreview } from "./flashPreview";
import React, { useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { blueAction } from "@styles/brand";
import {
    lobbyPanelTokens,
    lobbyPanelHeading,
    lobbyPanelCard,
    lobbyPanelFooter,
    lobbyPanelSurface,
} from "./lobbyPanelStyles";
import { UserContext } from "@components/context/UserContext";
import Icon from "../landing-carousel/components/Icon";
import useFlashNfts, { flashWallets, type FlashArtwork } from "./useFlashNfts";

const ConnectWallet = dynamic(() => import("@ui/components/ConnectWallet"), {
    ssr: false,
});
export interface FlashPickerProps {
    onSelect: (artwork: FlashArtwork) => void;
    onClose: () => void;
    returnFocusRef?: { current: HTMLElement | null };
    onStop?: () => void;
    showing?: boolean;
}

function ArtworkTile({
    artwork,
    onSelect,
}: {
    artwork: FlashArtwork;
    onSelect: (value: FlashArtwork) => void;
}) {
    const image = useRef<HTMLImageElement>(null);
    const [failed, setFailed] = useState(false);
    return (
        <button
            type="button"
            className="flash-tile"
            disabled={failed}
            aria-label={
                failed
                    ? `${artwork.title} — preview unavailable`
                    : `Flash ${artwork.title}`
            }
            onClick={() => {
                const element = image.current;
                rememberFlashPreview(artwork.imageUrl, element);
                const aspect =
                    element?.naturalWidth && element?.naturalHeight
                        ? Math.min(
                              20,
                              Math.max(
                                  0.05,
                                  element.naturalWidth / element.naturalHeight
                              )
                          )
                        : artwork.aspect;
                onSelect({ ...artwork, ...(aspect ? { aspect } : {}) });
            }}
        >
            <span className="flash-image">
                {failed ? (
                    <span>Preview unavailable</span>
                ) : (
                    <img
                        ref={image}
                        crossOrigin="anonymous"
                        src={artwork.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => setFailed(true)}
                    />
                )}
            </span>
            <span className="flash-title">{artwork.title}</span>
        </button>
    );
}

export default function FlashPicker({
    onSelect,
    onClose,
    returnFocusRef,
    onStop,
    showing,
}: FlashPickerProps) {
    const account = useContext(UserContext);
    const signedIn = !!(account.authenticated && !account.isAnonymous);
    const wallets = signedIn ? flashWallets(account) : [];
    const [chosenWallet, setChosenWallet] = useState("");
    const wallet = wallets.includes(chosenWallet)
        ? chosenWallet
        : wallets[0] || "";
    const collection = useFlashNfts(wallet, signedIn);
    const hasArtwork = signedIn && !!wallet && collection.items.length > 0;
    const [authOpen, setAuthOpen] = useState(false);
    const panel = useRef<HTMLElement>(null);
    const close = useRef<HTMLButtonElement>(null);
    const grid = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = panel.current;
        const opener =
            returnFocusRef?.current || (document.activeElement as HTMLElement);
        close.current?.focus({ preventScroll: true });
        return () => {
            if (
                !document.activeElement ||
                document.activeElement === document.body ||
                element?.contains(document.activeElement)
            )
                queueMicrotask(() => {
                    if (
                        opener?.isConnected &&
                        (!document.activeElement ||
                            document.activeElement === document.body)
                    )
                        opener.focus({ preventScroll: true });
                });
        };
    }, []);
    useEffect(() => {
        panel.current?.toggleAttribute("inert", authOpen);
    }, [authOpen]);
    const navigate = (event: React.KeyboardEvent) => {
        if (
            event.nativeEvent.isComposing ||
            event.keyCode === 229 ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
        )
            return;
        const buttons = Array.from(
            grid.current?.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)"
            ) || []
        );
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        const columns = Math.max(
            1,
            getComputedStyle(grid.current)
                .gridTemplateColumns.split(" ")
                .filter(Boolean).length || 4
        );
        const move = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: columns,
            ArrowUp: -columns,
        }[event.key];
        if (!move && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        event.stopPropagation();
        const next =
            event.key === "Home"
                ? 0
                : event.key === "End"
                ? buttons.length - 1
                : Math.max(0, Math.min(buttons.length - 1, index + move));
        buttons[next]?.focus({ preventScroll: true });
        buttons[next]?.scrollIntoView?.({ block: "nearest" });
    };
    return (
        <>
            <Panel
                ref={panel}
                id="lobby-flash-picker"
                role="dialog"
                aria-labelledby="lobby-flash-title"
                aria-hidden={authOpen || undefined}
                data-compact={!hasArtwork}
                onKeyDown={(event) => {
                    if (
                        authOpen ||
                        event.nativeEvent.isComposing ||
                        event.keyCode === 229
                    )
                        return;
                    if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        onClose();
                    }
                }}
            >
                <header>
                    <h2 id="lobby-flash-title">Flash</h2>
                    {hasArtwork && (
                        <span className="flash-count">Your collection</span>
                    )}
                </header>
                <div className="flash-body">
                    {signedIn && wallets.length > 1 && (
                        <label className="flash-wallet">
                            Wallet
                            <select
                                value={wallet}
                                onChange={(event) =>
                                    setChosenWallet(event.target.value)
                                }
                            >
                                {wallets.map((entry) => (
                                    <option key={entry} value={entry}>
                                        {entry.length > 22
                                            ? `${entry.slice(
                                                  0,
                                                  8
                                              )}…${entry.slice(-6)}`
                                            : entry}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <div
                        className="flash-content"
                        aria-busy={collection.loading}
                    >
                        {!signedIn ? (
                            <div className="flash-state">
                                <p>
                                    Sign in to choose an NFT from your
                                    collection.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setAuthOpen(true)}
                                >
                                    Sign in
                                </button>
                            </div>
                        ) : !wallet ? (
                            <div className="flash-state">
                                <p>Connect a wallet to see your NFTs.</p>
                                <button
                                    type="button"
                                    onClick={() => setAuthOpen(true)}
                                >
                                    Connect wallet
                                </button>
                            </div>
                        ) : (
                            <>
                                {collection.items.length > 0 && (
                                    <div
                                        className="flash-grid"
                                        ref={grid}
                                        role="list"
                                        aria-label="Your NFTs"
                                        onKeyDown={navigate}
                                    >
                                        {collection.items.map((artwork) => (
                                            <div
                                                key={`${artwork.id}:${artwork.imageUrl}`}
                                                role="listitem"
                                            >
                                                <ArtworkTile
                                                    artwork={artwork}
                                                    onSelect={onSelect}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {collection.loading && (
                                    <p className="flash-message" role="status">
                                        Loading your NFTs…
                                    </p>
                                )}
                                {collection.error && (
                                    <div className="flash-state">
                                        <p role="alert">{collection.error}</p>
                                        <button
                                            type="button"
                                            onClick={collection.retry}
                                        >
                                            Try again
                                        </button>
                                    </div>
                                )}
                                {!collection.loading &&
                                    !collection.error &&
                                    !collection.items.length && (
                                        <p
                                            className="flash-message"
                                            role="status"
                                        >
                                            No NFTs with an image preview were
                                            found in this wallet.
                                        </p>
                                    )}
                                {collection.hasMore && !collection.error && (
                                    <button
                                        className="flash-more"
                                        type="button"
                                        disabled={collection.loading}
                                        onClick={collection.loadMore}
                                    >
                                        Load more
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
                <footer>
                    <button
                        ref={close}
                        className="panel-close"
                        type="button"
                        aria-label="Close Flash"
                        onClick={onClose}
                    >
                        <Icon name="close" size={16} />
                    </button>
                    <span className="panel-status">
                        <span>
                            {showing
                                ? "Showing your Flash"
                                : hasArtwork
                                ? "Choose an NFT to show"
                                : "Your collection"}
                        </span>
                    </span>
                    {showing && onStop && (
                        <button
                            className="panel-action"
                            type="button"
                            onClick={onStop}
                        >
                            Stop Flash
                        </button>
                    )}
                </footer>
            </Panel>
            {authOpen && (
                <ConnectWallet
                    open
                    toggle={() => setAuthOpen(false)}
                    noShowClose={false}
                    fullScreenMobile={false}
                />
            )}
        </>
    );
}

const Panel = styled.section`
    ${lobbyPanelTokens}
    --lobby-panel-width: 456px;
    position: absolute;
    z-index: 7;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(var(--lobby-panel-width), calc(100vw - 32px));
    max-height: calc(100dvh - 140px - env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: var(--lobby-panel-gap);
    box-sizing: border-box;
    text-shadow: none;
    pointer-events: auto;
    &[data-compact="true"] {
        width: min(var(--lobby-panel-compact-width), calc(100vw - 32px));
    }
    header {
        ${lobbyPanelHeading}
    }
    .flash-count {
        margin-left: auto;
        color: #c2c2bd;
        font-size: 11px;
    }
    .flash-body {
        ${lobbyPanelSurface}
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }
    p {
        margin: 0;
        color: #c2c2bd;
        font-size: 12px;
        line-height: 1.5;
    }
    button,
    select {
        color: inherit;
        font: inherit;
        font-size: 12px;
        border: 1px solid #ffffff2e;
        border-radius: 12px;
        background: #ffffff08;
    }
    button {
        cursor: pointer;
        min-height: 32px;
        padding: 6px 12px;
    }
    button:hover:not(:disabled) {
        border-color: #ffffff66;
        background-color: #ffffff0d;
    }
    button:disabled {
        cursor: default;
        opacity: 0.5;
    }
    button:focus-visible,
    select:focus-visible {
        outline: 2px solid var(--oc-accent, #2567ff);
        outline-offset: 2px;
    }
    .flash-wallet {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        gap: 12px;
        color: #c2c2bd;
        padding: 8px 12px 0;
        font-size: 12px;
    }
    select {
        min-width: 0;
        width: 100%;
        min-height: 32px;
        padding: 6px 12px;
        color-scheme: dark;
    }
    .flash-content {
        min-height: 0;
        max-height: min(
            220px,
            calc(100dvh - 240px - env(safe-area-inset-bottom))
        );
        overflow-y: auto;
        touch-action: pan-y;
        overflow-x: hidden;
        overscroll-behavior: contain;
        padding: 10px 12px;
        scrollbar-width: thin;
        scrollbar-color: #ffffff30 transparent;
        scroll-padding-block: 10px;
    }
    .flash-grid {
        position: relative;
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: var(--lobby-panel-gap);
    }
    .flash-grid > [role="listitem"] {
        min-width: 0;
    }
    .flash-tile {
        ${lobbyPanelCard}
        width: 100%;
        display: flex;
        flex-direction: column;
        padding: 0;
        overflow: hidden;
        text-align: left;
    }
    .flash-image {
        width: 100%;
        aspect-ratio: 1;
        flex-shrink: 0;
        overflow: hidden;
        background: #080a0d40;
        display: grid;
        place-items: center;
    }
    .flash-image img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .flash-image > span {
        padding: 8px;
        font-size: 10px;
        text-align: center;
        color: #c2c2bd;
    }
    .flash-title {
        box-sizing: border-box;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 5px 6px;
        background: linear-gradient(180deg, #11151b20, #11151b80);
        box-shadow: inset 0 1px 0 #ffffff12;
        font-size: 10px;
        line-height: 14px;
    }
    .flash-state {
        min-height: 112px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        text-align: center;
        padding: 8px;
    }
    .flash-state button {
        ${blueAction}
        min-height: 40px;
        padding: 8px 16px;
        font-size: 12px;
    }
    .flash-message {
        padding: 28px 12px;
        text-align: center;
    }
    .flash-more {
        display: block;
        min-height: 36px;
        margin: 16px auto 0;
    }
    footer {
        ${lobbyPanelFooter}
    }
    @media (max-width: 850px) {
        .flash-body {
            margin-bottom: 60px;
        }
    }
    @media (max-width: 520px) {
        .flash-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        select {
            font-size: 16px;
        }
    }
`;
