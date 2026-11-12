import { showModal } from "@components/Dialogs";
import { UserContext } from "@components/context/UserContext";
import { useOnClickOutside } from "@components/hooks/useClickOutside";

import useModal from "@components/modals/useModal";

import { Divider } from "@ui/components/Divider";

import { NButton } from "@ui/components/NButton";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import dynamic from "next/dynamic";

import Link from "next/link";

import { useContext, useState } from "react";

import styled, { css } from "styled-components";

const ConnectModal = dynamic(() => import("@ui/components/ConnectWallet"));

const Profile = dynamic(() => import("@components/modals/Profile"));

const AccountDashboard = dynamic(
    () => import("@components/modals/AccountDashboard")
);

export default function UserDropdown({
    clickRef,
    toggleDropdownAuth,
    isDropdownAuthShowing,
}) {
    const { user, logout, accounts, userData, changeAccount } =
        useContext(UserContext);

    const { isShowing: editProfile, toggle: setEditProfile } = useModal();

    const [isCopying, setCopying] = useState<string>("");

    const displayWalletId =
        user.id.slice(0, 6) +
        "..." +
        user.id.slice(user.id.length - 8, user.id.length);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopying(text);

        setTimeout(() => {
            setCopying("");
        }, 1000);
    };

    function handleOpenAccountSettings() {
        amplitude_logAnalyticsEvent("account_settings_opened");
        showModal(<AccountDashboard />);
    }

    return (
        <Container ref={clickRef}>
            <ConnectModal
                toggle={toggleDropdownAuth}
                open={isDropdownAuthShowing}
                style={{ zIndex: 10000000 }}
                skipRedirectToAccount={true}
            />

            {/* {editProfile ? (
                <Profile toggle={setEditProfile} isShowing={editProfile} />
            ) : null} */}
            <div>
                <Link
                    href={`/@${userData?.username || user.id}`}
                    legacyBehavior
                >
                    <p
                        style={{
                            fontWeight: 500,
                            cursor: "pointer",
                            fontSize: 15,
                        }}
                    >
                        @{userData?.username || displayWalletId}
                    </p>
                </Link>
                <MainWalletWrapper>
                    <p>{displayWalletId}</p>
                    <p
                        onClick={() => copyToClipboard(user.id)}
                        className="copy"
                    >
                        {" "}
                        {isCopying === user.id ? "copied" : "copy"}
                    </p>
                </MainWalletWrapper>
            </div>
            <Divider style={{ margin: "16px 0" }} />
            <Wrapper>
                {Object.keys(accounts || {}).length > 0 && (
                    <>
                        <p>Your wallets</p>
                        <WalletsWrapper className="scrollbar light">
                            {Object.keys(accounts || {}).map(
                                (account, index) => {
                                    const displayWalletId =
                                        account.slice(0, 6) +
                                        "..." +
                                        account.slice(
                                            account.length - 5,
                                            account.length
                                        );

                                    return (
                                        <WalletWrapper key={index}>
                                            <WalletId
                                                onClick={() =>
                                                    changeAccount(account)
                                                }
                                                isActive={
                                                    account.toLowerCase() ===
                                                    user.id.toLowerCase()
                                                }
                                            >
                                                <Circle
                                                    isActive={
                                                        account.toLowerCase() ===
                                                        user.id.toLowerCase()
                                                    }
                                                />
                                                <p>{displayWalletId}</p>
                                            </WalletId>
                                            <div
                                                onClick={() =>
                                                    copyToClipboard(account)
                                                }
                                            >
                                                <p className="copy">
                                                    {isCopying === account
                                                        ? "copied"
                                                        : "copy"}
                                                </p>
                                            </div>
                                        </WalletWrapper>
                                    );
                                }
                            )}
                        </WalletsWrapper>
                    </>
                )}
                <NButton
                    style={{
                        fontSize: 14,
                        padding: "4px 40px",
                        fontWeight: 400,
                        margin: "4px 0 0 0",
                    }}
                    onClick={toggleDropdownAuth}
                    size="small"
                    outline
                >
                    Add Another Account
                </NButton>
            </Wrapper>
            <Divider style={{ margin: "16px 0" }} />
            <Wrapper>
                <p>
                    <Link href="/destinations">My destinations</Link>
                </p>
                <p>
                    <a href="/studio">World Builder</a>
                </p>
                <p
                    onClick={handleOpenAccountSettings}
                    style={{ cursor: "pointer" }}
                >
                    Edit Profile
                </p>
            </Wrapper>
            <Divider style={{ margin: "16px 0" }} />
            <div>
                <p style={{ cursor: "pointer" }} onClick={logout}>
                    Disconnect
                </p>
            </div>
        </Container>
    );
}

const Container = styled.div`
    position: absolute;
    background: #fff;
    z-index: var(--zIndex_user-dropdown);
    padding: 24px;
    border-radius: 10px;
    box-shadow: 0 0 14px #dbdbdb;
    font-weight: 400;
    user-select: none;

    right: 0;
    top: 120%;

    p {
        margin: 0;
        font-weight: 500;
        font-size: 14px;
        color: #070707;
    }
`;

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const WalletWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-weight: 400;

    .copy {
        color: grey;
        font-size: 12px;
        cursor: pointer;
        display: none;
    }

    &:hover {
        .copy {
            display: block;
        }
    }
`;

const MainWalletWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    p {
        font-size: 12px;
        color: #999999;
        margin-top: 6px;
        cursor: default;
        font-weight: 400;
    }

    .copy {
        font-size: 12px;
        font-weight: 400;
        cursor: pointer;
        user-select: none;
    }
`;

const WalletsWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 150px;
    overflow-y: auto;
`;

const Circle = styled.div<{
    isActive?: boolean;
}>`
    width: 8px;
    height: 8px;
    min-height: 8px;
    min-width: 8px;
    background: black;
    border-radius: 50%;
    border: 1px solid #e0e0e0;
    background: transparent;

    ${(props) => {
        return (
            props.isActive &&
            css`
                border: 1px solid #000;
                background: #000;
            `
        );
    }}
`;

const WalletId = styled.div<{
    isActive?: boolean;
}>`
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    cursor: pointer;
    color: grey;

    p {
        font-size: 13px;
        font-weight: 400;
    }

    ${(props) => {
        return (
            props.isActive &&
            css`
                color: #000;
            `
        );
    }}
`;
