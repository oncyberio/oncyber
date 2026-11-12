import React, {
    FunctionComponent,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    useRef,
} from "react";

import { useProviderButtons } from "./useProviderButtons";

import {
    AuthPayload,
    USER_LOGIN,
    UserContext,
} from "@components/context/UserContext";

import { WalletConnection } from "@dapp/connect";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import AccountsAPI from "@api/accounts/_api";

import { sendSignInLink } from "@features/auth/providers/password";

import {
    describeSignInResponse,
    SignInFailure,
} from "@features/auth/signInErrors";

import { LoadingState } from "@ui/components/WalletButtons";

/** A sign-in that did not finish, and the control it belongs beside. */
export interface ShownSignInFailure extends SignInFailure {
    /**
     * The button that was used: a wallet key ("metamask", …), "twitter",
     * "google" or "email". Empty when it is not known.
     */
    source: string;
}

interface ProviderButtonsWrapperProps {
    onConnect?: (
        connection: WalletConnection,
        token: string,
        userData: any
    ) => Promise<void>;
    errorMessage?: string;
    authCallback?: ({
        token,
        account,
        connection,
        user,
    }: {
        token: any;
        account: any;
        connection: any;
        user: any;
    }) => void;
    skipAuth?: boolean;
    skipRedirectToAccount?: boolean;
    hideHeader?: boolean;
    isDarkTheme?: boolean;
    isLink?: boolean;
    onError?: (error: any) => void;
}

export interface ProviderButtonsReturnProps {
    /** The sentence of the current failure. Empty after a cancellation. */
    error: string;
    /**
     * The same failure with the control it belongs beside, whether the
     * visitor cancelled (shown quietly) and whether Retry can help.
     */
    signInFailure: ShownSignInFailure | null;
    /** Runs the failed action again. Unset when retrying cannot help. */
    retrySignIn?: () => void;
    loading: boolean;
    shouldDisableButtons: boolean;
    isConnecting: LoadingState;
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    handleSendEmailLink: () => Promise<void>;
    sendingEmailLink: boolean;
    resetEmailLink: () => void;
    emailSuccess: boolean;
    onConnectClick: (key: string) => Promise<void>;
    web2Loading: string;
    authWeb2AfterConnect: (key: string, rest?: any) => Promise<void>;
    isLink: boolean;
    mergeAccount: any;
    handleMerge: (account: string) => Promise<void>;
    merging: boolean;
    setMergeAccount: React.Dispatch<React.SetStateAction<AuthPayload>>;
    setError: React.Dispatch<React.SetStateAction<string>>;
    mergePayload: any;
    mergeError: string;
    isEmailInputShowing: boolean;
    setShowEmailInput: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ProviderButtonsWrapper: FunctionComponent<
    PropsWithChildren<ProviderButtonsWrapperProps>
> = ({
    children,
    onConnect,
    errorMessage,
    authCallback = () => {},
    skipAuth,
    skipRedirectToAccount,
    hideHeader,
    isDarkTheme,
    isLink,
    onError,
    ...props
}) => {
    const { authHandler, dispatch, user, logoutAccount } =
        useContext(UserContext);

    // One failure at a time, kept with the control it belongs beside
    // (docs/feedback.md). `error` and `setError` are the plain-text view of
    // it that the linking screens read and write.
    const [failure, setFailure] = useState<ShownSignInFailure | null>(null);

    const error = failure && !failure.cancelled ? failure.message : "";

    const setError: React.Dispatch<React.SetStateAction<string>> = useCallback(
        (value) =>
            setFailure((current) => {
                const shown =
                    current && !current.cancelled ? current.message : "";
                const message =
                    typeof value === "function" ? value(shown) : value;
                return message
                    ? {
                          code: "",
                          message,
                          cancelled: false,
                          canRetry: false,
                          source: "",
                      }
                    : null;
            }),
        []
    );

    const fail = (described: SignInFailure, source?: string) =>
        setFailure({ ...described, source: source || "" });

    // What Retry runs: the last action the visitor started, through the
    // current render's functions so it uses what the form shows now.
    const actions = useRef<any>({});
    const lastAttempt = useRef<() => void>(null);

    const { isConnecting, onConnectClick: connectWallet } = useProviderButtons(
        skipAuth ? returnAfterConnect : authenticateAfterConnect,
        fail
    );

    async function onConnectClick(provider: any) {
        setFailure(null);
        lastAttempt.current = () => actions.current.onConnectClick(provider);
        await connectWallet(provider);
    }

    const [loading, _setLoading] = useState(false);

    const [web2Loading, setWeb2Loading] = useState("");

    const [sendingEmailLink, setSendingEmailLink] = useState(false);
    const emailSendPending = useRef(false);

    const [emailSuccess, setEmailSuccess] = useState(false);

    const [email, setEmail] = useState("");

    const [password, setPassword] = useState("");

    const [mergeAccount, setMergeAccount] = useState<any>(null);

    const [merging, setMerging] = useState(false);

    const [mergePayload, setMergePayload] = useState<any>(null);

    const [mergeError, setMergeError] = useState("");

    const [isEmailInputShowing, setShowEmailInput] = useState(false);

    async function returnAfterConnect(connection: WalletConnection) {
        let account = connection.walletId;

        if (connection.type === "ethereum") {
            account = account.toLowerCase();
        }

        authCallback({
            token: null,
            account,
            connection,
            user: null,
        });
    }

    function handleMerge(source: "target" | "current") {
        setMerging(true);

        setMergeError("");

        amplitude_logAnalyticsEvent("account_merge_triggered", {
            user: user?.id,
            accountToMerge: mergePayload?.owner,
            accountToMergeType: mergePayload?.type,
            accountToMergeProvider: mergePayload?.providerId,
        });

        AccountsAPI.opts({
            // checksum: true,
            encode: true,
        })
            // @ts-ignore
            .merge({
                ...mergePayload,
                source,
            })
            .then(async (resp: any) => {
                if (resp.success) {
                    // check if user is in accounts list

                    await logoutAccount(mergePayload.owner);
                    // update

                    // dispatch({
                    //     type: USER_LOGIN,
                    //     payload: {
                    //         exhibitIds: resp.user.exhibitIds,
                    //         linkedAccounts: resp.user.linkedAccounts,
                    //     },
                    // });

                    amplitude_logAnalyticsEvent("account_merge_success", {
                        user: user?.id,
                        accountToMerge: mergePayload?.owner,
                        accountToMergeType: mergePayload?.type,
                        accountToMergeProvider: mergePayload?.providerId,
                    });

                    location.reload();

                    return;
                }

                setMerging(false);

                throw new Error(resp.message);
            })
            .catch((err) => {
                console.log("[ handleMerge ] err", err);

                setMergeError(err.message);

                amplitude_logAnalyticsEvent("account_merge_failed", {
                    user: user?.id,
                    accountToMerge: mergePayload?.owner,
                    accountToMergeType: mergePayload?.type,
                    accountToMergeProvider: mergePayload?.providerId,
                });

                setMerging(false);
            });
    }

    async function authenticateAfterConnect(connection: WalletConnection) {
        //
        setError("");
        setMergeAccount(null);
        setMergePayload(null);

        let account =
            connection.type === "ethereum"
                ? connection.walletId.toLowerCase()
                : connection.walletId;

        let authResponse = await authHandler({
            type: "web3",
            connection,
            walletId: account,
            skipRedirectToAccount,
            islinking: isLink,
            // linkAccount: user?.id || "",
        });

        if (authResponse.success === false) {
            fail(
                describeSignInResponse(authResponse),
                (connection as any).provider
            );

            if (onError) {
                onError({
                    message: authResponse.message,
                    type: authResponse.type,
                });

                console.log("[ authenticateAfterConnect ] authResponse", {
                    authResponse,
                });

                if (authResponse.type === "link:account-exists") {
                    setMergeAccount(authResponse.authPayload);
                    setMergePayload(authResponse.mergePayload);
                }
            }
        } else {
            if (onConnect) {
                await onConnect(
                    connection,
                    authResponse.token,
                    authResponse.user
                );
            } else {
                const resp = await authCallback({
                    account: authResponse.accountId,
                    connection,
                    token: authResponse.token,
                    user: authResponse.user,
                });

                // @ts-ignore
                if (!skipRedirectToAccount && !resp?.reload) {
                    const { exhibit, ...rest } = authResponse.user;

                    dispatch({
                        type: USER_LOGIN,
                        payload: {
                            token: authResponse.token,
                            user: { id: authResponse.accountId },
                            authenticated: true,
                            userData: rest,
                            exhibit: exhibit,
                        },
                    });
                }
            }
        }
    }

    async function authWeb2AfterConnect(
        key: "google" | "twitter" | "passwordless",
        rest: any = {}
    ) {
        setError("");
        setMergeAccount(null);
        lastAttempt.current = () =>
            actions.current.authWeb2AfterConnect(key, rest);

        const payload = {
            type: key,
            skipRedirectToAccount,
            ...rest,
            islinking: isLink,
        };

        setWeb2Loading(key);

        const authResponse = await authHandler(payload);

        if (authResponse.success === false) {
            fail(describeSignInResponse(authResponse), key);

            if (onError) {
                onError({
                    message: authResponse.message,
                    type: authResponse.type,
                });

                if (authResponse.type === "link:account-exists") {
                    setMergeAccount(authResponse.authPayload);
                    setMergePayload(authResponse.mergePayload);
                }
            }
        } else {
            const account = authResponse.accountId;

            if (onConnect) {
                await onConnect(
                    {
                        type: "web2",
                        walletId: authResponse.accountId,
                    },
                    authResponse.token,
                    authResponse.user
                );
            } else {
                if (!skipRedirectToAccount) {
                    const { exhibit, ...rest } = authResponse.user;

                    dispatch({
                        type: USER_LOGIN,
                        payload: {
                            token: authResponse.token,
                            user: { id: account },
                            authenticated: true,
                            userData: rest,
                            exhibit: exhibit,
                        },
                    });
                }

                authCallback({
                    account,
                    connection: {
                        type: "web2",
                        walletId: authResponse.accountId,
                    },
                    token: authResponse.token,
                    user: authResponse.user,
                });
            }
        }

        setWeb2Loading("");
    }

    const shouldDisableButtons = useMemo(() => {
        return (
            loading ||
            Object.keys(isConnecting).some((key) => isConnecting[key])
        );
    }, [isConnecting, loading]);

    // A failure the page was loaded with is shown with the buttons, like any
    // other (it used to be a browser alert).
    useEffect(() => {
        if (errorMessage) setError(errorMessage);
    }, [errorMessage]);

    async function handleSendEmailLink() {
        if (emailSendPending.current) return;
        emailSendPending.current = true;
        setError("");
        setEmailSuccess(false);
        setSendingEmailLink(true);
        lastAttempt.current = () => actions.current.handleSendEmailLink();
        const failed = (message?: string, canRetry = true) =>
            fail(
                {
                    code: "email-link/not-sent",
                    message:
                        message ||
                        "Couldn’t send your sign-in link. Please try again.",
                    cancelled: false,
                    canRetry,
                },
                "email"
            );
        try {
            const response = await sendSignInLink(email, isLink);
            if (!response.success) {
                failed(response.message, !!response.retry);
                return;
            }
            setEmail(email.trim());
            setEmailSuccess(true);
        } catch {
            failed();
        } finally {
            emailSendPending.current = false;
            setSendingEmailLink(false);
        }
    }

    function resetEmailLink() {
        setEmailSuccess(false);
        setError("");
    }

    // Moving between the buttons and the email step leaves the last
    // failure behind: it was about a control that is no longer on screen.
    function showEmailInput(show: React.SetStateAction<boolean>) {
        setFailure(null);
        setShowEmailInput(show);
    }

    actions.current = {
        onConnectClick,
        authWeb2AfterConnect,
        handleSendEmailLink,
    };

    const retrySignIn =
        failure?.canRetry && lastAttempt.current
            ? () => lastAttempt.current?.()
            : undefined;

    const value = {
        error, //
        setError,
        signInFailure: failure,
        retrySignIn,

        loading,

        shouldDisableButtons, //
        isConnecting, //

        email, //
        setEmail, //
        isEmailInputShowing, //
        setShowEmailInput: showEmailInput,
        // password,
        // setPassword,
        handleSendEmailLink, //
        resetEmailLink,
        sendingEmailLink, //
        emailSuccess, //
        // setEmailSuccess,

        onConnectClick, //
        web2Loading, //
        authWeb2AfterConnect, //

        isLink, //

        mergeAccount, //
        handleMerge, //
        merging, //
        setMergeAccount, //
        mergePayload,
        mergeError,

        ...props,
    };

    return React.Children.map(
        children,
        (child: React.DetailedReactHTMLElement<any, HTMLElement>) => {
            return React.cloneElement(child, {
                ...value,
                ...child.props,
            });
        }
    );
};
