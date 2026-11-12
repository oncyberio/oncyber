import styled from "styled-components";
import Spinner from "@components/Spinner";
import { DestinationCell } from "../DestinationCell";
import {
    Ref,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useRooms } from "../useRooms";
import { usePaginator } from "@components/hooks/usePaginator";
import { Pagination } from "./Pagination";
import { UploadNewRoom } from "../Uploader/UploadNewRoom";
import { Destination } from "@uitypes/destinations";
import { UserContext } from "@components/context/UserContext";
import { RoomSection } from "../shared/constants";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useIsoLayoutEffect } from "@components/hooks/useIsoLayoutEffect";
import IconImg from "@ui/components/IconImg";

const PAGE_SIZE = 40;

const MAX_PAGEINATION_LINKS = 5;

export interface DestinationListSectionProps {
    _ref: Ref<HTMLDivElement>;
    section: RoomSection;
    title: string;
    rooms: Destination[];
    isFuture?: boolean;
}

export function DestinationListSection({
    _ref,
    section,
    title,
    rooms,
    isFuture = false,
}: DestinationListSectionProps) {
    //

    const { isCheckingBalances, updateRoom, context } = useRooms();

    const { user } = useContext(UserContext);

    const [visibleImages, setVisibleImages] = useState(PAGE_SIZE);

    const loader = useRef(null);

    const gridRef = useRef<HTMLDivElement>(null);

    const [ownedPage, setOwnedPage] = useState(0);

    const [nbCols, setNbcols] = useState(0);

    const handleObserver = useEventCallback((entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
            setVisibleImages((prev) =>
                Math.min(rooms.length, prev + PAGE_SIZE)
            );
        }
    }, []);

    const oneRowPaging = false;

    let _rooms = useMemo(() => {
        return section != "uploaded" ? rooms : [null].concat(rooms);
    }, [rooms, section]);

    useIsoLayoutEffect(() => {
        //
        if (gridRef.current == null) return;

        function onResize() {
            //
            let rec = gridRef.current.getBoundingClientRect();

            let nbCols = Math.max(1, Math.floor(rec.width / 360));

            gridRef.current.style.setProperty("--nb-cols", String(nbCols));

            setNbcols(nbCols);
        }

        onResize();

        window.addEventListener("resize", onResize);

        return () => window.removeEventListener("resize", onResize);
    }, [gridRef.current]);

    useEffect(() => {
        //

        if (loader.current == null) return;

        const option = {
            root: null,
            rootMargin: "350px",
            threshold: 0,
        };

        const observer = new IntersectionObserver(handleObserver, option);

        observer.observe(loader.current);
        //
    }, [handleObserver, loader.current]);

    // const paginatorState = usePaginator(
    //     rooms.length,
    //     PAGE_SIZE,
    //     MAX_PAGEINATION_LINKS
    // );

    // const { page } = paginatorState;

    useEffect(() => {
        setVisibleImages(Math.min(PAGE_SIZE, rooms.length));
    }, [rooms]);

    const shownRooms = useMemo(() => {
        //
        // if (rooms.length <= PAGE_SIZE) return rooms;

        // const offset = (page - 1) * PAGE_SIZE;
        // const result = rooms.slice(offset, offset + PAGE_SIZE);

        if (oneRowPaging) {
            const pageSize = nbCols;
            const offset = ownedPage * nbCols;
            return _rooms.slice(offset, offset + pageSize);
        } else {
            return _rooms.slice(0, visibleImages);
        }

        //
    }, [_rooms, visibleImages, section, nbCols, ownedPage]);

    const maxOwnedPages = Math.ceil(_rooms.length / nbCols);

    // if (id === "uploaded" && !rooms?.length) {
    //     return (
    //         <NotFound>
    //             <h1 className="not-found-title">
    //                 You haven’t uploaded any spaces yet
    //             </h1>
    //             <p>
    //                 Upload your spaces text describing this feature here with
    //                 cta to take them there
    //             </p>
    //             <NButton
    //                 onClick={() => {
    //                     window.open("/destinations", "_blank");
    //                 }}
    //             >
    //                 Upload Spaces
    //             </NButton>
    //         </NotFound>
    //     );
    // }

    return (
        <Section className="section" ref={_ref}>
            <div className="section-header">
                {section == "owned" && !user?.id ? "FREE TO USE WORLDS" : title}{" "}
                <span className="art">({rooms.length}) </span>
                {oneRowPaging && maxOwnedPages > 1 && (
                    <div className="header-icons pagination">
                        <div
                            className={`page-link ${
                                ownedPage == 0 ? "disabled" : "link"
                            }`}
                            onClick={() => {
                                if (ownedPage > 0) {
                                    setOwnedPage((p) => p - 1);
                                }
                            }}
                        >
                            <IconImg name="chevron-left" />
                        </div>
                        <div
                            className={`page-link link`}
                            onClick={() => {
                                setOwnedPage((p) => (p + 1) % maxOwnedPages);
                            }}
                        >
                            <IconImg name="chevron-right" />
                        </div>
                    </div>
                )}
            </div>
            <DestinationGrid
                nbCols={nbCols}
                ref={gridRef}
                oneRow={oneRowPaging}
            >
                {/* {section === "uploaded" && (!oneRowPaging || ownedPage === 0) && (
                    <UploadNewRoom
                        onUploadSuccess={(destination) => {
                            updateRoom(destination);
                        }}
                    />
                )} */}
                {shownRooms.map((room, index) => {
                    //

                    if (room == null && section === "uploaded") {
                        return (
                            <UploadNewRoom
                                key={index}
                                onUploadSuccess={(destination) => {
                                    updateRoom(destination);
                                }}
                                isFuture={isFuture}
                            />
                        );
                    }

                    return (
                        <DestinationCell
                            key={room.slug}
                            section={section}
                            room={room}
                            isFuture={isFuture}
                        />
                    );
                })}
                {isCheckingBalances && section === "owned" && (
                    <div className="loading-ownership">{SpinnerLoader}</div>
                )}
            </DestinationGrid>
            <div id="inf-loader" ref={loader} />

            {/* <Pagination {...paginatorState} /> */}
        </Section>
    );
}

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    padding: 0 24px;
    user-select: none;

    .art {
        font-family: "PP Editorial New", "Times New Roman", Times, serif;
    }

    & .section-header {
        font-style: normal;
        font-weight: 600;
        font-size: 18px;
        line-height: 18px;
        margin-left: 2px;

        display: flex;
        flex-direction: row;
        gap: 6px;
        align-items: baseline;

        & > .header-icons {
            display: flex;
            flex-direction: icon;
            margin-left: auto;
        }
    }

    & .pagination {
        display: flex;
        flex-direction: row;
        justify-content: center;
        gap: 4px;
        margin-top: 16px;

        & .page-link {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            width: 32px;
            height: 32px;
            user-select: none;
            border-radius: 50%;
            border: 1px solid rgba(7, 7, 7, 0.2);

            & .page-link-text {
                width: 20px;
                height: 14px;
                font-style: normal;
                font-weight: 500;
                font-size: 14px;
                line-height: 100%;

                display: flex;
                justify-content: space-around;
            }
        }

        & .page-link.link {
            cursor: pointer;
        }

        & .page-link.active {
            border: 1px solid #070707;
        }

        & .page-link.disabled {
            opacity: 0.5;
        }
    }
`;

const DestinationGrid = styled.div<{ nbCols: number; oneRow?: boolean }>`
    --nb-cols: 1;
    --col-width: 320px;

    display: grid;
    grid-template-columns: repeat(
        ${(props) => (props.nbCols ? props.nbCols : "auto-fill")},
        minmax(var(--col-width), 1fr)
    );
    grid-column-gap: 24px;
    grid-row-gap: 24px;

    ${(props) =>
        props.oneRow
            ? `height: 290px;
            `
            : ""}
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
