import isEmpty from "lodash/isEmpty";
import Icon from "../components/Icon";
import { useRouter } from "next/router";
import Tabs from "../components/explore/Tabs";
import styled, { css } from "styled-components";
import { nodeEnv } from "@env";
import RadUser from "../components/explore/RadUser";
import { useContext, useEffect, useState } from "react";
import ExhibitsLayout from "../components/layouts/exhibits";
import { UserContext } from "../components/context/UserContext";
import { amplitude_logAnalyticsEvent } from "../utils/analytics";
import { RoundButton } from "../components/DesignSystem/buttons";
import { ThemeContext } from "../components/context/ThemeProvider";
import ExhibitPagination from "../components/explore/ExhibitPagination";

const tabs = [
    {
        key: "today-most-visited",
        name: "Trending Now",
    },
    {
        key: "most-visited",
        name: "Most Popular",
    },
    {
        key: "latest",
        name: "Latest Worlds",
    },
];

export default function Explores() {
    const router = useRouter();

    const { isLightTheme, setLightMode } = useContext(ThemeContext);
    const { user } = useContext(UserContext);

    const [search, setSearch] = useState<string>("");
    const [searchLoading, setSearchLoading] = useState<boolean>(false);
    const [radUser, setRadUser] = useState<Record<string, string>>({
        username: "",
        walletId: "",
    });
    const [isActive, setActive] = useState<string>(tabs[0].key);

    useEffect(() => {
        amplitude_logAnalyticsEvent(`view_listing`, {
            user_id: user?.id,
            listing_name: "Visit Explore Page",
            source: "Home Tab",
        });
    }, []);

    useEffect(() => {
        amplitude_logAnalyticsEvent(`view_listing`, {
            user_id: user?.id,
            listing_name: isActive,
            source: "Home Tab",
        });
    }, [isActive]);

    useEffect(() => {
        if (router.query?.q) {
            setSearch(router.query?.q.toString() || "");
            setSearchLoading(true);
        }
    }, [router.query]);

    const handleSearchInput = (event) => {
        if (!isEmpty(event.target.value)) {
            setSearch(event.target?.value);
        } else {
            setSearch("");
            router.replace("/explore", undefined, { shallow: true });
        }
        setSearchLoading(false);
    };

    const handleRadUser = (payload) => {
        setSearch("");
        setSearchLoading(false);
        setRadUser(payload);
        if (router.query?.q) {
            router.replace("/explore", undefined, { shallow: true });
        }
    };

    const handleSearchSubmit = () => {
        setRadUser({
            username: "",
            walletId: "",
        });
        setSearchLoading(true);
        router.push(`/explore?q=${search}`);
    };

    const handleSearchKeyDown = (event) => {
        if (event.keyCode === 13 && event.target.value !== "") {
            handleSearchSubmit();
        }
    };

    return (
        <ExhibitsLayout
            isLight={isLightTheme}
            setLightMode={setLightMode}
            isActive={"Exhibits"}
        >
            <Container isLight={isLightTheme}>
                <Headline isLight={isLightTheme}>
                    <div className="background">
                        <video
                            src={
                                isLightTheme
                                    ? "https://cyber.mypinata.cloud/ipfs/QmeeBF2rvgkAcGJ88sRFB3dbDY27qJXxh8WtvCkwLZ1zD5?filename=logo-light.mp4"
                                    : "https://cyber.mypinata.cloud/ipfs/QmRTsqvmcNeE8Dr8NiC2U2Hyh1XAj3k18MXSdMBNHJ7oT9?filename=logo.mp4"
                            }
                            autoPlay
                            loop
                            playsInline
                            muted
                        ></video>
                    </div>
                    <div className="content">
                        <img
                            className="invertColor"
                            src="https://cyber.mypinata.cloud/ipfs/QmTHLaPHCurBhSZjQE8kZYxsH1NpoqqM1M94udLEhjrdPV?filename=final-dark_w99mph.svg"
                        />
                    </div>
                </Headline>
                <Body>
                    <InputGroup isLight={isLightTheme}>
                        <input
                            placeholder="Search for a world"
                            onChange={handleSearchInput}
                            onKeyDown={handleSearchKeyDown}
                            value={search}
                        />

                        {!search ? (
                            <Icon name="search" />
                        ) : (
                            <RoundButton
                                style={{ height: "36px" }}
                                isLight={isLightTheme}
                                onClick={handleSearchSubmit}
                            >
                                {" "}
                                {"Search"}
                            </RoundButton>
                        )}
                    </InputGroup>

                    <RadUser
                        isLight={isLightTheme}
                        setRadUser={handleRadUser}
                    />

                    <Tabs
                        items={tabs}
                        search={search}
                        radUser={radUser}
                        isActive={isActive}
                        setActive={setActive}
                        isLight={isLightTheme}
                        searchLoading={searchLoading}
                    />

                    <ExhibitPagination
                        search={search}
                        user_id={user?.id}
                        isLight={isLightTheme}
                        isSubmitting={searchLoading}
                        query={
                            !isEmpty(search) && searchLoading
                                ? `/api/exhibit?type=SEARCH_EXHIBITS&search=${search}`
                                : !isEmpty(radUser?.username) &&
                                  !isEmpty(radUser?.walletId)
                                ? `/api/exhibit?type=GET_RAD_USER_EXHIBITS&walletId=${radUser?.walletId}`
                                : `/api/exhibit?type=FETCH_ALL_EXHIBITS&destination=&isActive=${isActive}`
                        }
                    />
                </Body>
            </Container>
        </ExhibitsLayout>
    );
}

export async function getServerSideProps() {
    const endpoint = `${nodeEnv.PUBLIC_API}/api/exhibit?type=FETCH_ALL_EXHIBITS&destination=&isActive=most-visited`;
    const response = await fetch(endpoint);
    const initialExhibits = await response.json();
    return {
        props: {
            fallback: {
                [endpoint]: initialExhibits,
            },
        },
    };
}

const Container = styled.div`
    width: 100%;
    scroll-snap-type: y mandatory;
    background: ${({ isLight }) => (isLight ? "#fff" : "#000")};
    color: ${({ isLight }) => (isLight ? "#000" : "#fff")};

    .invertColor {
        ${({ isLight }) => isLight && "filter: invert(1) !important;"}
    }
`;

const Headline = styled.div`
    width: 100%;
    max-width: 1260px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 140px 0;
    padding-top: 200px;
    position: relative;
    height: 250px;
    overflow: hidden;

    img {
        width: 100%;

        ${({ isLight }) =>
            !isLight &&
            css`
                -webkit-filter: drop-shadow(5px 5px 5px #222);
                filter: drop-shadow(5px 5px 5px #222);
            `}
    }

    video {
        width: 400px;
        margin: 0 auto;
    }

    .content {
        position: relative;
        z-index: 100;
        max-width: 450px;
        margin: 0 auto;
    }

    .background {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 10;
        display: flex;
        align-items: flex-end;
        overflow: hidden;
        height: 310px;
        width: 100%;
        margin: 0 auto;
    }

    @media (max-width: 1100px) {
        .background {
            width: 100%;
        }

        .content {
            width: 80%;
        }
    }

    @media (max-width: 500px) {
        padding-top: 220px;

        .background {
            height: 320px;
        }

        video {
            width: 90%;
            margin: 0 auto;
        }
    }
`;

const Body = styled.div`
    z-index: 200000;
    max-width: 1260px;
    padding: 0 32px;
    margin: 0 auto;
    overflow: auto;
    min-height: 90vh;
    scroll-snap-align: start;

    & > h1 {
        padding: 16px 0 0 0;
        max-width: 60%;
        font-size: 72px;
        font-weight: 600;
    }

    @media (max-width: 900px) {
        padding: 0 16px;
        & > h1 {
            width: 100%;
            justify-content: center;
            flex-direction: column;
            font-size: 54px;
        }
    }
`;

const InputGroup = styled.div`
    display: flex;
    border-bottom: 1px solid
        ${({ isLight }) =>
            isLight ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.3)"};
    width: 100%;
    padding: 8px 0 4px 0;
    margin: 0px auto 40px auto;
    max-width: 700px;
    input {
        // opacity: 0.4;
        background: transparent;
        outline: none;
        border: none;
        width: 100%;
        color: ${({ isLight }) => (isLight ? "#000" : "#fff")};
        font-size: 20px;
        padding: 8px 0 0 0;
        margin: 0 0 10px 0;

        @media (max-width: 800px) {
            font-size: 16px;
        }
    }

    & > img {
        ${({ isLight }) => isLight && "filter: invert(1)"};
        margin-bottom: 8px;
    }
`;
