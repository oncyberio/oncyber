import { roomSections } from "./roomSections";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import Spinner from "@components/Spinner";
import { useRooms } from "./useRooms";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { UserContext } from "@components/context/UserContext";

import { BuyModal } from "./BuyModal";
import { DestinationListSection } from "./DestinationListSection";
import IconImg from "@ui/components/IconImg";
import { Destination } from "@uitypes/destinations";
import { RoomSection } from "./shared/constants";
import { useRouter } from "next/router";
import { canBuyRoom } from "@dapp/cyberRooms";

interface TabData {
    id: RoomSection;
    title: string;
}

const uploadTab: TabData = {
    id: "uploaded",
    title: "UPLOADED",
};

const tabs: Array<TabData> = [
    {
        id: "owned",
        title: "FREE & OWNED",
    },
    {
        id: "purchase",
        title: "AVAILABLE FOR PURCHASE",
    },
];

interface TagFilter {
    title: string;
    tag: string;
    match: (d: Destination) => boolean;
}

const tags: TagFilter[] = [
    {
        title: "Free",
        tag: "free",
        match(d: Destination) {
            return d.tag.includes("free");
        },
    },
    // {
    //     title: "Polygon",
    //     tag: "polygon",
    //     match(d: Destination) {
    //         return d.blockchain === "polygon";
    //     },
    // },
    // {
    //     title: "RTFKT Pods",
    //     tag: "rtfkt",
    //     match(d: Destination) {
    //         return d.slug.includes("rtfkt");
    //     },
    // },
    {
        title: "oncyber Labs",
        tag: "factory",
        match(d: Destination) {
            return d.tag.includes("factory");
        },
    },
    {
        title: "Curated",
        tag: "curated",
        match(d: Destination) {
            return d.tag.includes("curated");
        },
    },
    {
        title: "& Friends",
        tag: "andfriends",
        match(d: Destination) {
            return d.tag.includes("andfriends");
        },
    },
    {
        title: "Eth",
        tag: "ethereum",
        match(d: Destination) {
            return d.blockchain === "ethereum";
        },
    },
    {
        title: "Community",
        tag: "community",
        match(d: Destination) {
            return (
                d.tag.includes("oncyber-ethereum-community") ||
                d.tag.includes("oncyber-polygon-community")
            );
        },
    },
    {
        title: "Polygon",
        tag: "polygon",
        match(d: Destination) {
            return d.blockchain === "polygon";
        },
    },
];

type Tabs = typeof tabs;

type TabId = Tabs[number]["id"];

const tabIds = tabs.map((tab) => tab.id);

function elVisibleHeight(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    return Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
}

export function DestinationList({ scrollRef }) {
    //
    const { user, dispatch, token } = useContext(UserContext);

    const router = useRouter();

    const {
        context,
        isLoadingRooms,
        rooms,
        ownedRooms,
        loadingError,
        roomsState,
        setRoomsState,
        roomFloorPrices,
    } = useRooms();

    const isFuture = context === "world-builder";

    const [activeTab, setActiveTab] = useState<TabId>("owned");

    const [inputFilter, setInputFilter] = useState<string>(null);

    const [tagFilters, setTagFiters] = useState<Record<string, TagFilter>>({});

    const refs = useRef<Record<TabId, HTMLElement>>({} as any);

    const hasFilters = useMemo(() => {
        return inputFilter || Object.keys(tagFilters).length > 0;
    }, [inputFilter, tagFilters]);

    const filteredRooms = useMemo(() => {
        //
        if (rooms == null || !hasFilters) return rooms;

        let matchingRooms = rooms;

        const tagFilterValues = Object.values(tagFilters);

        if (tagFilterValues.length) {
            matchingRooms = matchingRooms.filter((it) => {
                return tagFilterValues.some((tag) => {
                    return tag.match(it);
                });
            });
        }

        if (inputFilter) {
            let match = inputFilter.toLowerCase();

            matchingRooms = matchingRooms.filter((it) => {
                return (
                    it.slug.toLowerCase().includes(match) ||
                    it.name.toLowerCase().includes(match) ||
                    it.tag.includes(match)
                );
            });
        }

        return matchingRooms;
        //
    }, [rooms, inputFilter, tagFilters]);

    const roomsByTabId = useMemo(() => {
        return roomSections(
            filteredRooms,
            ownedRooms,
            context,
            roomFloorPrices
        );
    }, [filteredRooms, ownedRooms, context, roomFloorPrices]);

    useEffect(() => {
        function handleScroll(e) {
            let id = null;
            let maxVisHeight = -1;

            tabIds.forEach((tabId) => {
                const el = refs.current[tabId];

                if (el) {
                    let visHeight = elVisibleHeight(el);
                    if (visHeight > maxVisHeight) {
                        id = tabId;
                        maxVisHeight = visHeight;
                    }
                }
            });

            if (id) {
                setActiveTab(id);
            }
        }
        //
        window.addEventListener("scroll", handleScroll);

        return () => window.removeEventListener("scroll", handleScroll);
        //
    }, [setActiveTab]);

    // const handleTabClick = (id) => {
    //     // index || 1: if index is 0 'All galleries' go to top
    //     const el = refs.current[id] as HTMLElement;

    //     const header = el.querySelector(".section-header") as HTMLElement;

    //     const top = header.offsetTop - 120;

    //     scrollRef.current?.scrollTo({
    //         behavior: "smooth",
    //         top,
    //     });

    //     setActiveTab(id);
    // };

    const handleChangeInputFilter = useEventCallback((e) => {
        //
        const val = e.target.value.trim();

        setInputFilter(val);
        //
    }, []);

    const handleTagFilterClick = useEventCallback((tagFilter: TagFilter) => {
        setTagFiters((state) => {
            const newState = { ...state };

            if (newState[tagFilter.tag]) {
                delete newState[tagFilter.tag];
            } else {
                newState[tagFilter.tag] = tagFilter;
            }

            return newState;
        });
    }, []);

    const sortedTabs = useMemo(() => {
        if (context === "marketplace") return tabs;
        const hasUploads = roomsByTabId["uploaded"]?.length > 0;

        if (!hasUploads) {
            return tabs.concat(uploadTab);
        } else {
            return [uploadTab].concat(tabs);
        }
    }, [roomsByTabId]);

    const buyingRoom = useMemo(() => {
        //
        if (!roomsState.buyingRoom) return null;

        const buyingRoom = rooms.find(
            (it) =>
                it.slug?.toLowerCase() === roomsState.buyingRoom?.toLowerCase()
        );

        if (buyingRoom && canBuyRoom(buyingRoom)) return buyingRoom;

        return null;
    }, [roomsState.buyingRoom, rooms]);

    return (
        <>
            {buyingRoom && (
                <BuyModal
                    room={buyingRoom}
                    onClose={() => {
                        //
                        setRoomsState((s) => {
                            return { ...s, buyingRoom: null };
                        });

                        const pathname = window.location.pathname;
                        const params = new URLSearchParams(
                            window.location.search
                        );

                        params.delete("buy");

                        const strParams = params.toString();

                        const asUrl = `${pathname}${
                            strParams ? "?" + strParams : ""
                        }`;

                        router.push(
                            {
                                pathname: router.pathname,
                                query: {},
                            },
                            asUrl,
                            { shallow: true }
                        );
                    }}
                />
            )}
            <Search>
                <div className="search-input">
                    <input
                        placeholder="E.g. Cyber Loft"
                        onChange={handleChangeInputFilter}
                    />
                    <IconImg name="search" className="icon" />
                </div>

                {!isFuture && (
                    <div className="search-tags">
                        {tags.map((tag) => {
                            return (
                                <div
                                    key={tag.tag}
                                    className={`search-tag ${
                                        tagFilters[tag.tag] ? "active-tag" : ""
                                    }`}
                                    onClick={() => {
                                        handleTagFilterClick(tag);
                                    }}
                                >
                                    {tag.title}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Search>
            {/* <TabHeaders>
                {tabs.map(({ id, title }) => {
                    const cls =
                        rooms == null
                            ? "disabled"
                            : id === activeTab
                            ? "active"
                            : "";

                    return (
                        <div
                            key={id}
                            className={`tab ${cls}`}
                            onClick={() => handleTabClick(id)}
                        >
                            {title} ({roomsByTabId[id]?.length || 0})
                        </div>
                    );
                })}
            </TabHeaders> */}
            {isLoadingRooms && SpinnerLoader}
            {rooms == null && loadingError && (
                <h1 className="error">Error loading destinations</h1>
            )}
            {!isLoadingRooms && rooms && (
                <TabContent>
                    {sortedTabs.map(({ id, title }) => {
                        //
                        const rooms = roomsByTabId[id];

                        const showWhatever = id === "uploaded" && !hasFilters;

                        return rooms?.length > 0 || showWhatever ? (
                            <DestinationListSection
                                key={id}
                                _ref={(el) => {
                                    refs.current[id] = el;
                                }}
                                title={title}
                                section={id}
                                rooms={rooms}
                                isFuture={isFuture}
                            />
                        ) : null;
                    })}
                </TabContent>
            )}
        </>
    );
}

const Search = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;

    width: 100%;
    max-width: 555px;
    padding: 0 12px;
    margin-bottom: 24px;

    & .search-input {
        width: 100%;
        background: #ffffff;
        border: 1px solid #dfdfe4;
        border-radius: 6px;
        padding: 7px 12px;

        display: flex;
        align-items: center;

        & :has(input:focus) {
            border-color: #070707;
        }

        & > input {
            flex: 1;
            padding: 0;
            border: none;
            outline: none;
        }

        & > .icon {
        }
    }

    & .search-tags {
        display: flex;
        flex-direction: row;
        gap: 8px;
        width: 100%;
        overflow-x: auto;

        @media (min-width: 450px) {
            flex-wrap: wrap;
        }

        & .search-tag {
            background: #f5f5f5;
            border-radius: 4px;
            font-weight: 400;
            font-size: 14px;
            text-align: center;
            padding: 7px 14px;
            white-space: nowrap;
            cursor: pointer;
            user-select: none;
        }

        & .search-tag.active-tag {
            background: rgb(7, 7, 7);
            color: rgb(255, 255, 255);
        }
    }
`;

const TabHeaders = styled.div`
    width: 100%;
    position: sticky;
    top: 0;
    background-color: white;
    display: flex;
    flex-direction: row;
    justify-content: center;
    margin-bottom: 36px;
    padding-bottom: 12px;
    z-index: 1;

    .tab {
        width: 220px;
        padding: 24px 0;
        text-align: center;
        border-bottom: 1px solid #e0e0e0;

        font-family: "Aeonik";
        font-style: normal;
        font-weight: 500;
        font-size: 14px;
        line-height: 100%;
        color: #070707;

        cursor: pointer;
    }

    .tab.active {
        border-bottom: 1px solid #070707;
    }

    .tab.disabled {
        pointer-events: none;
        cursor: not-allowed;
    }
`;

const TabContent = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;

    & > .section:not(:first-child) {
        padding-top: 40px;
        margin-top: 8px;
        border-top: 1px solid #e0e0e0;
    }
`;

const Loader = styled.div`
    width: 100%;
    height: 250px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
`;

const SpinnerLoader = (
    <Loader>
        <Spinner />
    </Loader>
);
