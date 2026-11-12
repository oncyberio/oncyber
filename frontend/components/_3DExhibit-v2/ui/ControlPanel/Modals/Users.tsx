import { useCyberTranslation } from "@components/context/I18nContext";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import Search from "@ui/components/Icons/Search";
import Input from "@ui/components/Input";
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
            <Input
                icon
                iconPosition="left"
                placeholder={t`SEARCH_PARTICIPANTS`}
                className="shadow"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                    borderColor: "rgba(255, 255, 255, 0.5)",
                    borderWidth: 1,
                }}
            >
                <Search
                    width={16}
                    height={16}
                    className="participant-search-icon"
                />
            </Input>

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

                        console.log(
                            "[User]",
                            userId,
                            user_username,
                            userData.isAdmin,
                            userData.walletId
                        );

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

const Container = styled.div<{ isMobile: boolean }>`
    padding: 16px;

    ${(props) =>
        props.isMobile &&
        css`
            width: 100%;
            padding: 0px;
        `}

    .nousers {
        font-size: 13px;
    }
`;

const Title = styled.p`
    font-size: 12px;
    font-weight: 400;
    margin: 0;
    color: #ffffff82;
    margin-bottom: 10px;
    margin-top: 12px;
`;

const UsersWrapper = styled.div`
    margin-top: 12px;
    border-top: 1px solid #ffffff82;
`;
