import { useContext } from "react";

import { UserContext } from "@components/context/UserContext";
import HomeNavigation from "@components/nav/home";
import HomeFooter from "@components/footer/home";
import styled from "styled-components";
import FilterProvider from "@components/context/FilterContext";
import BuildCTA from "@components/buildcta";
import { feedBasicServerSideProps } from "@utils/serverside/feedBasicServerSideProps";
import Categories from "@components/homepage/categories";
import HomeProvider from "@components/context/HomeContext";
import useFeed from "@components/hooks/useFeed";
import SpacesWrapper from "@components/homepage/spaceswrapper";
import Events from "@components/homepage/events";

function Feed(props) {
    //
    const feed = useFeed();

    const { user } = useContext(UserContext);

    return (
        <HomeProvider isFilter>
            <FilterProvider feed={feed} {...props}>
                <div style={{ position: "relative" }}>
                    <HomeNavigation />
                    <Container>
                        <div style={{ maxWidth: 1280, width: "100%" }}>
                            {user?.id ? <Events /> : null}
                            <MainSectionWrapper>
                                <div className="mobile">
                                    <Categories />
                                </div>

                                <SpacesWrapper />
                                <StickyWrapper>
                                    <Categories />
                                    <BuildCTA />
                                </StickyWrapper>
                            </MainSectionWrapper>
                        </div>
                    </Container>
                    <HomeFooter />
                </div>
            </FilterProvider>
        </HomeProvider>
    );
}

const Container = styled.div`
    padding: 0 24px;
    display: flex;
    justify-content: center;
`;

const MainSectionWrapper = styled.div`
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 48px;
    width: 100%;
    align-items: flex-start;
    padding-top: 48px;
    position: relative;

    @media (max-width: 1320px) {
        gap: 32px;
    }

    @media (max-width: 780px) {
        grid-template-columns: 1fr;
        gap: 16px;
        padding-top: 32px;

        .mobile {
            display: block;
        }
    }

    @media (min-width: 780px) {
        .mobile {
            display: none;
        }
    }
`;

const StickyWrapper = styled.div`
    position: sticky;
    top: 48px;

    @media (max-width: 780px) {
        display: none;
    }
`;

export default Feed;

// export const getServerSideProps = AuthServerSideProps(async () => ({}));
export const getServerSideProps = feedBasicServerSideProps;
