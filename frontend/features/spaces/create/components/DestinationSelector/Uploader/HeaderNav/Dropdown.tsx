import { useCyberTranslation } from "@components/context/I18nContext";
import { UserContext } from "@components/context/UserContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import Avatar from "@ui/components/Avatar";
import IconImg from "@ui/components/IconImg";
import { formatWalletAddress } from "@utils/format";
import { classes, noop } from "@utils/js";
import Link from "next/link";
import { useContext, useState } from "react";
import styled, { css } from "styled-components";
import { Wallet } from "./Wallet";
import dynamic from "next/dynamic";
import { showModal } from "@components/Dialogs";

const ConnectWallet = dynamic(() => import("@ui/components/ConnectWallet"));

const Profile = dynamic(() => import("@components/modals/Profile"));

export type Action =
    | { type: "create-space" }
    | { type: "open-profile" }
    | { type: "connect" };

export interface DropdownProps {
    onAction: (action: Action) => unknown;
}

export function Dropdown({ onAction }: DropdownProps) {
    //
    const { t } = useCyberTranslation();

    const { user, logout, accounts, userData, changeAccount } =
        useContext(UserContext);

    return (
        <Container top={true}>
            <CurrentWallet>
                <Avatar
                    size="small"
                    src={userData?.avatar || "/images/avatar.png"}
                />
                <div className="user">
                    <Link
                        href={
                            userData?.username && userData?.username !== "anon"
                                ? `/@${userData?.username}`
                                : `/@${userData?.walletId}`
                        }
                    >
                        <div className="user-name">
                            @{userData?.username || "anon"}{" "}
                        </div>
                    </Link>
                    <Wallet wallet={user.id} />
                </div>
            </CurrentWallet>

            <div className="item show-more">
                <span>Help & Account</span>
                <IconImg name="chevron-right" size={12} className="more-icon" />
                <Container className="more">
                    {Object.keys(accounts || {}).length > 1 && (
                        <>
                            Connected Wallets
                            <div
                                className={`accounts y-scroll scrollbar`}
                                style={{ maxHeight: 280 }}
                            >
                                {Object.keys(accounts).map((accountId, i) => {
                                    //
                                    const { walletId } = accounts[accountId];
                                    //
                                    return (
                                        walletId.toLowerCase() !=
                                            user?.id.toLowerCase() && (
                                            <div className="item" key={i}>
                                                <Wallet
                                                    wallet={walletId}
                                                    onClick={() => {
                                                        changeAccount(walletId);
                                                    }}
                                                />
                                            </div>
                                        )
                                    );
                                })}
                            </div>
                            <div className="sep" />
                        </>
                    )}
                    <div
                        className="item"
                        onClick={() => onAction({ type: "connect" })}
                    >
                        {t`ADD_ANOTHER_WALLET`}
                    </div>
                    <div
                        className="item"
                        onClick={() => onAction({ type: "open-profile" })}
                    >
                        {t`EDIT_PROFILE`}
                    </div>
                    <div className="item" onClick={logout}>
                        <span>{t`DISCONNECT`}</span>
                    </div>
                </Container>
            </div>
            <div className="sep" />

            {/* <div
                className="item"
                onClick={() => onAction({ type: "create-space" })}
            >
                <IconImg name="plus-circle" size={12} className="icon" />
                <span>Make another world</span>
            </div> */}

            <div className="item">
                <IconImg name="corner-down-left" size={12} className="icon" />
                <a href="/">Home Page</a>
            </div>
            <div className="item">
                <IconImg name="corner-down-left" size={12} className="icon" />
                <a href="/destinations">My Uploads</a>
            </div>
        </Container>
    );
}

export const Container = styled.div<{ top?: boolean }>`
    display: flex;
    flex-direction: column;
    padding: 24px;
    width: 240px;
    gap: 16px;

    background: #1e1e1e;

    & > .accounts {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    ${(props) =>
        props.top
            ? css`
                  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15),
                      0px 12px 28px rgba(0, 0, 0, 0.11);
                  border-radius: 8px;
              `
            : ""}

    color: #ffffff;
    font-size: 13px;
    font-weight: 400;

    & > .show-more {
        position: relative;
        padding: 4px 0;

        &::before {
            position: absolute;
            left: 0;
            top: 0;
            width: 120%;
            height: 120%;
            content: "";
        }

        & > .more-icon {
            margin-left: auto;
            filter: invert(1);
        }

        & > .more {
            position: absolute;
            left: 105%;
            top: -12px;
            display: none;
            box-shadow: 0 10px 20px rgb(0 0 0 / 30%);
        }

        &:hover {
            & > .more {
                display: flex;
            }

            /* & > .more-icon {
                filter: none;
            } */
        }
    }

    & > .sep {
        width: 100%;
        height: 1px;
        background: #3d3d3d;
    }

    & .item {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 6px;
        cursor: pointer;

        transition: 0.2s;
        &:hover {
            // background: #ffffff;
            color: #cccccc;
        }

        & > .icon {
            filter: invert(1);
        }
    }
`;

const CurrentWallet = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 7px;

    & > .user {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 4px;

        & > .user-wallet {
            width: 100%;
            display: flex;
            flex-direction: row;
            cursor: pointer;
        }

        & .user-name {
            width: 120px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }
`;
