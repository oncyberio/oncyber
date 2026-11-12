import { UserContext } from "@components/context/UserContext";
import React, { useContext, useState } from "react";
import styled from "styled-components";
import Icon from "@components/Icon";
import { useCyberTranslation } from "@components/context/I18nContext";

export default function Wallets() {
    const [walletsExtended, setWalletsExtended] = useState(true);

    const [isCopying, setCopying] = useState<string>("");

    const { t } = useCyberTranslation();

    const {
        user,
        logout,
        accounts,
        userData,
        changeAccount,
        authenticated = false,
    } = useContext(UserContext);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopying(text);

        setTimeout(() => {
            setCopying("");
        }, 1000);
    };

    if (!walletsExtended) return null;

    return (
        <>
            {Object.keys(accounts || {}).length > 0 && (
                <Container className="scrollbar">
                    <div
                        onClick={() => setWalletsExtended((prev) => !prev)}
                        className="walletsTitle"
                    >
                        <p>{t`YOUR_WALLETS`}</p>
                        <span
                            style={{
                                transform: walletsExtended
                                    ? "rotate(-90deg)"
                                    : "rotate(90deg)",
                                opacity: 0.6,
                            }}
                        >
                            <Icon name="right-chevron" width="12px" />
                        </span>
                    </div>
                    <Account active={true}>
                        <Dot active={true} />
                        <p>
                            {user?.id.slice(0, 6)}...
                            {user?.id.slice(
                                user?.id.length - 6,
                                user?.id.length
                            )}
                        </p>
                        <span onClick={(e) => copyToClipboard(user?.id)}>
                            {isCopying == user?.id ? t`COPIED` : t`COPY`}
                        </span>
                    </Account>

                    {walletsExtended &&
                        Object.keys(accounts).map((accountId, i) => {
                            const { walletId } = accounts[accountId];
                            return (
                                walletId.toLowerCase() !=
                                    user?.id.toLowerCase() && (
                                    <Account key={i}>
                                        <Dot
                                            active={
                                                walletId.toLowerCase() ==
                                                user?.id.toLowerCase()
                                            }
                                        />
                                        <p
                                            onClick={(e) => {
                                                // prettier-ignore
                                                // @ts-ignore
                                                if (e.target.className !== "copy") {
                                            changeAccount(
                                                walletId
                                            );
                                        }
                                            }}
                                        >
                                            {walletId.slice(0, 6)}
                                            ...
                                            {walletId.slice(
                                                walletId.length - 6,
                                                walletId.length
                                            )}
                                        </p>
                                        <span
                                            onClick={(e) =>
                                                copyToClipboard(walletId)
                                            }
                                        >
                                            {isCopying == walletId
                                                ? t`COPIED`
                                                : t`COPY`}
                                        </span>
                                    </Account>
                                )
                            );
                        })}
                </Container>
            )}
        </>
    );
}

const Container = styled.div`
    max-height: 280px;
    overflow-y: scroll;
`;

const Account = styled.div<{
    active?: boolean;
}>`
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 6px 8px;
    width: 100%;
    cursor: pointer;

    &:hover {
        & > span {
            visibility: visible;
        }
    }

    & > span {
        visibility: hidden;
        font-size: 11px;
        opacity: 0.4;

        &:hover {
            opacity: 1;
        }
    }

    & > p {
        margin: 0;
        width: 100%;
        font-size: 14px;
        text-align: left;
        transition: 0.2s;
        color: var(--color);
        font-weight: 400;
        opacity: ${({ active }) => (active ? 1 : 0.4)};
        letter-spacing: -0.03em;

        &:hover {
            opacity: 1;
        }
    }
`;

const Dot = styled.div<{
    active: boolean;
}>`
    height: 8px;
    width: 8px;
    margin-right: 8px;
    background: ${({ active }) => (active ? "#00E3BD" : "transparent")};
    border: 1px solid
        ${({ active }) => (active ? "#00E3BD" : "rgba(255, 255, 255, 0.3)")};
    border-radius: 50%;
    display: inline-block;
`;
