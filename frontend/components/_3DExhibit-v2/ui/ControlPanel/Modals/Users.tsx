import { useCyberTranslation } from "@components/context/I18nContext";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import Icon from "@features/landing-carousel/components/Icon";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import { useState } from "react";
import styled, { css } from "styled-components";
import { usePanel } from "../context/PanelProvider";
import SpaceControl from "./UsersList/SpaceControl";
import User from "./UsersList/User";

export default function UsersList({
    addModalTogglerRef,
    sceneContainer,
    isMobile = false,
}) {
    //
    const { chat } = useMultiplayer();

    const { t } = useCyberTranslation();

    const { admins, users } = chat;

    const { setCurrentTab, setSelectedUser, clickRef } = usePanel();

    const [search, setSearch] = useState("");

    return (
        <Container ref={!isMobile ? clickRef : null} isMobile={isMobile}>
            <label className="people-search">
                <Icon name="search" size={14} />
                <input
                    type="search"
                    placeholder={t`SEARCH_PARTICIPANTS`}
                    aria-label={t`SEARCH_PARTICIPANTS`}
                    autoComplete="off"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </label>

            <SpaceControl setCurrentTab={setCurrentTab} />
            {/* {/* <ModsWrapper>
                <ModsHeader>
                    <Title>Active Mods</Title>
                    <span>Show</span>
                </ModsHeader>

                <div></div>
            </ModsWrapper> */}

            <Users
                id="active_mods"
                title={t`ACTIVE_MODS`}
                setCurrentTab={setCurrentTab}
                setSelectedUser={setSelectedUser}
                search={search}
                users={admins}
                addModalTogglerRef={addModalTogglerRef}
                sceneContainer={sceneContainer}
            />

            <Users
                id="active_users"
                addModalTogglerRef={addModalTogglerRef}
                title={t`ACTIVE_USERS`}
                setCurrentTab={setCurrentTab}
                setSelectedUser={setSelectedUser}
                search={search}
                users={users}
                sceneContainer={sceneContainer}
            />
        </Container>
    );
}

function Users({
    id,
    users,
    search,
    setCurrentTab,
    setSelectedUser,
    title,
    addModalTogglerRef,
    sceneContainer,
}) {
    const { t } = useCyberTranslation();

    return (
        <UsersWrapper>
            <Title>{title}</Title>

            <div>
                {users.length > 0 ? (
                    users.map((user) => {
                        const { userData, userId } = user;

                        const { avatar, username, walletId } = userData;

                        const user_username = username || walletId;

                        if (
                            search &&
                            user_username
                                .toLowerCase()
                                .indexOf(search.toLowerCase()) === -1
                        )
                            return null;

                        return (
                            <User
                                addModalTogglerRef={addModalTogglerRef}
                                key={user_username}
                                setCurrentTab={setCurrentTab}
                                setSelectedUser={setSelectedUser}
                                userId={userId}
                                avatarSrc={avatar}
                                username={user_username}
                                user={user}
                                sceneContainer={sceneContainer}
                            />
                        );
                    })
                ) : (
                    <p className="nousers">
                        {id === "active_mods"
                            ? t`NO_ACTIVE_MODS`
                            : t`NO_ACTIVE_USERS`}
                        .
                    </p>
                )}
            </div>
        </UsersWrapper>
    );
}

/* The same rows, labels and search field as the lobby's People panel. */
const Container = styled.div<{ isMobile: boolean }>`
    padding: 16px;
    color: ${lobby.color.ink};
    /* The space's panel frame already pads its body. */
    [data-native-utility-panel] & {
        padding: 0;
    }

    ${(props) =>
        props.isMobile &&
        css`
            width: 100%;
            padding: 0px;
        `}

    .people-search {
        position: relative;
        display: flex;
        align-items: center;
        color: ${lobby.color.secondary};
    }
    .people-search svg {
        position: absolute;
        left: 10px;
        pointer-events: none;
    }
    .people-search input {
        width: 100%;
        height: 32px;
        box-sizing: border-box;
        padding: 0 10px 0 30px;
        border: 1px solid ${lobby.panel.border};
        border-radius: ${lobby.panel.iconRadius}px;
        background: ${base.color.line.faint};
        color: ${lobby.color.ink};
        font: 12px var(--oc-font, sans-serif);
        outline: none;
    }
    .people-search input::placeholder {
        color: ${lobby.color.secondary};
    }
    .people-search input::-webkit-search-cancel-button {
        display: none;
    }
    .people-search input:focus-visible {
        border-color: ${lobby.panel.cardHover};
    }
    .nousers {
        margin: 4px 0 8px;
        color: ${lobby.color.secondary};
        font-size: 12px;
    }
`;

const Title = styled.p`
    margin: 8px 0 0;
    color: ${lobby.color.secondary};
    font: 500 11px/20px var(--oc-font, sans-serif);
`;

const UsersWrapper = styled.div`
    margin-top: 8px;
    border-top: 1px solid ${base.color.line.subtle};
`;
