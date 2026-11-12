import { preloadStudio } from "@features/studio/loadStudio";
import { prepareStudio } from "@features/studio/prepareStudio";
import { useRouter } from "next/router";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
import {
    RoomsProvider,
    useRooms,
} from "@features/spaces/create/components/DestinationSelector/useRooms";
import {
    roomSections,
    canUseTemplate,
} from "@features/spaces/create/components/DestinationSelector/roomSections";
import { getRoomExternalLink } from "@dapp/cyberRooms";
import ProviderButtons from "@components/modals/SignupProvider/ProviderButtons";
import { ProviderButtonsWrapper } from "@components/modals/SignupProvider/ProviderButtonsWrapper";
import { LandingCard } from "../types";
import { createEmptySpace } from "@features/spaces/create/utils";

import type { TemplateCategory } from "../templateSearch";
import { createTemplateCards, templateCover } from "../templateCards";
import useTemplateRefresh from "../hooks/useTemplateRefresh";
type CatalogProps = {
    onChange: (data: TemplateGridData) => void;
    query: string;
    category: TemplateCategory;
    active: boolean;
};
export interface TemplateGridData {
    cards: LandingCard[];
    loading: boolean;
    opening: boolean;
    checking: boolean;
    error: string;
    open: (card: LandingCard) => void;
}
export default function TemplateCatalog(props: CatalogProps) {
    const router = useRouter();
    const { token, user, isAnonymous } = useContext(UserContext);
    useEffect(() => {
        if (!props.active) return;
        // Give the catalog its first paint, then prepare the editor while choosing.
        const timer = setTimeout(() => {
            void preloadStudio().catch(() => {});
            void router.prefetch("/studio").catch(() => {});
        }, 500);
        return () => clearTimeout(timer);
    }, [props.active, router]);

    async function openStudio(exhibit) {
        // The picked card keeps its loading state until Studio's code is in,
        // so the editor mounts right away instead of a blank route.
        await Promise.all([
            preloadStudio().catch(() => {}),
            prepareStudio(exhibit, !token || isAnonymous),
        ]);
        if (!(await router.push("/studio")))
            throw new Error(
                "Navigation was cancelled. Your space is saved; try opening it again."
            );
    }
    return (
        <RoomsProvider
            context="template"
            onCreateSpace={openStudio}
            onCreateEmptyStudioSpace={async () =>
                openStudio(await createEmptySpace(user?.id, token))
            }
        >
            <Catalog {...props} />
        </RoomsProvider>
    );
}
function Catalog({ onChange, query, category, active }: CatalogProps) {
    const {
        rooms,
        ownedRooms,
        roomFloorPrices,
        isLoadingRooms,
        isCheckingBalances,
        loadingError,
        handleCreateSpace,
        onCreateEmptyStudioSpace,
        roomsState,
        refetchRooms,
    } = useRooms();
    const { authenticated, isAnonymous } = useContext(UserContext);
    const router = useRouter();
    const [opening, setOpening] = useState(false);
    const [openingId, setOpeningId] = useState<string>(null);
    const openingRef = useRef(false);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState<string>(null);
    const [signingIn, setSigningIn] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const groups = useMemo(
        () => roomSections(rooms, ownedRooms, "template", roomFloorPrices),
        [rooms, ownedRooms, roomFloorPrices]
    );
    const cards = useMemo(
        () =>
            isLoadingRooms && !rooms.length
                ? []
                : createTemplateCards(
                      groups,
                      ownedRooms,
                      query,
                      category,
                      isCheckingBalances
                  ),
        [
            groups,
            category,
            ownedRooms,
            query,
            isCheckingBalances,
            isLoadingRooms,
            rooms.length,
        ]
    );
    useTemplateRefresh(
        active,
        isLoadingRooms || isCheckingBalances || opening,
        refetchRooms
    );
    async function open(card: LandingCard) {
        if (openingRef.current || roomsState.roomCreatingSpace) return;
        const room = rooms.find((room) => room.slug === card.room);
        if (room && !canUseTemplate(room, ownedRooms, isCheckingBalances)) {
            setSelected(room.slug);
            setSigningIn(false);
            return;
        }
        if (!room && card.id !== "template-blank") return;
        openingRef.current = true;
        setOpening(true);
        setOpeningId(card.id);
        setError("");
        try {
            if (card.id === "template-blank") await onCreateEmptyStudioSpace();
            else if (!(await handleCreateSpace(room)))
                throw new Error(
                    "Could not open this template. Please try again."
                );
        } catch (failure) {
            openingRef.current = false;
            setOpening(false);
            setOpeningId(null);
            setError(
                failure.message || "Could not open Studio. Please try again."
            );
        }
    }
    useEffect(() => {
        onChange({
            cards: openingId
                ? cards.map((card) =>
                      card.id === openingId ? { ...card, opening: true } : card
                  )
                : cards,
            checking: isCheckingBalances,
            loading: isLoadingRooms,
            opening: opening || !!roomsState.roomCreatingSpace,
            error: error || loadingError || "",
            open,
        });
    }, [
        cards,
        isCheckingBalances,
        isLoadingRooms,
        loadingError,
        error,
        opening,
        openingId,
        roomsState.roomCreatingSpace,
        refetchRooms,
        onChange,
    ]);
    useEffect(() => {
        if (selected && dialog.current && !dialog.current.open)
            dialog.current.showModal();
    }, [selected]);
    const room = rooms.find((room) => room.slug === selected);
    if (!room) return null;
    const ready = canUseTemplate(room, ownedRooms, isCheckingBalances);
    const external = getRoomExternalLink(room);
    let listing = "";
    try {
        const url = new URL(external);
        if (url.protocol === "https:") listing = url.href;
    } catch {}
    const onOpenSea =
        listing &&
        (new URL(listing).hostname === "opensea.io" ||
            new URL(listing).hostname.endsWith(".opensea.io"));
    return (
        <Details
            ref={dialog}
            aria-labelledby="template-title"
            onClose={() => setSelected(null)}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
                if (event.target === dialog.current) dialog.current.close();
            }}
        >
            <div className="body">
                <button
                    className="close"
                    aria-label="Close room details"
                    onClick={() => dialog.current.close()}
                >
                    ×
                </button>
                <div className="visual">
                    <img
                        className="cover"
                        src={templateCover(room)}
                        alt={room.name}
                    />
                </div>
                <div className="content">
                    <span className="eyebrow">
                        {room.tag.includes("free")
                            ? "FREE GALLERY"
                            : ready
                            ? "YOUR GALLERY"
                            : "COLLECTIBLE GALLERY"}
                    </span>
                    <h2 id="template-title">{room.name}</h2>
                    <p className="description">
                        {room.description ||
                            "A collectible space for your art and exhibitions."}
                    </p>
                    {!ready && (
                        <div className="ownership">
                            <strong>A collectible space</strong>
                            <p>
                                Own this gallery to make it yours. Already
                                collected it? Sign in with your linked wallet.
                            </p>
                        </div>
                    )}
                    {ready ? (
                        <button
                            disabled={opening}
                            className="primary"
                            onClick={() =>
                                open({ room: room.slug } as LandingCard)
                            }
                        >
                            {opening ? "Opening Studio…" : "Use this gallery →"}
                        </button>
                    ) : (
                        <div className="actions">
                            {listing ? (
                                <a
                                    className="primary"
                                    href={listing}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {onOpenSea
                                        ? "View on OpenSea ↗"
                                        : "View marketplace ↗"}
                                </a>
                            ) : (
                                <p>
                                    No marketplace listing is available for this
                                    room yet.
                                </p>
                            )}
                            {(!authenticated || isAnonymous) && (
                                <button
                                    onClick={() =>
                                        setSigningIn((value) => !value)
                                    }
                                >
                                    I already own this →
                                </button>
                            )}
                        </div>
                    )}
                    {signingIn && (!authenticated || isAnonymous) && (
                        <ProviderButtonsWrapper
                            authCallback={async () => {
                                await router.replace(router.asPath);
                            }}
                        >
                            <ProviderButtons isDarkTheme hideHeader />
                        </ProviderButtonsWrapper>
                    )}
                    <p className="status" role="status">
                        {isCheckingBalances && authenticated && !isAnonymous
                            ? "Checking your connected wallets…"
                            : ready
                            ? room.tag.includes("free")
                                ? "Free to create. Make it yours in Studio."
                                : "Owned by you · Ready to customize"
                            : authenticated && !isAnonymous && !loadingError
                            ? "Ownership updates automatically. Make sure the purchasing wallet is linked to your account; recent purchases may take a moment to appear."
                            : ""}
                    </p>
                    {(loadingError || error) && (
                        <p role="alert">{loadingError || error}</p>
                    )}
                </div>
            </div>
        </Details>
    );
}
const Details = styled.dialog`
    padding: 0;
    margin: auto;
    width: min(960px, calc(100vw - 48px));
    max-height: calc(100svh - 48px);
    overflow: auto;
    background: var(--oc-panel);
    color: var(--oc-ink);
    border: 1px solid var(--oc-line-strong);
    border-radius: 24px;
    box-shadow: 0 32px 100px #0008;
    &::backdrop {
        background: #0009;
        backdrop-filter: blur(12px);
    }
    .body {
        position: relative;
        display: grid;
        grid-template-columns: 1.12fr 1fr;
        min-height: 490px;
    }
    .visual {
        display: flex;
        align-items: center;
        background: #101112;
        overflow: hidden;
    }
    .cover {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
    }
    .content {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 20px;
        padding: 52px 32px 28px;
    }
    .eyebrow {
        font: 10px var(--oc-mono);
        letter-spacing: 0.09em;
        color: var(--oc-muted);
    }
    h2 {
        font-size: clamp(24px, 2.5vw, 32px);
        line-height: 1.08;
        letter-spacing: -0.035em;
        font-weight: 500;
        margin: -8px 0 0;
        text-wrap: balance;
    }
    p {
        font-size: 13px;
        line-height: 1.6;
        color: var(--oc-secondary);
        margin: 0;
    }
    .description {
        margin-bottom: 8px;
    }
    .ownership {
        margin-top: auto;
        padding-top: 20px;
        border-top: 1px solid var(--oc-line);
    }
    .ownership strong {
        display: block;
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 6px;
    }
    .ownership p {
        color: var(--oc-muted);
        font-size: 12px;
    }
    .actions {
        display: grid;
        gap: 8px;
    }
    button,
    a.primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--oc-line-strong);
        border-radius: 12px;
        padding: 12px 16px;
        min-height: 44px;
        font-size: 13px;
        font-weight: 500;
        background: transparent;
        color: var(--oc-ink);
        cursor: pointer;
        text-decoration: none;
        transition: background 160ms, opacity 160ms;
    }
    button:hover {
        background: var(--oc-hover);
    }
    .primary {
        background: var(--oc-paper) !important;
        color: var(--oc-paper-ink) !important;
    }
    .primary:hover {
        opacity: 0.9;
    }
    button:focus-visible,
    a:focus-visible {
        outline: 2px solid #398bff;
        outline-offset: 3px;
    }
    button.close {
        position: absolute;
        z-index: 1;
        right: 14px;
        top: 14px;
        width: 30px;
        height: 30px;
        min-height: 30px;
        padding: 0;
        font-size: 20px;
        background: #191919dd;
        border-radius: 50%;
        color: #fff;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .status {
        font-size: 11px;
        color: var(--oc-muted);
    }
    .status:empty {
        display: none;
    }
    @media (max-width: 700px) {
        width: calc(100vw - 24px);
        max-height: calc(100svh - 24px);
        .body {
            grid-template-columns: 1fr;
            min-height: 0;
        }
        .visual {
            aspect-ratio: 16 / 10;
        }
        .content {
            padding: 24px;
            gap: 16px;
        }
        h2 {
            font-size: 26px;
        }
    }
`;
