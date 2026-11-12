import { UserContext } from "@components/context/UserContext";
import Avatar from "@ui/components/Avatar";
import IconImg from "@ui/components/IconImg";
import React, { useContext, useEffect, useState } from "react";
import styled, { css } from "styled-components";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";
import { NButton } from "@ui/components/NButton";
import Exhibits from "./Exhibits";
import Nfts from "./Nfts";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { TELEPORT_TO_USER } from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";
import { useCyberTranslation } from "@components/context/I18nContext";
import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import { usePanel } from "../context/PanelProvider";
import Anon from "../Modals/Anon";
import { getUser } from "@utils/saveToDb";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { showModal } from "@components/Dialogs";
import AccountDashboard from "@components/modals/AccountDashboard";

const TABS = [
    {
        name: "Worlds",
        key: "spaces",
        icon: "box",
        mode: "light",
    },
    {
        name: "Collectibles",
        key: "collectibles",
        icon: "NFTs",
        mode: "dark",
    },
    {
        name: "Saved worlds",
        key: "saved",
        icon: "bookmark",
        mode: "light",
    },
];

export default function Index({ isMobile = false }) {
    const { user: _user, userData } = useContext(UserContext);

    const { t } = useCyberTranslation();

    const [tab, setTab] = useState("spaces");

    const [otherSpaces, setOtherSpaces] = useState([]);

    const [loading, setLoading] = useState(true);

    const [savedSpaces, setSavedSpaces] = useState([]);

    const [loadingSpaces, setLoadingSpaces] = useState(false);

    const [userMetadata, setUserMetadata] = useState(null);

    const world = useWorld();

    const { chat } = useMultiplayer();

    const { pushMessage, users, admins } = chat;

    const {
        selectedUser,
        spaces,
        setSpaces,
        nfts,
        setLoadNfts,
        otherNfts,
        setSelectedUser,
        toggleAuth,
        clickRef,
        loadNfts,
        setCurrentTab,
    } = usePanel();

    const avatarUrl =
        (selectedUser?.userId
            ? selectedUser?.userData?.avatar
            : userData?.avatar) || DEFAULT_PLAYER_AVATAR_PICTURE;

    const user = selectedUser?.userId
        ? {
              id: selectedUser?.userData?.walletId,
          }
        : _user;

    const walletId =
        user?.id.slice(0, 4) +
        "..." +
        user?.id.slice(user.id.length - 4, user?.id.length);

    const username = selectedUser?.userId
        ? selectedUser?.userData?.username || walletId
        : userData?.username || walletId;

    async function handleLoadUser(walletId) {
        const user = await getUser(walletId);

        setUserMetadata(user);
    }

    function handleLoadExhibits(walletId, save) {
        setLoading(true);

        fetch(`/api/exhibit?type=GET_PUBLIC_USER_EXHIBITS`, {
            method: "POST",
            body: JSON.stringify({
                userId: walletId,
            }),
        })
            .then((res) => res.json())
            .then((res) => {
                if (res.exhibits) {
                    let exhibits = res.exhibits.filter(
                        (exhibit) =>
                            exhibit?.info?.headline &&
                            (exhibit?.info?.heroImg || exhibit?.info?.cHeroImg)
                    );

                    save(exhibits);
                }
            })
            .catch((err) => console.log(err))
            .finally(() => {
                setLoading(false);
            });
    }

    function handleTeleport() {
        const _users = [...users, ...admins];

        const user = _users.find(
            (item) => item?.userId == selectedUser?.userId
        );

        const response = world.current.handleCommand({
            type: TELEPORT_TO_USER,
            payload: {
                username: user?.userData?.username,
                sessionId: user?.sessionId,
            },
        });

        if (!response.success) {
            setCurrentTab("");
            pushMessage(response.message, CHAT_TYPES.ALERT.label);
        } else {
            setCurrentTab("");

            if (response.summon) {
                pushMessage(
                    t`SUCCESSFULLY_TELEPORTED_TO_SPACE`,
                    CHAT_TYPES.INFO.label
                );
            } else {
                pushMessage(t`SUCCESSFULLY_TELEPORTED`, CHAT_TYPES.INFO.label);
            }
        }
    }

    useEffect(() => {
        setLoadingSpaces(true);
        fetch(`/api/exhibit?type=USER_SAVED_EXHIBITS`, {
            method: "POST",
            body: JSON.stringify({
                userId: user?.id,
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
            })
            .catch((err) => console.log(err))
            .finally(() => {
                setLoadingSpaces(false);
            });
    }, [user?.id]);

    useEffect(() => {
        if (spaces.length === 0) {
            setLoading(true);
            if (user.id) {
                handleLoadExhibits(_user.id, setSpaces);
            }
        } else {
            setLoading(false);
        }

        if (!selectedUser.userData?.walletId && user.id) {
            handleLoadUser(_user.id);
        }

        return () => {
            setSelectedUser({});
            setUserMetadata(null);
        };
    }, []);

    useEffect(() => {
        if (selectedUser.userData?.walletId) {
            handleLoadUser(selectedUser.userData?.walletId);

            handleLoadExhibits(selectedUser.userData?.walletId, setOtherSpaces);
        }
    }, [selectedUser?.userData?.walletId]);

    function handleOpenAccountSettings() {
        amplitude_logAnalyticsEvent("account_settings_opened");
        showModal(<AccountDashboard defaultStep="connections" />);
    }

    if (
        (!_user.id && !selectedUser.userId) ||
        (selectedUser?.userData &&
            selectedUser?.userData?.username ===
                selectedUser?.userData?.walletId)
    )
        return <Anon onConnect={toggleAuth} />;

    return (
        <Container ref={isMobile ? null : clickRef} isMobile={isMobile}>
            {!isMobile && (
                <Header>
                    <div onClick={() => setCurrentTab("")}>
                        <IconImg
                            style={{
                                cursor: "pointer",
                            }}
                            size={16}
                            mode="light"
                            name="x"
                        />
                    </div>
                </Header>
            )}
            <Info>
                <AvatarWrapper>
                    <Avatar
                        src={avatarUrl}
                        size="large"
                        style={{
                            border: "none",
                        }}
                    />

                    <div className="details">
                        <h4>{username}</h4>
                        <span>{walletId}</span>
                    </div>
                </AvatarWrapper>

                <ActionWrapper>
                    {userMetadata?.socials?.twitter?.active ? (
                        <a
                            href={`https://twitter.com/${userMetadata?.socials?.twitter?.handle}`}
                            target="_blank"
                        >
                            <IconImg name="twitter" size={20} mode="light" />
                        </a>
                    ) : null}
                    {selectedUser?.userId &&
                    selectedUser.userId !== userData?.id ? (
                        <NButton
                            outline
                            onClick={handleTeleport}
                            overrideTheme="dark"
                            className="btn"
                            style={{
                                width: "83px",
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textTransform: "capitalize",
                            }}
                        >
                            {t`TELEPORT`}
                        </NButton>
                    ) : (
                        <NButton
                            outline
                            onClick={handleOpenAccountSettings}
                            overrideTheme="dark"
                            className="btn"
                            style={{
                                width: "63px",
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {t`EDIT`}
                        </NButton>
                    )}
                </ActionWrapper>
            </Info>
            <Tabs>
                {TABS.map((item) => (
                    <Tab
                        key={item.key}
                        isActive={tab === item.key}
                        onClick={() => setTab(item.key)}
                    >
                        <IconImg
                            style={{
                                cursor: "pointer",
                            }}
                            size={20}
                            mode={item.mode}
                            name={item.icon}
                        />
                    </Tab>
                ))}
            </Tabs>

            <TabContent className="scrollbar-hidden" isMobile={isMobile}>
                {tab === "spaces" ? (
                    <Exhibits
                        exhibits={selectedUser.userId ? otherSpaces : spaces}
                        loading={loading}
                    />
                ) : null}
                {tab === "collectibles" ? (
                    <Nfts
                        setLoadNfts={setLoadNfts}
                        otherNfts={otherNfts}
                        nfts={nfts}
                        user={user}
                        isOther={selectedUser?.userId}
                    />
                ) : null}

                {tab === "saved" ? (
                    <Exhibits exhibits={savedSpaces} loading={loadingSpaces} />
                ) : null}
            </TabContent>
        </Container>
    );
}

const Container = styled.div<{ isMobile: boolean }>`
    padding: 14px 24px;
    width: 100%;

    ${(props) =>
        props.isMobile &&
        css`
            min-width: 100%;
            max-width: 100%;
            max-height: 100%;
            border-radius: 0 !important;
            background: transparent;
            backdrop-filter: none;
            padding: 0;
            position: relative;
            overflow: auto;
            z-index: 1;

            .no-exhibits-found,
            .no-nft-found {
                color: #fff;
            }
        `}

    p {
        margin: 0;
    }
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
`;

const Info = styled.div`
    display: flex;
    margin-top: 12px;
    align-items: center;
    justify-content: space-between;
`;

const AvatarWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;

    & > .btn {
        width: 63px;
        height: 36px;
        border-radius: 12px;
        font-weight: 500;
        font-size: 13px;
        line-height: 24px;

        color: #ffffff;

        flex: none;
        order: 0;
        flex-grow: 0;
    }

    & > .details {
        display: flex;
        flex-direction: column;
        margin-left: 16px;

        & > h4 {
            font-weight: 500;
            font-size: 18px;
            line-height: 140%;
            letter-spacing: -0.03em;
            color: #ffffff;
            margin: 0;
        }

        & > span {
            font-weight: 500;
            font-size: 12px;
            line-height: 100%;

            color: #ffffff;

            opacity: 0.5;
        }
    }
`;

const Tabs = styled.div`
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Tab = styled.div<{ isActive?: boolean }>`
    width: 33%;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    ${(props) => {
        return (
            props.isActive &&
            css`
                border-bottom: 1px solid #ffffff;
            `
        );
    }}
`;

const TabContent = styled.div<{ scroll?: boolean; isMobile: boolean }>`
    width: 100%;
    overflow: auto;
    margin-top: 16px;
    height: calc(var(--100-vh) - 75vh);

    ${(props) =>
        props.isMobile &&
        css`
            height: calc(var(--100-vh) - 20px);
        `}
`;

const ActionWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;
