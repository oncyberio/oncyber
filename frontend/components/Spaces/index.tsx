import { useFilter } from "@components/context/FilterContext";
import Spinner from "@components/Spinner";
import { useEffect, useRef } from "react";
import styled, { useTheme } from "styled-components";
import EmptyState, { surfaceOfTheme } from "@ui/components/EmptyState";
import Space from "./Space";

const testHit = {
    artworks: 0,
    cHeroImg: "",
    chains: [""],
    clients: 0,
    collections: [],
    customLink: "",
    description: "",
    fHeroImg: "",
    headline: "",
    heroImg: "",
    number_of_visits: 0,
    objectID: "",
    owner: "",
    path: "",
    priority: -1,
    room: "",
    tags: [{ title: "Trending", key: "trending", filter: true }],
};

export default function Spaces() {
    const {
        feed,
        searchLoading,
        isScrollLoading,
        changePage,
        category,
        search,
        searchFilters,
        handleChangeCategory,
    } = useFilter();

    const containerRef = useRef(null);
    const theme = useTheme() as any;

    useEffect(() => {
        function handleScroll(e) {
            if (containerRef.current) {
                if (
                    window.innerHeight + window.scrollY >=
                    containerRef.current.offsetHeight
                ) {
                    //changePage();
                }
            }
        }

        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, [feed.spaceHits, category, search, searchFilters, isScrollLoading]);

    if (feed.loading) {
        return (
            <Container>
                <Space loader index={0} hit={testHit} />
                <Space loader index={0} hit={testHit} />
                <Space loader index={0} hit={testHit} />
            </Container>
        );
    }

    if (searchLoading && !isScrollLoading) {
        return (
            <Container
                style={{
                    display: "flex",
                    justifyContent: "center",
                    width: "100%",
                }}
            >
                <Spinner />
            </Container>
        );
    }

    if (feed.spaceHits.hits.length === 0) {
        return (
            <Container>
                <EmptyState
                    surface={surfaceOfTheme(theme)}
                    icon="search"
                    title="No worlds found."
                />
            </Container>
        );
    }

    return (
        <Container ref={containerRef}>
            {/* <Pagination /> */}
            {feed.spaceHits.hits.map((hit, index) => {
                return <Space key={index} index={index} hit={hit} />;
            })}

            {isScrollLoading ? (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                    }}
                >
                    <Spinner />{" "}
                </div>
            ) : null}
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
`;
