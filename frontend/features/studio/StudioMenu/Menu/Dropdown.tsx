import InAppLink from "@components/InAppLink";
import {
    brandMenuDivider,
    brandMenuPanel,
    brandMenuRow,
} from "@features/studio/styles/brandMenu";
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
import styled from "styled-components";
import { Wallet } from "./Wallet";
import dynamic from "next/dynamic";
import { showModal } from "@components/Dialogs";
import { tx } from "@components/context/I18nContext";

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

    const { user, logout, accounts, userData, changeAccount, isAnonymous } =
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

            <div
                className="item show-more"
                tabIndex={0}
                aria-label={tx("Help and account")}
            >
                <span>{tx("Help & Account")}</span>
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

                    <button
                        type="button"
                        className="item"
                        onClick={() => onAction({ type: "connect" })}
                    >
                        {t`ADD_ANOTHER_WALLET`}
                    </button>
                    {!isAnonymous ? (
                        <button
                            type="button"
                            className="item"
                            onClick={() => onAction({ type: "open-profile" })}
                        >
                            {t`EDIT_PROFILE`}
                        </button>
                    ) : null}
                    {!isAnonymous ? (
                        <button type="button" className="item" onClick={logout}>
                            <span>{t`DISCONNECT`}</span>
                        </button>
                    ) : null}
                </Container>
            </div>
            <div className="sep" />

            {!isAnonymous ? (
                <button
                    type="button"
                    className="item"
                    onClick={() => onAction({ type: "create-space" })}
                >
                    <IconImg name="plus-circle" size={14} className="icon" />
                    <span>{tx("Make another world")}</span>
                </button>
            ) : null}

            <div className="item">
                <IconImg name="corner-down-left" size={14} className="icon" />
                <InAppLink href="/">{tx("Back to Home Page")}</InAppLink>
            </div>
        </Container>
    );
}

export const Container = styled.div<{ top?: boolean }>`
    ${brandMenuPanel}
    width: 260px;

    & > .accounts {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    & > .show-more {
        position: relative;

        /* A bridge so the pointer can reach the side menu. */
        &::before {
            position: absolute;
            left: 100%;
            top: 0;
            width: 16px;
            height: 100%;
            content: "";
        }

        & > .more-icon {
            margin-left: auto;
        }

        & > .more {
            position: absolute;
            left: calc(100% + 16px);
            top: -8px;
            display: none;
        }

        &:hover,
        &:focus-within {
            & > .more {
                display: flex;
            }
        }
    }

    & > .sep {
        ${brandMenuDivider}
    }

    & .item {
        ${brandMenuRow}
        justify-content: flex-start;
        gap: 10px;

        & > .icon,
        & > .more-icon {
            filter: invert(0.75);
        }
        &:hover > .icon,
        &:hover > .more-icon {
            filter: invert(1);
        }
        & > a {
            color: inherit;
            text-decoration: none;
        }
    }
`;

const CurrentWallet = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    color: var(--oc-ink);

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
