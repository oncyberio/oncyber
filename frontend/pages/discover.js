import styled from "styled-components";
import ExhibitThumbnail from "../components/DesignSystem/cards/ExhibitThumbnail";
import { useEffect, useState, useContext } from "react";
import ExhibitsLayout from "../components/layouts/exhibits";

import Link from "next/link";
import { UserContext } from "../components/context/UserContext";
import Search from "../components/Search";

export default function Exhibit() {
    const [exhibits, setExhibits] = useState({});
    const [isActive, setActive] = useState("hot");
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [noMore, setNoMore] = useState(false);

    const [spotlight, setSpotlight] = useState();

    const getMoreExhibits = async () => {
        setLoadingMore(true);
        const lastVisible =
            exhibits[isActive]?.[exhibits[isActive]?.length - 1]?.id;
        if (!lastVisible) {
            setLoadingMore(false);
            return setNoMore(true);
        }
        try {
            const data = await (
                await fetch(
                    `/api/exhibit?type=FETCH_ALL_EXHIBITS&isActive=${isActive}&lastVisible=${lastVisible}`
                )
            ).json();
            if (data.exhibits.length == 0) setNoMore(true);
            setExhibits({
                [isActive]: [...exhibits[isActive], ...data.exhibits],
            });
        } catch (e) {
            setLoadingMore(false);
        }
        setLoadingMore(false);
    };

    const getExhibits = async () => {
        setLoading(true);

        try {
            const data = await (
                await fetch(
                    `/api/exhibit?type=FETCH_ALL_EXHIBITS&isActive=${isActive}`
                )
            ).json();

            setExhibits({ [isActive]: data.exhibits });

            setLoading(false);
        } catch (e) {
            setLoading(false);
        }
    };

    useEffect(() => {
        // analytics().logEvent("home_visited");
        // fetch spotlight
        fetch(`/api/exhibit?type=GET_SPOTLIGHT_EXHIBIT`)
            .then((res) => res.json())
            .then((res) => {
                console.log(res);
                setSpotlight(res.exhibit);
            });
    }, []);

    useEffect(() => {
        getExhibits();
        // analytics().logEvent(`${isActive}_show`);
    }, [isActive]);

    return (
        <ExhibitsLayout isActive={"Exhibits"}>
            <Container>
                <Body>
                    <SectionTitle
                        style={{ color: "#161616", textAlign: "center" }}
                    >
                        <img src="../images/verified.png" />
                        Live worlds
                    </SectionTitle>
                    <Notice>
                        All NFTs on Cyber either belong to or were minted by
                        their world creator.
                    </Notice>
                    <Search />
                    <Buttons data-cy="home-tabs">
                        <NavButton
                            active={isActive == "latest"}
                            onClick={() => setActive("latest")}
                        >
                            Latest{" "}
                            <span className="hiddenMobile">&nbsp;shows</span>
                        </NavButton>
                        {/* <NavButton active={isActive=='staff'} onClick={() => setActive('staff')}>
                        Staff Picks
                    </NavButton> */}
                        <NavButton
                            active={isActive == "nfts"}
                            onClick={() => setActive("nfts")}
                        >
                            <img src="../images/diamond.gif" /> With Genesis
                        </NavButton>
                        <NavButton
                            active={isActive == "hot"}
                            onClick={() => setActive("hot")}
                        >
                            {/* <img style={{marginRight: 12}} src="../images/cook.gif" />  */}
                            <img src="../images/hot.gif" /> Popular
                        </NavButton>
                    </Buttons>

                    <Grid>
                        {loading && !exhibits[isActive] ? (
                            <>
                                <LoadingThumbnail />
                                <LoadingThumbnail />
                            </>
                        ) : (
                            exhibits[isActive]?.map((exhibit, index) => {
                                if (
                                    !exhibit?.info?.headline ||
                                    !exhibit?.info?.heroImg
                                ) {
                                    return null;
                                }

                                return (
                                    <ExhibitThumbnail
                                        key={index}
                                        data={exhibit}
                                    />
                                );
                            })
                        )}
                        {!loading &&
                            (isActive == "staff" || isActive == "nfts" ? (
                                <></>
                            ) : loadingMore ? (
                                <LoadingThumbnail />
                            ) : (
                                !noMore &&
                                !loading && (
                                    <LoadMore onClick={() => getMoreExhibits()}>
                                        <h1>Load more</h1>
                                    </LoadMore>
                                )
                            ))}
                    </Grid>
                </Body>
            </Container>
        </ExhibitsLayout>
    );
}

const Container = styled.div`
    width: 100%;
    scroll-snap-type: y mandatory;
`;

const SectionTitle = styled.h1`
    font-size: 40px;
    margin: 0 0 0px 0;
    color: rgba(255, 255, 255, 0.98);
    display: flex;
    align-items: center;
    // font-weight: 900;

    img {
        width: 32px;
        margin-right: 8px;
        margin-top: 8px;
    }

    p {
        opacity: 0.6;
    }

    @media (max-width: 1400px) {
        font-size: 36px;
    }

    @media (max-width: 800px) {
        font-size: 30px;
        p {
            text-align: center;
        }
    }
`;

const Notice = styled.p`
    opacity: 0.6;
    @media (max-width: 800px) {
        text-align: center;
    }
`;

const Body = styled.div`
    background: #fafafa !important;
    z-index: 200000;
    padding: 24px 6%;
    overflow: auto;
    min-height: 90vh;
    scroll-snap-align: start;

    & > h1 {
        padding: 16px 0 0 0;
    }

    @media (max-width: 1600px) {
        padding: 2% 6% 4% 6%;
    }

    @media (max-width: 900px) {
        // padding: 24px;

        & > h1 {
            width: 100%;
            justify-content: center;
            flex-direction: column;
        }
    }
`;

const Buttons = styled.div`
    display: flex;
    padding: 24px 0;
    justify-content: flex-start;
    margin-left: 4px;

    @media (max-width: 1200px) {
        margin: 0 0;
        padding: 16px 0 16px 0;
    }

    @media (max-width: 800px) {
        justify-content: center;
    }
`;

const NavButton = styled.div`
    text-align: center;
    padding: 6px 8px;
    width: 175px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    transition: 0.1s;
    margin-right: 10px;
    cursor: pointer;

    background: ${(props) => (props.active ? "#010103" : "transparent")};
    color: ${(props) => (props.active ? "white" : "#010103")};
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
        width: 30px;
        margin-left: -10px;
    }

    transition: 0.2s;

    &:hover {
        background: ${(props) => (props.active ? "#19191b" : "#f1f3f4")};
    }

    @media (max-width: 1100px) {
        font-size: 13px;
        padding: 4px;
        width: 160px;
    }

    @media (max-width: 640px) {
        font-size: 12px;
        padding: 8px;

        .hiddenMobile {
            display: none;
        }

        img {
            width: 24px;
        }
    }
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    width: 100%;
    grid-gap: 20px;
    padding-bottom: 40px;
    padding-top: 20px;
    // overflow: auto;
    grid-auto-rows: 1fr;

    @media (max-width: 1100px) {
        grid-template-columns: 1fr 1fr;
    }

    @media (max-width: 600px) {
        grid-template-columns: 1fr;
    }
`;

const LoadMore = styled.a`
    border-radius: 20px;
    background: #fff;
    min-height: 260px;
    height: 100%;
    width: 100%;
    min-width: 100px;
    display: flex;
    justify-content: center;
    align-items: center;

    transition: 0.3s;
    cursor: pointer;
    border-radius: 20px;
    border: 1px solid #eaeaea;
    // box-shadow: 0 3px 6px rgba(0,0,0,0.12);

    h1 {
        opacity: 0.4;
    }

    &:hover {
        transform: translateY(-4px);
        // box-shadow: rgb(0 0 0 / 25%) 0px 16px 30px;
    }
`;

const LoadingThumbnail = styled.a`
    border-radius: 20px;
    background: #aeaeae;
    border: 1px solid #eaeaea;
    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.12);
    min-height: 260px;
    height: 100%;
    width: 100%;
    min-width: 100px;
    display: flex;
    justify-content: center;
    align-items: center;

    transition: 0.3s;
    cursor: pointer;
    border-radius: 8px;

    h1 {
        opacity: 0.4;
    }
    background: linear-gradient(
        to right,
        #f7f7f7 10%,
        #eeeeee 18%,
        #f7f7f7 33%
    );
    background-size: 800px 104px;
    position: relative;
`;
