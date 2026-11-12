import last from "lodash/last";
import isEmpty from "lodash/isEmpty";
import { SWRConfiguration, useSWRInfinite } from "swr";
import styled from "styled-components";
import { useCallback, useEffect } from "react";
import { nodeEnv } from "@env";
import { amplitude_logAnalyticsEvent } from "../../utils/analytics";
import { LoadingThumbnail } from "@components/DesignSystem/cards/loading";
import { useIntersectionObserverRef } from "@hooks/useIntersectionObserver";
import ExhibitThumbnail from "@components/DesignSystem/cards/ExhibitThumbnail";
import { fetcher } from "@utils/fetcher";

const flatExhibits = (data) =>
    Array.isArray(data) &&
    data
        ?.flatMap((page) => page.exhibits)
        ?.filter(
            (exhibit) =>
                exhibit?.info?.headline &&
                (exhibit?.info?.heroImg || exhibit?.info?.cHeroImg)  && exhibit?.info?.customLink != 'art-blocks'
        );

const swrOptions: SWRConfiguration = {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    errorRetryInterval: 3000,
    errorRetryCount: 1,
};

export default function Exhibit({
    query,
    search,
    user_id,
    isLight,
    isSubmitting,
}) {
    const getKey = (pageIndex, previousPageData) => {
        if (pageIndex === 0) return `${nodeEnv.PUBLIC_API}/${query}`;
        const { id } = last(previousPageData?.exhibits);
        if (
            pageIndex !== 0 &&
            previousPageData &&
            !previousPageData.length &&
            !isEmpty(id)
        ) {
            return `${nodeEnv.PUBLIC_API}/${query}&page=${pageIndex}&lastVisible=${id}`;
        }
    };

    const { data, size, setSize } = useSWRInfinite(getKey, fetcher, swrOptions);

    useEffect(() => {
        if (isSubmitting && data) {
            amplitude_logAnalyticsEvent(`view_listing`, {
                user_id,
                listing_name: "Submit Search",
                source: "Home Tab",
                query: search,
                Has_results: flatExhibits(data).length > 0,
            });
        }
    }, [isSubmitting, data]);

    const callback = useCallback(
        (entries) => {
            if (!data) return;
            if (entries && entries[0]) {
                const isIntersecting = entries[0]?.isIntersecting;
                if (isIntersecting) {
                    setSize(size + 1);
                }
            }
        },
        [data]
    );

    const [myRef] = useIntersectionObserverRef(callback);

    const exhibits = flatExhibits(data);

    return (
        <Container>
            <Grid>
                {!data ? (
                    <>
                        <LoadingThumbnail isLight={isLight} />
                        <LoadingThumbnail isLight={isLight} />
                        <LoadingThumbnail isLight={isLight} />
                        <LoadingThumbnail isLight={isLight} />
                        <LoadingThumbnail isLight={isLight} />
                        <LoadingThumbnail isLight={isLight} />
                        <LoadingThumbnail isLight={isLight} />
                        <LoadingThumbnail isLight={isLight} />
                        <LoadingThumbnail isLight={isLight} />
                    </>
                ) : isEmpty(exhibits) ? (
                    <div>No worlds have been found</div>
                ) : (
                    exhibits.map((exhibit, index: number) => (
                        <>
                            <ExhibitThumbnail
                                key={index}
                                data={exhibit}
                                ref={
                                    exhibits?.length === index + 1
                                        ? myRef
                                        : null
                                }
                            />
                        </>
                    ))
                )}

                {!isEmpty(exhibits) &&
                    data?.length > 0 &&
                    last(data)?.exhibits?.length !== 0 && (
                        <LoadingThumbnail isLight={isLight} />
                    )}
            </Grid>
        </Container>
    );
}

const Container = styled.div``;

const Grid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    width: 100%;
    grid-gap: 16px;
    padding-bottom: 40px;
    padding-top: 8px;
    grid-auto-rows: 1fr;

    @media (max-width: 1100px) {
        grid-template-columns: 1fr 1fr;
    }

    @media (max-width: 600px) {
        grid-template-columns: 1fr;
    }
`;
