import { useMemo } from "react";
import styled, { css } from "styled-components";
import { useEventCallback } from "@components/hooks/useEventCallback";
import type { Blockchain } from "@dapp/connect";

import IconImg from "@ui/components/IconImg";

import { formatWalletAddress } from "@utils/format";
import { IconMenuCaption } from "../shared/IconMenuCaption";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@components/context/UserContext";
import { encodeCounterpartyUser } from "@utils/counterpartyAssets";
import { askCounterpartyAddress } from "@utils/askCounterpartyAddress";
import { getAddrType } from "@utils/getAddrType";
import {
    useWalletContext,
    WalletType,
} from "@features/studio/EditWorldMenu/context/WalletContext";
import { useExhibitOwners } from "./useExhibitOwners";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import {
    CustomDropdown,
    CustomDropdownProps,
} from "@features/studio/components/CustomDropdown";
import { classes } from "@utils/js";
import { showConfirm } from "@components/Dialogs";
import { SearchInput } from "./SearchInput";
import { useProfile } from "@components/hooks/useProfile";
import { getProxyWallets } from "@utils/auth/proxyWallets";
import AccountsAPI from "@api/accounts/_api";

export interface WalletOpt {
    title: string;
    value: string;
    disabled: boolean;
}

const icons: Record<Blockchain, string> = {
    ethereum: "/v2/icons/ethereum.svg",
    tezos: "/v2/icons/tezos.svg",
    solana: "/v2/icons/solana.svg",
    counterparty: "/v2/icons/counterparty.svg",
    niftygateway: "/v2/icons/niftygateway.svg",
};

const FREE_ACCOUNTS_KEY = "free-accounts";

function getFreeAccounts() {
    return JSON.parse(localStorage.getItem(FREE_ACCOUNTS_KEY)) || {};
}

function saveFreeAccount(account: string, type: Blockchain, isRemove: boolean) {
    //
    const accounts = getFreeAccounts();

    let newAccounts = { ...accounts };

    const key = account.toLowerCase();

    if (isRemove) {
        delete newAccounts[key];
    } else {
        newAccounts[key] = {
            walletId: account,
            type,
        };
    }

    localStorage.setItem(FREE_ACCOUNTS_KEY, JSON.stringify(newAccounts));
}

const defaultCaption = (
    <IconMenuCaption>
        <IconImg
            name="wallet_icon"
            size={16}
            style={{ filter: "invert(1)", opacity: 0.5 }}
        />
    </IconMenuCaption>
);

// what is this free account?

export function WalletDropdown({
    addTogglerRef,
    caption = defaultCaption,
}: {
    addTogglerRef: CustomDropdownProps["addTogglerRef"];
    caption?: CustomDropdownProps["caption"];
}) {
    //
    const { accounts, user, userData } = useContext(UserContext);

    const { exhibit } = useCurrentExhibit();

    const [searchInput, setSearchInput] = useState("");

    const allOwners = useExhibitOwners(exhibit);

    const { currentWalletId, changeWallet, addNewWallet } = useWalletContext();

    const [freeAccounts, setFreeAccounts] = useState({});

    const [editorsLinkedAccounts, setEditorsLinkedAccounts] = useState([]);

    // should probably be in the user context
    const [proxyAccounts, setProxyAccounts] = useState({});

    let ownAccounts = Object.values(accounts)
        .concat(Object.values(freeAccounts))
        .concat(Object.values(proxyAccounts))
        .concat(
            // @ts-ignore
            (userData?.linkedAccounts || [])
                .filter(({ type }) => type === "web3")
                .map(({ chainType, type, originalWalletId }) => ({
                    walletId: originalWalletId,
                    type: chainType || type,
                    isTrustedDelegation: true,
                })) || []
        );

    const delegatedAccounts = useMemo(() => {
        //
        return allOwners.concat(editorsLinkedAccounts).filter((it) => {
            //
            if (!it) return false;

            const key = it.toLowerCase();

            return accounts[key] == null;
            //
        }, []);
    }, [accounts, editorsLinkedAccounts]);

    useEffect(() => {
        //
        const freeAccounts = getFreeAccounts();

        setFreeAccounts(freeAccounts);

        getProxyWallets(accounts).then((proxyWallets) => {
            setProxyAccounts(proxyWallets);
        });

        AccountsAPI.getUsers({
            exhibitId: exhibit.id,
            type: "editors",
        }).then((response) => {
            setEditorsLinkedAccounts(
                response?.editors
                    ?.filter?.((it) => it?.id !== user.id)
                    ?.flatMap?.((it) => it?.linkedAccounts)
                    ?.filter?.((addr) => {
                        return addr && getAddrType(addr);
                    })
            );
        });
        //
    }, []);

    const onAddCounterpartyAccount = useEventCallback(async () => {
        // A wrong or repeated address is explained in the dialog itself,
        // which stays open so it can be corrected (docs/feedback.md).
        // Saved accounts are keyed by the encoded account, lower-cased.
        let acc = await askCounterpartyAddress(
            (address, account) =>
                !!(freeAccounts[address] || freeAccounts[account.toLowerCase()])
        );

        if (acc != null) {
            //
            let account = encodeCounterpartyUser(acc);

            saveFreeAccount(account, "counterparty", false);

            setFreeAccounts((accs) => {
                return {
                    ...accs,
                    [account.toLowerCase()]: {
                        walletId: account,
                        type: "counterparty",
                    },
                };
            });

            changeWallet(account, "own");
        }
    }, []);

    const onRemoveCounterpartyAccount = useEventCallback(
        async (account: string) => {
            //
            let ok = await showConfirm("Are you sure you want to delete?");

            if (ok) {
                //

                saveFreeAccount(account, "counterparty", true);

                setFreeAccounts((accs) => {
                    //
                    const newAccs = { ...accs };

                    delete newAccs[account.toLowerCase()];

                    return newAccs;
                });

                if (currentWalletId.toLowerCase() === account.toLowerCase()) {
                    //
                    changeWallet(user.id, "own");
                }
            }
        },
        []
    );

    const onAddAccount = useEventCallback(() => {
        //

        addNewWallet();
    }, []);

    const handleChange = useEventCallback(
        (
            value: string,
            type: WalletType,
            isTrustedDelegation: boolean = false
        ) => {
            //
            changeWallet(
                value,
                type,
                { ...freeAccounts, ...proxyAccounts }[value] || {
                    trustedDelegation: isTrustedDelegation,
                }
            );
        },
        []
    );

    return (
        <CustomDropdown caption={caption} addTogglerRef={addTogglerRef}>
            {({ toggle }) => {
                //
                return (
                    <Dropdown className="scrollbar-hidden">
                        <div className="search">
                            <IconImg
                                name="search"
                                size={12}
                                className="search-icon"
                                style={{ filter: "invert(1)" }}
                            />
                            <SearchInput
                                className="search-input"
                                placeholder="Search by wallet address..."
                                value={searchInput}
                                onChange={(v) => {
                                    setSearchInput(v);
                                }}
                            />
                        </div>
                        <div className="group">
                            {ownAccounts
                                .filter((item) =>
                                    item.walletId.includes(
                                        searchInput.toLowerCase()
                                    )
                                )
                                .map(({ walletId, ...rest }, index) => {
                                    if (!getAddrType(walletId)) return null;
                                    return (
                                        <Item
                                            key={index}
                                            walletId={walletId}
                                            active={
                                                currentWalletId === walletId
                                            }
                                            onClick={() => {
                                                //
                                                handleChange(
                                                    walletId,
                                                    "own",
                                                    rest.isTrustedDelegation
                                                );
                                                toggle(false);
                                            }}
                                            action={
                                                freeAccounts[
                                                    walletId.toLowerCase()
                                                ] && (
                                                    <span
                                                        className="edit"
                                                        onClick={(e) => {
                                                            e.stopPropagation();

                                                            onRemoveCounterpartyAccount(
                                                                walletId
                                                            );
                                                        }}
                                                    >
                                                        <IconImg
                                                            name="trash"
                                                            size={13}
                                                            style={{
                                                                filter: "invert(0.5)",
                                                                paddingTop: 2,
                                                            }}
                                                        />
                                                    </span>
                                                )
                                            }
                                        >
                                            <span>
                                                {formatWalletAddress(walletId)}
                                            </span>
                                        </Item>
                                    );
                                })}

                            <div className="item" onClick={onAddAccount}>
                                <IconImg
                                    className="item-icon"
                                    name="plus-circle"
                                    size={20}
                                    style={{ filter: "invert(1)" }}
                                />
                                <div className="title">Add Wallet</div>
                            </div>

                            <div
                                className="item"
                                onClick={onAddCounterpartyAccount}
                            >
                                <IconImg
                                    className="item-icon"
                                    name="xcp"
                                    size={20}
                                />
                                <div className="title">Add XCP Wallet</div>
                            </div>
                        </div>

                        {delegatedAccounts.length > 0 && (
                            <div className="group">
                                <h2>Delegated</h2>
                                {delegatedAccounts
                                    .filter((item) =>
                                        item.includes(searchInput.toLowerCase())
                                    )
                                    .map((walletId) => {
                                        //
                                        return (
                                            <Delegator
                                                key={walletId}
                                                walletId={walletId}
                                                onClick={() => {
                                                    //
                                                    handleChange(
                                                        walletId,
                                                        "delegated"
                                                    );
                                                    toggle(false);
                                                }}
                                                active={
                                                    currentWalletId === walletId
                                                }
                                            />
                                        );
                                    })}
                            </div>
                        )}
                    </Dropdown>
                );
            }}
        </CustomDropdown>
    );
}

function Item({ walletId, active, onClick, action = null, children }) {
    //
    return (
        <div
            className={classes({
                item: true,
                active,
            })}
            onClick={onClick}
        >
            <IconImg
                size={20}
                className="check-icon item-icon"
                name="check-circle-2"
                style={{ filter: "invert(0)" }}
            />
            <div className="title">{children}</div>
            {action}
        </div>
    );
}

function Delegator({ walletId, active, onClick }) {
    const profile = useProfile({
        id: walletId,
    });

    return (
        <DelegatorContainer onClick={onClick} active={active}>
            <div className="collab">
                <img src={profile?.avatar || "/images/opensea-black.png"} />
                <span>{profile?.username || "@unnamed"}</span>
            </div>
            <span>{formatWalletAddress(walletId)}</span>
        </DelegatorContainer>
    );
}

const DelegatorContainer = styled.div<{ active?: boolean }>`
    display: flex;
    height: 100%;
    align-items: center;
    margin-top: 10px;
    justify-content: space-between;
    cursor: pointer;

    span {
        font-weight: 500;
        font-size: 12px;
        line-height: 120%;
    }

    ${({ active }) => {
        return active
            ? css`
                  color: #ffffff;
              `
            : css`
                  color: var(--panel-text-secondary);
              `;
    }}

    & > .collab {
        display: flex;
        align-items: center;
        justify-content: flex-start;

        & > img {
            width: 20px;
            height: 20px;
            border-radius: 9999px;
        }

        & > span {
            max-width: 140px;
            margin-left: 8px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }
    }
`;

const Dropdown = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    box-shadow: var(--panel-shadow);
    border-radius: 8px;
    padding: 12px;
    width: 260px;
    max-width: 260px;
    max-height: 365px;
    overflow: auto;

    background: var(--panel-bg);
    border: var(--panel-border);
    color: var(--panel-text-secondary);

    & > .search {
        width: 100%;
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        background: var(--studio-surface, #1c1c1f);
        border-radius: 6px;
        outline: none;

        .search-icon {
            margin-left: 8px;
            margin-top: 2px;
        }

        .search-input {
            width: 100%;
            height: 100%;
            border-radius: 6px;
            font-weight: 400;
            font-size: 12px;
            line-height: 24px;
            color: #777980;
            background: transparent;
        }
    }

    & > .group {
        width: 100%;
        display: flex;
        flex-direction: column;

        & > h2 {
            margin: 0;
            margin-top: 10px;
            font-weight: 400;
            font-size: 16px;
            line-height: 28px;
            color: #ffffff;
        }
    }

    & .item {
        display: flex;
        flex-direction: row;
        gap: 12px;
        align-items: center;
        justify-content: flex-start;
        padding: 8px 24px 8px 0px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;

        .item-icon {
            opacity: 0.5;
        }

        & .check-icon {
            opacity: 0.5;
            //visibility: hidden;
            //filter: invert(1);
        }

        &.active > .check-icon {
            visibility: visible;
        }

        & .title {
            color: var(--panel-text-secondary);
            font-weight: 500;
            font-size: 12px;
            line-height: 100%;
            white-space: nowrap;
        }

        &.active {
            .item-icon {
                opacity: 1;
            }

            .title {
                color: #ffffff;
            }
        }

        & > .icon {
            width: 20px;
            height: 20px;
        }
    }

    & .separator {
        width: 100%;
        border-top: 1px solid #292929;
    }
`;
