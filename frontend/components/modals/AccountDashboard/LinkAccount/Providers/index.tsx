import {
    FunctionComponent,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { ProviderButtonsReturnProps } from "../../../SignupProvider/ProviderButtonsWrapper";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import AccountsAPI from "@api/accounts/_api";
import { UPDATE_USER_DATA, UserContext } from "@components/context/UserContext";
import styled from "styled-components";
import { baseTokens as base, landingTokens as landing } from "@styles/tokens";
import IconImg from "@ui/components/IconImg";
import { Toggle } from "@features/studio/components/Toggle";
import Input from "@ui/components/Input";
import { WalletButtons } from "@ui/components/WalletButtons";
import { getProxyWallets } from "@utils/auth/proxyWallets";
import { getAddrType } from "@utils/getAddrType";
import Spinner from "@ui/components/Spinner";
import Avatar from "@ui/components/Avatar";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/factory/player/constants";
import RadioBox from "@ui/components/RadioBox";
import { NButton } from "@ui/components/NButton";
import { useRouter } from "next/router";
import {
    ButtonsWrapper,
    Container,
    Error,
    MetadataWrapper,
    MetadatasWrapper,
    ProviderWrapper,
    UserWrapper,
    UsersWrapper,
    WalletProviderButton,
} from "./styles";
import MergeAccountForm from "./MergeAccountForm";
import EmailForm from "./EmailForm";
import WalletsForm from "./WalletsForm";
import { LinkedAccount } from "@uitypes/user";
import Checkbox from "@ui/components/Checkbox";
import { authServices } from "@features/auth/providers";

const Providers: FunctionComponent<
    Partial<ProviderButtonsReturnProps> & {
        isDarkTheme?: boolean;
        hideHeader?: boolean;
    }
> = ({
    error,
    shouldDisableButtons,
    isConnecting,
    email,
    setEmail,
    handleSendEmailLink,
    sendingEmailLink,
    emailSuccess,
    onConnectClick,
    web2Loading,
    authWeb2AfterConnect,
    isLink,
    mergeAccount,
    handleMerge,
    merging,
    setMergeAccount,
    isDarkTheme,
    hideHeader,
    setError,
    mergeError,
}) => {
    const [loading, setLoading] = useState("");

    const { userData, dispatch, currentAccount } = useContext(UserContext);

    const [isEmailLogin, setIsEmailLogin] = useState(false);

    const [isWalletLogin, setIsWalletLogin] = useState(false);

    const [selectedAccountToMerge, setSelectedAccountToMerge] = useState<
        "current" | "target"
    >("current");

    const [togglingTwitter, setTogglingTwitter] = useState(false);

    const router = useRouter();

    useEffect(() => {
        if (
            router.query?.oobCode &&
            router.query?.mode === "signIn" &&
            router.query?.apiKey &&
            router.query?.link
        ) {
            authWeb2AfterConnect("passwordless");
        }
    }, []);

    const [isTwitterActive, isGoogleActive, isEmailActive] = useMemo(() => {
        const isTwitterActive = userData?.linkedAccounts?.find(
            (account) => account.providerId === "twitter.com"
        );

        const isGoogleActive = userData?.linkedAccounts?.find(
            (account) => account.providerId === "google.com"
        );

        const isEmailActive = userData?.linkedAccounts?.find(
            (account) => account.providerId === "email"
        );

        return [isTwitterActive, isGoogleActive, isEmailActive];
    }, [userData]);

    const isTwitterLinked =
        isTwitterActive || userData?.providerId === "twitter.com";

    function handleUnlink(accountId: string) {
        if (loading) return;

        if (!accountId) return;

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
                            ...resp.account,
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

    async function handleTwitterHandleToggle(e) {
        setTogglingTwitter(true);

        const payload = {};

        // for old accounts that dont have userData.socials.twitter
        if (!userData.socials?.twitter) {
            const credentials: any = await authServices["twitter"].signIn();

            payload["twitterHandle"] =
                credentials?.user?.reloadUserInfo?.screenName;
            payload["sig"] = await credentials.user.getIdToken();
        }

        const resp = await AccountsAPI.activateSocial({
            isActive: e.target.checked,
            ...payload,
        });

        if (!resp.success) {
            setError(resp.message);

            setTogglingTwitter(false);

            return;
        }

        dispatch({
            type: UPDATE_USER_DATA,
            payload: {
                socials: resp.socials,
            },
        });

        setTogglingTwitter(false);
    }

    function handleToggle(providerId: "google" | "twitter" | "email") {
        let provider: LinkedAccount;

        if (providerId === "google") {
            provider = isGoogleActive;
        } else if (providerId === "twitter") {
            provider = isTwitterActive;
        } else if (providerId === "email") {
            provider = isEmailActive;
        }

        if (loading === provider?.accountId) return;

        if (
            (providerId === "google" &&
                userData?.providerId === "google.com") ||
            (providerId === "twitter" &&
                userData.providerId === "twitter.com") ||
            (providerId === "email" && userData.providerId === "email")
        )
            return;

        if (provider) {
            handleUnlink(provider.accountId);
        } else {
            if (providerId === "email") {
                setIsEmailLogin(true);
                return;
            }

            authWeb2AfterConnect(providerId);
        }
    }

    if (mergeAccount) {
        return (
            <MergeAccountForm
                userData={userData}
                mergeAccount={mergeAccount}
                setMergeAccount={setMergeAccount}
                handleMerge={handleMerge}
                selectedAccountToMerge={selectedAccountToMerge}
                setSelectedAccountToMerge={setSelectedAccountToMerge}
                merging={merging}
                setError={setError}
                mergeError={mergeError}
            />
        );
    }

    if (isWalletLogin) {
        return (
            <WalletsForm
                isDarkTheme={true}
                shouldDisableButtons={shouldDisableButtons}
                isConnecting={isConnecting}
                onConnectClick={onConnectClick}
                setIsWalletLogin={setIsWalletLogin}
            />
        );
    }

    if (isEmailLogin) {
        return (
            <EmailForm
                setIsEmailLogin={setIsEmailLogin}
                email={email}
                setEmail={setEmail}
                emailSuccess={emailSuccess}
                handleSendEmailLink={handleSendEmailLink}
                sendingEmailLink={sendingEmailLink}
            />
        );
    }

    return (
        <Container>
            <div>
                {error ? (
                    <Error style={{ marginBottom: 18 }}>{error}</Error>
                ) : null}

                <p style={{ marginBottom: 12 }}>Connect Social Accounts</p>

                <div
                    style={
                        isTwitterLinked
                            ? {
                                  border: `1px solid ${base.color.line.default}`,
                                  marginBottom: 5,
                                  borderRadius: 8,
                                  overflow: "hidden",
                              }
                            : {}
                    }
                >
                    <ProviderWrapper
                        style={
                            isTwitterLinked
                                ? {
                                      marginBottom: 0,
                                      border: "none",
                                  }
                                : null
                        }
                    >
                        <div>
                            <IconImg mode="light" name="twitter" size={16} />
                            <p>Twitter</p>
                            {userData?.socials?.twitter?.handle ? (
                                <TwitterHandle>
                                    @{userData.socials.twitter.handle}
                                </TwitterHandle>
                            ) : null}
                        </div>
                        {loading === isTwitterActive?.accountId ? (
                            <Spinner
                                isLightTheme={false}
                                stroke={base.color.ink}
                                width={18}
                            />
                        ) : (
                            <Toggle
                                disabled={
                                    userData?.providerId === "twitter.com"
                                }
                                onChange={() => handleToggle("twitter")}
                                value={
                                    userData?.providerId === "twitter.com" ||
                                    isTwitterActive
                                }
                            />
                        )}
                    </ProviderWrapper>

                    {isTwitterLinked ? (
                        <TwitterCheckWrapper>
                            <p>Display on Profile</p>
                            {togglingTwitter ? (
                                <Spinner
                                    isLightTheme={false}
                                    stroke={base.color.ink}
                                    width={18}
                                />
                            ) : (
                                <Checkbox
                                    width="15px"
                                    height="15px"
                                    checked={userData.socials?.twitter?.active}
                                    // defaultChecked={
                                    //     userData.socials?.twitter?.active
                                    // }
                                    onChange={handleTwitterHandleToggle}
                                />
                            )}
                        </TwitterCheckWrapper>
                    ) : null}
                </div>

                <ProviderWrapper>
                    <div>
                        <IconImg mode="light" name="google" size={16} />
                        <p>Google</p>
                    </div>
                    {loading === isGoogleActive?.accountId ? (
                        <Spinner
                            isLightTheme={false}
                            stroke={base.color.ink}
                            width={18}
                        />
                    ) : (
                        <Toggle
                            disabled={userData?.providerId === "google.com"}
                            onChange={() => handleToggle("google")}
                            value={
                                userData?.providerId === "google.com" ||
                                isGoogleActive
                            }
                        />
                    )}
                </ProviderWrapper>

                <ProviderWrapper>
                    <div>
                        <IconImg mode="light" name="mail" size={16} />
                        <p>Email</p>
                    </div>
                    {loading === isEmailActive?.accountId ||
                    web2Loading === "passwordless" ? (
                        <Spinner
                            isLightTheme={false}
                            stroke={base.color.ink}
                            width={18}
                        />
                    ) : (
                        <Toggle
                            disabled={userData?.providerId === "email"}
                            onChange={() => handleToggle("email")}
                            value={
                                userData?.providerId === "email" ||
                                isEmailActive
                            }
                        />
                    )}
                </ProviderWrapper>
            </div>

            <div>
                <p style={{ marginTop: 20, marginBottom: 12 }}>
                    Connected Wallets
                </p>

                <div>
                    {userData?.linkedAccounts
                        .filter((account) => account.type === "web3")
                        .concat(
                            userData?.type !== "web2"
                                ? {
                                      providerId: getAddrType(userData?.id),
                                      type: "web3",
                                      accountId: userData?.id,
                                  }
                                : []
                        )
                        ?.map((account: any) => {
                            return (
                                <ProviderWrapper key={account.accountId}>
                                    <div>
                                        <IconImg
                                            mode="light"
                                            name={account.providerId}
                                            size={16}
                                        />
                                        <p>{account.accountId}</p>
                                    </div>
                                    <Toggle
                                        disabled={
                                            account.accountId?.toLowerCase() ===
                                            userData?.id?.toLowerCase()
                                        }
                                        onChange={() => {
                                            handleUnlink(account.accountId);
                                        }}
                                        value={
                                            loading !== account.accountId
                                                ? "loading"
                                                : ""
                                        }
                                    />
                                </ProviderWrapper>
                            );
                        })}
                </div>

                <WalletProviderButton
                    onClick={() => setIsWalletLogin(true)}
                    style={{ cursor: "pointer" }}
                >
                    Add wallet
                </WalletProviderButton>
            </div>
        </Container>
    );
};

const TwitterHandle = styled.span`
    font-size: 12px;
    // max-width: 15em;
    // overflow: hidden;
    // text-overflow: ellipsis;
    // display: inline-block;
`;

const TwitterCheckWrapper = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    background: ${landing.color.surface};
    // margin-bottom: 5px;
    border-radius: 8px;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    padding-top: 10px;

    p {
        margin: 0;
    }
`;

export default Providers;
