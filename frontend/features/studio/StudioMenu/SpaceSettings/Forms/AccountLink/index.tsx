import { UPDATE_USER_DATA, UserContext } from "@components/context/UserContext";

import ProviderButtons from "@components/modals/SignupProvider/ProviderButtons";

import IconImg from "@ui/components/IconImg";

import { NButton } from "@features/studio/components/StudioButton";

import { useContext, useState } from "react";

import styled from "styled-components";

import AccountsAPI from "@api/accounts/_api";

import Spinner from "@ui/components/Spinner";

import { showConfirm } from "@components/Dialogs";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import { ProviderButtonsWrapper } from "@components/modals/SignupProvider/ProviderButtonsWrapper";

export default function AccountLink(props) {
    const { userData, dispatch } = useContext(UserContext);

    const [isLinkOpen, setIsLinkOpen] = useState(false);

    const [error, setError] = useState("");

    const [loading, setLoading] = useState("");

    function handleConnect(connection, token, userData) {
        console.log("[ handleConnect ] data", userData);

        if (userData.linkedAccounts) {
            dispatch({
                type: UPDATE_USER_DATA,
                payload: {
                    linkedAccounts: userData?.linkedAccounts || [],
                },
            });
        }

        setIsLinkOpen(false);
    }

    function handleUnlink(accountId: string) {
        if (loading) return;

        amplitude_logAnalyticsEvent("account_unlink_triggered", {
            accountId,
        });

        setLoading(accountId);

        AccountsAPI.unlink({
            accountToUnlink: accountId,
        })
            .then((resp: any) => {
                if (resp.success) {
                    amplitude_logAnalyticsEvent("account_unlink_success", {
                        accountId,
                    });
                    dispatch({
                        type: UPDATE_USER_DATA,
                        payload: {
                            linkedAccounts: resp.account?.linkedAccounts || [],
                        },
                    });
                } else {
                    amplitude_logAnalyticsEvent("account_unlink_failed", {
                        accountId,
                        error: resp.message,
                    });
                    setError(resp.message);
                }
            })
            .catch((err) => {
                console.log("[ Unlink ] err", err);

                amplitude_logAnalyticsEvent("account_unlink_failed", {
                    accountId,
                    error: err.message,
                });

                setError("Failed to link account");
            })
            .finally(() => {
                setLoading("");
            });
    }

    return (
        <div>
            {isLinkOpen ? (
                <div>
                    <div
                        onClick={() => setIsLinkOpen(false)}
                        style={{
                            cursor: "pointer",
                            marginBottom: 21,
                        }}
                    >
                        <IconImg name="arrow-left" mode="light" />
                    </div>
                    <ProviderButtonsWrapper
                        onError={(err) => {}}
                        onConnect={handleConnect}
                        skipRedirectToAccount
                        isLink
                        isDarkTheme
                        hideHeader
                    >
                        <ProviderButtons />
                    </ProviderButtonsWrapper>
                </div>
            ) : (
                <div>
                    <IconButton
                        style={{ cursor: "pointer" }}
                        onClick={() => setIsLinkOpen(true)}
                    >
                        <IconImg name="users" mode="light" size={21} />
                        <p>Link Account</p>
                    </IconButton>

                    {error ? (
                        <p style={{ color: "red", textAlign: "center" }}>
                            {error}
                        </p>
                    ) : null}

                    <div>
                        {userData.linkedAccounts
                            ? userData.linkedAccounts.map((account, index) => {
                                  const { accountId } = account;

                                  return (
                                      <IconWrapper key={accountId}>
                                          <p>{accountId}</p>
                                          {loading === accountId ? (
                                              <Spinner width={16} />
                                          ) : (
                                              <div
                                                  onClick={() =>
                                                      handleUnlink(accountId)
                                                  }
                                                  style={{
                                                      cursor: "pointer",
                                                  }}
                                              >
                                                  <IconImg
                                                      name="x"
                                                      mode="light"
                                                      size={16}
                                                  />
                                              </div>
                                          )}
                                      </IconWrapper>
                                  );
                              })
                            : null}
                    </div>
                </div>
            )}
        </div>
    );
}

const IconWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    p {
        font-size: 14px;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;

const IconButton = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: 21px;
    font-weight: 500;

    p {
        font-size: 14px;
        margin: 0;
        margin-left: 10px;
    }
`;
