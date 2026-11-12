import { useContext, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import styled from "styled-components";
import shortid from "shortid";
import { UserContext } from "@components/context/UserContext";
import { setCookie, amplitude_logAnalyticsEvent } from "@utils/analytics";
import {
    RoomsProvider,
    useRooms,
} from "@features/spaces/create/components/DestinationSelector/useRooms";
import { UploaderProvider } from "@features/spaces/create/components/DestinationSelector/Uploader/UploaderProvider";
import Header from "@features/landing-carousel/components/Header";
import BottomSearch from "@features/landing-carousel/components/BottomSearch";
import Icon from "@features/landing-carousel/components/Icon";
import {
    Page,
    BrowseSurface,
    EmptyFooter,
    ViewControls,
} from "@features/landing-carousel/components/GridPage";
import EmptyState from "@ui/components/EmptyState";
import {
    LandingActivityProvider,
    useLandingBusy,
} from "@features/landing-carousel/activity";
import type { LandingCard } from "@features/landing-carousel/types";
import {
    destinationCard,
    DestinationFilters as Filters,
    filterDestinations,
} from "./model";
import DestinationDetails from "./components/DestinationDetails";
import DestinationFilters from "./components/DestinationFilters";
import UploadDestination from "./components/UploadDestination";

const Scene = dynamic(
    () => import("@features/landing-carousel/components/Scene"),
    { ssr: false }
);
const ConnectModal = dynamic(() => import("@ui/components/ConnectWallet"), {
    ssr: false,
});
const nothing = () => {};

export default function DestinationsPage() {
    const { user, token, authenticated, isAnonymous } = useContext(UserContext);
    const signedIn = !!(authenticated && user?.id && token && !isAnonymous);
    return (
        <LandingActivityProvider>
            <Head>
                <title>My destinations — Oncyber</title>
            </Head>
            {signedIn ? (
                <RoomsProvider key={`${user.id}:${token}`} context="uploader">
                    <UploaderProvider>
                        <DestinationsGrid />
                    </UploaderProvider>
                </RoomsProvider>
            ) : (
                <SignedOut />
            )}
        </LandingActivityProvider>
    );
}

function SignedOut() {
    const [signIn, setSignIn] = useState(false);
    return (
        <Page>
            <Header menu={<Title>My destinations</Title>} search={null} />
            <main>
                <EmptyState
                    size="page"
                    titleAs="h2"
                    icon="globe"
                    title="Your destinations, in one place."
                    detail="Sign in to manage your uploaded and published destinations."
                    action={{
                        label: "Sign in",
                        icon: <Icon name="arrow" size={12} />,
                        variant: "blue",
                        onClick: () => setSignIn(true),
                    }}
                />
            </main>
            {signIn && (
                <ConnectModal
                    open
                    toggle={() => setSignIn(false)}
                    noShowClose={false}
                    fullScreenMobile={false}
                    skipRedirectToAccount
                />
            )}
        </Page>
    );
}

export function DestinationsGrid() {
    const { rooms, isLoadinUploads, loadingError, refetchRooms } = useRooms();
    const [filters, setFilters] = useState<Filters>({});
    const [query, setQuery] = useState("");
    const [size, setSize] = useState<1 | 2>(2);
    const [flat, setFlat] = useState(false);
    const [dialog, setDialog] = useState<"filters" | "upload" | null>(null);
    const [selectedId, setSelectedId] = useState<string>(null);
    useLandingBusy(isLoadinUploads);
    const items = useMemo(
        () => filterDestinations(rooms || [], filters, query),
        [rooms, filters, query]
    );
    const cards = useMemo(() => items.map(destinationCard), [items]);
    const retained = useRef<LandingCard[]>(cards);
    if (cards.length) retained.current = cards;
    const selected = rooms?.find(
        (room) => (room.slug || room._id) === selectedId
    );
    const filtered =
        !!query || Object.values(filters).some((values) => values.length > 0);
    const contentKey = `explore:destinations:${JSON.stringify([
        filters,
        query,
    ])}`;
    const blocked = !!dialog || !!selected;
    useEffect(() => {
        const sessionId = shortid.generate();
        setCookie("uploader", sessionId);
        amplitude_logAnalyticsEvent("visit_destinations", {
            source: "destinations",
            sessionId,
        });
    }, []);
    useEffect(() => {
        function keyboard(event: KeyboardEvent) {
            const target = event.target as HTMLElement;
            if (
                blocked ||
                target.closest('[role="dialog"], [aria-modal="true"]')
            )
                return;
            if (
                (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
                (event.key === "/" &&
                    !target.closest(
                        'input, textarea, select, [contenteditable="true"]'
                    ))
            ) {
                event.preventDefault();
                const search = document.getElementById(
                    "landing-search"
                ) as HTMLInputElement;
                search?.focus();
                search?.select();
            }
        }
        document.addEventListener("keydown", keyboard);
        return () => document.removeEventListener("keydown", keyboard);
    }, [blocked]);
    const viewControls = (
        <ViewControls>
            <div className="density" role="group" aria-label="Grid size">
                {([2, 1] as const).map((value) => (
                    <button
                        key={value}
                        aria-label={`${value} by ${value} grid`}
                        aria-pressed={size === value}
                        onClick={() => setSize(value)}
                    >
                        {value}×{value}
                    </button>
                ))}
            </div>
        </ViewControls>
    );
    const openUpload = () => setDialog("upload");
    const clear = () => {
        setFilters({});
        setQuery("");
    };
    return (
        <Page>
            <a className="skip-link" href="#destinations">
                Skip to destinations
            </a>
            <Header
                menu={<Title>My destinations</Title>}
                search={
                    <FilterButton
                        aria-haspopup="dialog"
                        aria-expanded={dialog === "filters"}
                        onClick={() => setDialog("filters")}
                    >
                        <Icon name="filter" size={16} />
                        Filters
                        {Object.values(filters).some(
                            (values) => values.length > 0
                        ) && (
                            <span
                                className="active-dot"
                                aria-label="Filters applied"
                            />
                        )}
                    </FilterButton>
                }
            />
            <main id="destinations" aria-label="My destinations">
                <BrowseSurface>
                    {loadingError && cards.length > 0 && (
                        <Notice role="alert">
                            Couldn’t refresh destinations.{" "}
                            <button onClick={() => refetchRooms()}>
                                Try again
                            </button>
                        </Notice>
                    )}
                    <div className="results" aria-busy={isLoadinUploads}>
                        {retained.current.length > 0 && (
                            <Scene
                                cards={retained.current}
                                active={cards.length > 0}
                                interactionsBlocked={blocked}
                                creating={false}
                                onCreate={openUpload}
                                createLabel="Upload destination"
                                createTitle="Upload a gallery destination or Kitbash"
                                featuredActionLabel="Manage destination"
                                browseLabel="My destinations"
                                counterLabel="destinations"
                                onCardActivate={(card) => {
                                    setSelectedId(card.id);
                                    return true;
                                }}
                                contentKey={contentKey}
                                flat={flat}
                                onFlatView={setFlat}
                                columns={size}
                                visibleRows={size}
                                viewControls={viewControls}
                                resetKey={`${contentKey}:${size}`}
                                hasMore={false}
                                loadingMore={false}
                                error={false}
                                loadMore={nothing}
                            />
                        )}
                        {cards.length === 0 && (
                            <EmptyState
                                size="page"
                                titleAs="h2"
                                role={loadingError ? "alert" : "status"}
                                icon={filtered ? "search" : "globe"}
                                title={
                                    isLoadinUploads
                                        ? "Loading your destinations…"
                                        : loadingError
                                        ? "Couldn’t load your destinations."
                                        : filtered
                                        ? "No matching destinations."
                                        : "Your next destination starts here."
                                }
                                detail={
                                    isLoadinUploads
                                        ? null
                                        : loadingError
                                        ? "Please try again."
                                        : filtered
                                        ? "Try another search or remove a filter."
                                        : "Upload a gallery destination or a Kitbash to get started."
                                }
                                action={
                                    isLoadinUploads
                                        ? null
                                        : loadingError
                                        ? {
                                              label: "Try again",
                                              icon: (
                                                  <Icon
                                                      name="arrow"
                                                      size={12}
                                                  />
                                              ),
                                              onClick: () => refetchRooms(),
                                          }
                                        : filtered
                                        ? {
                                              label: "Show all destinations",
                                              icon: (
                                                  <Icon
                                                      name="arrow"
                                                      size={12}
                                                  />
                                              ),
                                              onClick: clear,
                                          }
                                        : {
                                              label: "Upload destination",
                                              icon: (
                                                  <Icon name="plus" size={14} />
                                              ),
                                              variant: "white",
                                              onClick: openUpload,
                                          }
                                }
                            />
                        )}
                    </div>
                    {!cards.length && (
                        <EmptyFooter>
                            <button id="open-create" onClick={openUpload}>
                                Upload destination <span>+</span>
                            </button>
                            {viewControls}
                        </EmptyFooter>
                    )}
                </BrowseSurface>
            </main>
            <BottomSearch
                scope="destinations"
                value={query}
                onChange={setQuery}
                onSearch={setQuery}
            />
            {dialog === "filters" && (
                <DestinationFilters
                    value={filters}
                    onApply={setFilters}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog === "upload" && (
                <UploadDestination onClose={() => setDialog(null)} />
            )}
            {selected && (
                <DestinationDetails
                    key={selectedId}
                    room={selected}
                    onClose={() => setSelectedId(null)}
                />
            )}
        </Page>
    );
}

const Title = styled.h1`
    font: 400 14px/1.5 var(--oc-font);
    color: var(--oc-secondary);
    margin: 0;
    @media (max-width: 700px) {
        font-size: 12px;
        max-width: 95px;
    }
`;
const FilterButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 10px;
    .active-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--oc-accent);
    }
    @media (max-width: 700px) {
        gap: 7px;
    }
`;
const Notice = styled.div`
    position: absolute;
    top: -24px;
    left: 11.3%;
    font-size: 12px;
    color: var(--oc-secondary);
    button {
        padding: 0;
        margin-left: 8px;
        border: 0;
        background: none;
        color: var(--oc-accent);
        cursor: pointer;
    }
`;
