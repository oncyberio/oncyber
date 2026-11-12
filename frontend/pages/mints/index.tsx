import styled from "styled-components";
import { useEffect, useState } from "react";
import Navigation from "@components/nav/main";
import MintBox from "@components/mints/MintBox";
import { AuthServerSidePropsLite } from "@utils/authServerSideProps";
import { LoadingThumbnail } from "@components/DesignSystem/cards/loading";
import { useCyberTheme } from "@components/context/ThemeProvider";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import DestinationService from "@api/destinations/_api";

export interface DestinationProps {}

function ExploreMints(_props: DestinationProps) {
    const [destinations, setDestinations] = useState([]);

    const [loading, setLoading] = useState(false);

    const { isLightTheme } = useCyberTheme();

    useEffect(() => {
        setLoading(true);

        DestinationService.getUpcomingDestinations({})
            .then((data) => {
                setLoading(false);
                setDestinations(data);

                amplitude_logAnalyticsEvent("visit_mints", {
                    num_of_live_mints: (data || [])?.length,
                });
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    return (
        <Container>
            <NavWrap>
                <Navigation minWidth={"1520px"} />
            </NavWrap>
            <Main>
                <Header>
                    <h1>Next destination mints</h1>
                    <p>
                        This is a schedule for the next destinations to be
                        released on Cyber. <br /> Disclaimer: do not ape in
                        unless you truly enjoy the destination, we're constantly
                        working with talented architects for new destinations to
                        be created & these won't be the last 😎
                    </p>
                </Header>
                <MintWrapper>
                    {loading ? (
                        <>
                            <Loading isLight={isLightTheme} />
                            <Loading isLight={isLightTheme} />
                            <Loading isLight={isLightTheme} />
                            <Loading isLight={isLightTheme} />
                        </>
                    ) : (
                        destinations?.map((dest, index) => (
                            <MintBox key={index} destination={dest} />
                        ))
                    )}
                </MintWrapper>
            </Main>
        </Container>
    );
}

export default ExploreMints;

export const getServerSideProps = AuthServerSidePropsLite(async ({ params }) => {
    return {};
});

const Container = styled.div`
    position: relative;
    width: 100%;
    min-height: 100vh;
    color: #070707;
    background: ${({ theme }) => (theme.type === "light" ? "#fff" : "#000")};
`;

const NavWrap = styled.div`
    display: flex;
    justify-content: space-around;
    align-items: center;
    width: 100%;
    z-index: 10000;
    background: ${({ theme }) => (theme.type === "light" ? "#fff" : "#000")};
`;

const Main = styled.div`
    max-width: 1260px;
    padding: 10px 32px;
    margin: 0px auto;
    min-height: 100%;
`;

const Loading = styled(LoadingThumbnail)`
    width: 49.5%;
    margin-bottom: 20px;

    @media (max-width: 800px) {
        width: 100%;
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 56px;
    text-align: left;
    width: 100%;
    position: sticky;
    z-index: 1;
    top: 0;
    background: ${({ theme }) => (theme.type === "light" ? "#fff" : "#000")};

    h1 {
        font-style: normal;
        font-weight: 600;
        font-size: 42px;
        line-height: 1.5;
        margin-block-start: 0px;
        margin-block-end: 0px;
        max-width: 675px;
        width: 100%;
        color: ${({ theme }) => (theme.type === "light" ? "#000" : "#fff")};

        @media (max-width: 960px) {
            margin-bottom: 12px;
            max-width: 100%;
        }
    }

    p {
        font-size: 16px;
        max-width: 675px;
        font-weight: 400;
        line-height: 24px;
        color: ${({ theme }) => (theme.type === "light" ? "#3d3d3d" : "#fff")};
    }

    @media (max-width: 960px) {
        flex-direction: column;
        text-align: center;
        position: unset;
        background: none;
    }
`;

const MintWrapper = styled.div`
    display: flex;
    flex-wrap: wrap;
    margin-top: 30px;
    align-items: center;
    justify-content: space-between;
`;
