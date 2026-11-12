import { useFilter } from "@components/context/FilterContext";
import Spinner from "@components/Spinner";
import { useRef } from "react";
import styled, { css } from "styled-components";
import Space from "./Space";
import { useCyberTranslation } from "@context/I18nContext";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";

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
        category,
        search,
        searchFilters,
        handleChangeCategory,
    } = useFilter();

    const { t } = useCyberTranslation();

    const containerRef = useRef(null);

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
                    width: "100%",
                    display: "flex",
                    marginTop: 40,
                    justifyContent: "center",
                }}
            >
                <Spinner borderWidth={3} width={40} />
            </Container>
        );
    }

    if (feed.spaceHits.hits.length === 0) {
        return (
            <Container>
                <h3 style={{ margin: 0 }}>{t`NO_RESULTS_FOUND`}.</h3>
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
                        width: "100%",
                        display: "flex",
                        marginTop: 40,
                        justifyContent: "center",
                    }}
                >
                    <Spinner borderWidth={3} width={40} />
                </div>
            ) : null}
        </Container>
    );
}

const Container = styled.div`
    width: 100%;

    ${(props) =>
        IS_MOBILE &&
        css`
            @media (orientation: landscape) {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px 40px;
            }
        `}
`;
