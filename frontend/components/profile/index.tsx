import { useContext, useEffect, useState } from "react";
import Head from "next/head";
import { searchUrl } from "@utils/siteUrl";
import { profileStructuredData } from "@utils/structuredData";
import JsonLd from "@components/JsonLd";
import styled, { css } from "styled-components";
import Navigation from "../nav/main";
import { FollowButton, FollowingList } from "./components/Following";

import useModal from "../modals/useModal";

import ArtworkInfo from "../modals/ArtworkInfo/C";
import Artworks from "../artworks";
import { amplitude_logAnalyticsEvent } from "../../utils/analytics";

import { useAssets } from "../hooks/useAssets";
import { UserContext } from "../context/UserContext";
import Tabs from "../DesignSystem/menus/tabs";
import ExhibitThumbnail_B from "../DesignSystem/cards/ExhibitThumbnail";
import { ThemeContext } from "../context/ThemeProvider";

import Spaces from "./components/Spaces";
import Profile from "@components/modals/Profile";
import { User } from "bitski/lib/auth/user";
import ProfilePicture from "./components/ProfilePicture";
import { showModal } from "@components/Dialogs";
import AccountDashboard from "@components/modals/AccountDashboard";

/** Title, description and canonical address of a profile, for search engines and link previews. */
function ProfileHead({ userData }) {
    const handle = userData?.username || userData?.id;
    if (!handle) return null;
    const name = userData?.username
        ? `@${userData.username}`
        : `${userData.id.slice(0, 6)}…${userData.id.slice(-4)}`;
    const title = `${name} on oncyber`;
    const description = `3D spaces and NFTs by ${name} on oncyber.`;
    const url = searchUrl(`/@${handle}`);
    return (
        <>
            <Head>
                <title key="title">{title}</title>
                <meta
                    key="description"
                    name="description"
                    content={description}
                />
                <meta key="ogTitle" property="og:title" content={title} />
                <meta
                    key="ogDescription"
                    property="og:description"
                    content={description}
                />
                <meta key="ogType" property="og:type" content="profile" />
                <meta key="twitterTitle" name="twitter:title" content={title} />
                <meta
                    key="twitterDescription"
                    name="twitter:description"
                    content={description}
                />
                <link key="canonical" rel="canonical" href={url} />
                <meta key="ogUrl" property="og:url" content={url} />
            </Head>
            <JsonLd
                id="profile"
                data={profileStructuredData(userData, description)}
            />
        </>
    );
}

const tabs = {
    deployed: "Deployed Spaces",
    saved: "Saved Spaces",
    owned: "Owned NFTs",
    // 'created': 'Created NFTs',
};

const ProfilePage = ({ userData }) => {
    const [selectedArtwork, setSelectedArtwork] = useState();
    const { toggle, isShowing } = useModal();
    const [isActive, setActive] = useState("deployed");
    const [deployedSpaces, setDeployed] = useState([]);
    const [savedSpaces, setSavedSpaces] = useState([]);
    const { user } = useContext(UserContext);
    const [currentProfile, setCurrentProfile] = useState(null);
    // The spaces load once the page is open. Starting as "loading" keeps the
    // server-rendered page from saying the profile has no public spaces.
    const [loadingDeployedSpaces, setLoadingDeployedSpaces] = useState(true);
    const [loadingSavedSpaces, setLoadingSavedSpaces] = useState(false);

    const { isLightTheme } = useContext(ThemeContext);

    const assetsReq = useAssets(userData?.id || "", "default", "owned", true);

    function handleOpenAccountSettings() {
        amplitude_logAnalyticsEvent("account_settings_opened");
        showModal(<AccountDashboard defaultStep="connections" />);
    }

    useEffect(() => {
        setCurrentProfile({
            ...userData,
        });
    }, [userData]);

    useEffect(() => {
        setLoadingDeployedSpaces(true);
        fetch(`/api/exhibit?type=GET_PUBLIC_USER_EXHIBITS`, {
            method: "POST",
            body: JSON.stringify({
                userId: userData?.id,
            }),
        })
            .then((res) => res.json())
            .then((res) => {
                let exhibits = res.exhibits.filter(
                    (exhibit) =>
                        exhibit?.info?.headline &&
                        (exhibit?.info?.heroImg || exhibit?.info?.cHeroImg)
                );
                setDeployed(exhibits);
                setLoadingDeployedSpaces(false);
            })
            .catch((err) => console.log(err));
    }, [userData?.id]);
    ``;

    useEffect(() => {
        setLoadingSavedSpaces(true);
        fetch(`/api/exhibit?type=USER_SAVED_EXHIBITS`, {
            method: "POST",
            body: JSON.stringify({
                userId: userData?.id,
            }),
        })
            .then((res) => res.json())
            .then((res) => {
                let exhibits = res.exhibits.filter(
                    (exhibit) =>
                        exhibit?.info?.headline &&
                        (exhibit?.info?.heroImg || exhibit?.info?.cHeroImg)
                );
                setSavedSpaces(exhibits);
                setLoadingSavedSpaces(false);
            })
            .catch((err) => console.log(err));
    }, [userData?.id]);
    ``;

    // The server-rendered page has no state yet: name the profile from its
    // own data, not "@undefined...".
    const shownProfile = currentProfile ?? userData;

    return (
        <Container id="container" isLight={isLightTheme}>
            <ProfileHead userData={userData} />
            <ArtworkInfo
                toggle={() => toggle(false)}
                isShowing={isShowing}
                artwork={selectedArtwork}
            />

            <Header {...{ isLight: isLightTheme }}>
                <Navigation />
                <div className="head">
                    <ProfilePicture
                        avatar={userData?.avatar}
                        isOwner={userData?.id == user?.id}
                        openEdit={() => handleOpenAccountSettings()}
                    />
                    <h1>
                        <span className="pixelated">@</span>
                        {shownProfile?.username ||
                            shownProfile?.id?.slice(0, 5) + "..."}
                    </h1>
                    {shownProfile?.username ? (
                        <p>{shownProfile?.id}</p>
                    ) : (
                        user?.id == userData?.id && (
                            <p
                                className="link"
                                onClick={handleOpenAccountSettings}
                            >
                                Edit profile
                            </p>
                        )
                    )}
                    <FollowButton accountId={userData?.id} />
                </div>
            </Header>

            <Body isLight={isLightTheme}>
                <div>
                    <Tabs
                        tabs={
                            userData?.id === user?.id
                                ? { ...tabs, following: "Following" }
                                : tabs
                        }
                        isLight={isLightTheme}
                        isActive={isActive}
                        setActive={setActive}
                    />
                    {isActive === "following" && userData?.id === user?.id && (
                        <FollowingList />
                    )}
                    {isActive == "owned" && (
                        <Artworks
                            toggleInfo={toggle}
                            setSelectedArtwork={setSelectedArtwork}
                            assets={assetsReq?.data?.assets || []}
                        />
                    )}
                    {isActive == "deployed" && (
                        <Spaces
                            loadingSpaces={loadingDeployedSpaces}
                            spaces={deployedSpaces}
                            isLight={isLightTheme}
                        />
                    )}
                    {isActive == "saved" && (
                        <Spaces
                            loadingSpaces={loadingSavedSpaces}
                            spaces={savedSpaces}
                            isLight={isLightTheme}
                        />
                    )}
                </div>
            </Body>
        </Container>
    );
};

const Container = styled.div<{
    isLight: boolean;
}>`
    color: ${({ isLight }) => (isLight ? "#070707" : "#fff")};
    background: ${({ isLight }) => (isLight ? "#F5F5F5" : "#131313")};

    .navigationContainer {
        background: ${({ isLight }) => (isLight ? "#F5F5F5" : "#131313")};
    }
`;

const Header = styled.div<{
    isLight: boolean;
}>`
    background: ${({ isLight }) => (isLight ? "#F5F5F5" : "#131313")};

    & > .head {
        min-height: 32vh;
        padding: 40px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        ${({ isLight }) =>
            !isLight &&
            css`
                -webkit-filter: drop-shadow(5px 5px 5px #222);
                filter: drop-shadow(5px 5px 5px #222);
            `};

        h1 {
            font-size: 96px;
            margin: 0;
            line-height: 0.9;
            letter-spacing: -2px;

            .pixelated {
                font-size: 104px;
                font-style: italic;
                margin-right: 8px;
                font-weight: 500;
            }
        }

        p {
            margin: 8px;
            opacity: 0.4;
            font-size: 0.85em;
        }

        .link {
            cursor: pointer;
            transition: 0.2s;

            &:hover {
                opacity: 0.7;
            }
        }
    }

    @media (max-width: 800px) {
        & > .head {
            h1 {
                font-size: 48px;

                .pixelated {
                    font-size: 60px;
                }
            }
        }
    }

    @media (max-width: 550px) {
        & > .head {
            h1 {
                font-size: 40px;

                .pixelated {
                    font-size: 46px;
                    margin-right: 4px;
                }
            }
        }
    }
`;

const Body = styled.div<{
    isLight: boolean;
}>`
    background: ${({ isLight }) => (isLight ? "#fff" : "#070707")};
    min-height: 80vh;

    & > div {
        max-width: 1260px;
        margin: 0 auto;
        padding: 64px 40px;
    }

    @media (max-width: 900px) {
        & > div {
            padding: 48px 24px;
        }
    }
`;

const Bar = styled.div`
    height: 100px;
    background: black;
`;

export default ProfilePage;
