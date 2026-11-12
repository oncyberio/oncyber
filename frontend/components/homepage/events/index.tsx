import styled from "styled-components";
import { useContext, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { IconButton } from "@ui/components/IconButton";
import EventSchedulerService from "@api/eventScheduler/_api";
import { useEventCallback } from "@components/hooks/useEventCallback";
import Event from "./Event";
import { UserContext } from "@components/context/UserContext";

export default function Events() {
    const { user } = useContext(UserContext);
    const [events, setEvents] = useState([]);

    const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
    const [nextBtnDisabled, setNextBtnDisabled] = useState(true);
    const [_selectedIndex, setSelectedIndex] = useState(0);
    const [_scrollSnaps, setScrollSnaps] = useState<number[]>([]);

    const [isScrollable, setIsScrollable] = useState(false);

    const [thumbViewportRef, emblaApi] = useEmblaCarousel({
        startIndex: 0,
        dragFree: false,
        align: "start",
        containScroll: "trimSnaps",
    });

    useEffect(() => {
        let cancelled = false;
        setEvents([]);
        async function init() {
            const _events = await EventSchedulerService.getEvents({});
            if (!cancelled) setEvents(_events);
        }
        //
        init();
        return () => { cancelled = true; };
    }, [user?.id]);

    useEffect(() => {
        if (!emblaApi) return;

        function onInit() {
            setScrollSnaps(emblaApi.scrollSnapList());
        }

        function onSelect() {
            setSelectedIndex(emblaApi.selectedScrollSnap());
            setPrevBtnDisabled(!emblaApi.canScrollPrev());
            setNextBtnDisabled(!emblaApi.canScrollNext());
        }

        onInit();
        onSelect();

        emblaApi.on("reInit", onInit);
        emblaApi.on("reInit", onSelect);
        emblaApi.on("select", onSelect);
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;

        const divContainer = emblaApi.containerNode();

        if (divContainer) {
            const gap = 20;

            const isDivScrollable =
                divContainer.scrollWidth > divContainer.clientWidth + gap;

            setIsScrollable(isDivScrollable);
        }
    }, [emblaApi, events]);

    const scrollPrev = useEventCallback(
        () => emblaApi && emblaApi.scrollPrev(),
        [emblaApi]
    );

    const scrollNext = useEventCallback(
        () => emblaApi && emblaApi.scrollNext(),
        [emblaApi]
    );

    if (!events?.length) return null;

    return (
        <Container>
            <div className="event-header">
                <h3 className="headline">Events</h3>

                {isScrollable && (
                    <Pagination>
                        <IconButton
                            name="chevron-left"
                            mode="dark"
                            size="small"
                            className="pagination-btn"
                            onClick={scrollPrev}
                            disabled={prevBtnDisabled}
                        />

                        <IconButton
                            name="chevron-right"
                            mode="dark"
                            size="small"
                            className="pagination-btn"
                            onClick={scrollNext}
                            disabled={nextBtnDisabled}
                        />
                    </Pagination>
                )}
            </div>

            <div className="event-list scrollbar-hidden">
                <div className="embla embla--thumb">
                    <div className="embla__viewport" ref={thumbViewportRef}>
                        <div className="embla__container embla__container--thumb">
                            {events.map(({ id, ...payload }) => {
                                return (
                                    <Event
                                        setEvents={setEvents}
                                        key={id}
                                        id={id}
                                        {...payload}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </Container>
    );
}

const Container = styled.div`
    padding: 40px 0 20px 0;
    display: flex;
    gap: 12px;
    flex-direction: column;

    & > .event-header {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 10px;

        & > h3.headline {
            margin: 0;
            font-weight: 500;
        }
    }

    & > .event-list {
        max-width: 100%;
        gap: 20px;
        display: flex;
        align-items: center;
        justify-content: flex-start;

        .embla {
            position: relative;
            width: 100%;
            max-width: 100%;
            display: flex;
            align-items: center;
        }

        .embla__viewport {
            max-width: 100%;
            overflow-x: auto;

            &::-webkit-scrollbar {
                display: none;
            }

            -ms-overflow-style: none; /* IE and Edge */
            scrollbar-width: none; /* Firefox */
        }

        .embla__viewport.is-draggable {
            cursor: move;
            cursor: grab;
        }

        .embla__viewport.is-dragging {
            cursor: grabbing;
        }

        .embla__container {
            display: flex;
            user-select: none;
            -webkit-touch-callout: none;
            -khtml-user-select: none;
            -webkit-tap-highlight-color: transparent;
            gap: 20px;
        }

        .embla__slide {
            min-width: 100%;
            position: relative;
        }

        .embla__container--thumb {
            cursor: default;
        }
    }
`;

const Pagination = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;

    .pagination-btn {
        width: 32px;
        height: 32px;
        min-height: 32px;
        min-width: 32px;
        background: transparent;
        border: 1px solid rgba(7, 7, 7, 0.2);

        &:disabled {
            img {
                opacity: 0.2;
            }
        }
    }
`;
