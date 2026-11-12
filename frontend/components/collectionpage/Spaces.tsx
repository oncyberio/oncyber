import FilterProvider, { useFilter } from "@components/context/FilterContext";
import Spaces from "@components/Spaces";
import styled from "styled-components";

const isActiveStyle = (type, category) =>
    category === type || (type === "popular" && !category)
        ? { color: "black" }
        : { color: "rgba(0, 0, 0, 0.6)" };

export default function CollectionSpaces({ collection, feed }) {
    const { handleChangeCategory, category } = useFilter();

    return (
        <Container>
            <Header>
                <p style={{ color: "rgba(0, 0, 0, 0.6)" }}>
                    Total spaces {feed.spaceHits.total}
                </p>
                <FilterWrapper>
                    <p
                        style={isActiveStyle("popular", category)}
                        onClick={() => handleChangeCategory("popular", false)}
                    >
                        Most visited
                    </p>
                    <p
                        style={isActiveStyle("lastModified", category)}
                        onClick={() =>
                            handleChangeCategory("lastModified", false)
                        }
                    >
                        Most recent
                    </p>
                </FilterWrapper>
            </Header>

            <SpacesContainer>
                <Spaces />
            </SpacesContainer>
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
`;

const FilterWrapper = styled.div`
    gap: 12px;
    display: flex;

    p {
        cursor: pointer;
    }
`;

const SpacesContainer = styled.div``;
