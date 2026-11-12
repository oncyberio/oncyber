import { showError, showPrompt } from "@components/Dialogs";
import { waitForNavigationSaves } from "@utils/navigationSaves";
import { useEffect, useMemo, useReducer, useState } from "react";

import React from "react";

import { useRouter } from "next/router";

import cookie from "cookie";

import type { Experience, PortalData } from "@uitypes/experience";

import type { RoomParameters } from "@uitypes/roomParameters";

import type { Asset } from "@uitypes/Asset";

import type { UserState } from "@uitypes/user";

import type {
    NiftyConnection,
    SolanaWallet,
    WalletConnection,
} from "@dapp/connect";

import { getAddrType, isEthereumAddress } from "@utils/getAddrType";

import { nodeEnv } from "@env";

import {
    amplitude_identify_user,
    amplitude_logAnalyticsEvent,
    amplitude_setIndetity,
    amplitude_setUserId,
} from "@utils/analytics";

import { isAutographUser } from "@utils/autographAssets";

import { useHotkey } from "@components/hooks/useHotkey";

import type * as AuthProviders from "@features/auth/providers";

import { AuthenticationHandlerParams } from "@features/auth/@types";

import { describeSignInError } from "@features/auth/signInErrors";

import { selectIsSignedIn } from "./isSignedIn";
import SessionLoadError from "./SessionLoadError";

export { selectIsSignedIn } from "./isSignedIn";

import AccountsApi from "@api/accounts/_api";

import { getAnonExhibit } from "@utils/anon";
import { getDefaultWallet, getLinkedWallets } from "@features/studio/utils";
import { getDestination } from "@utils/saveToDb";

// Firebase Auth (and, on phones and Safari, the iframe and Google script it
// starts) loads only for sign-in, not on every page. The sign-in sheet's
// provider buttons import the providers statically, so by the time a
// visitor clicks one the module is loaded and authHandler reaches the popup
// without waiting on a download.
let authProviders: typeof AuthProviders = null;

function loadAuthProviders(): Promise<typeof AuthProviders> {
    if (authProviders) return Promise.resolve(authProviders);

    return import("@features/auth/providers").then((module) => {
        authProviders = module;
        return module;
    });
}

function toHex(s) {
    var hex = "";
    for (var i = 0; i < s.length; i++) {
        hex += "" + s.charCodeAt(i).toString(16);
    }
    return `0x${hex}`;
}

const userInitialState = {
    id: "",
};

const SECRET =
    "Welcome to Cyber! This message allows us to make your account secure.";

export type Signature =
    | {
          type: "ethereum";
          sig: string;
      }
    | {
          type: "solana";
          sig: number[];
      }
    | {
          type: "tezos";
          publicKey: string;
      };

export interface Account {
    walletId: string;
    type?: WalletConnection["type"];
    trustedDelegation?: boolean;
}

export interface AuthPayload {
    owner: string;
    sig: any;
    type: "web3" | "web2";
    providerId: string;
    userMetadata: {
        photoURL: string;
        displayName: string;
        email: string;
        twitterHandle: string;
    };
    linkAccount: string;
}

export type AuthResponse =
    | { success: true; token: string }
    | { success: false; message: string };

export type Step = "create-destination" | "connect" | "share-assets";

export interface UserContextState {
    logoutAccount(account: any): Promise<void>;
    user: { id: string };
    /**
     * True once a session exists, which includes the anonymous draft
     * session of the studio. To ask "is this visitor signed in to an
     * account?", read `isSignedIn`.
     */
    authenticated: boolean;
    /**
     * The visitor is signed in to an account: authenticated, not anonymous,
     * with an account id and its token. The one definition every screen
     * should use; see `./isSignedIn.ts` for why it is this one.
     */
    isSignedIn: boolean;
    isAutograph: boolean;
    loading: boolean;
    userData?: Partial<UserState>;
    dispatch: (action: any) => void;
    handleCreateExhibit: () => void;
    toggleTipsDesktop: (enableTipsDesktop: boolean) => void;
    // createNewAccountAndLogin: (room: string) => Promise<void>;
    simple_authenticate: (
        account: string,
        connection: NiftyConnection
    ) => Promise<AuthResponse>;
    changeAccount: (walletId: string) => Promise<void>;
    addNewAccount: () => Promise<void>;
    logout: () => Promise<void>;
    isFirstLogin: boolean;
    exhibit: Partial<Experience>;
    token: string;
    step: Step;
    currentAccount: string;
    walletConnection: WalletConnection;
    accounts: Record<string, Account>;
    prevState: object;
    isNavHidden: boolean;
    isSpaceBeta: boolean;
    destination: Partial<RoomParameters>;
    exhibits: Array<Partial<Experience>>;
    showTipsDesktop: boolean;
    loadingExhibits: boolean;
    settings: {
        transformMode: string;
    };
    invite: {
        success: boolean;
        message: string;
    };
    providersState: {
        [x: string]: string;
    };
    authHandler(opts: AuthenticationHandlerParams): Promise<{
        success: boolean;
        token?: any;
        /** On failure: the sentence to show (features/auth/signInErrors). */
        message?: string;
        type?: string;
        /** On a thrown failure: the row of `SIGN_IN_ERRORS` that matched. */
        code?: string;
        /** The visitor closed a request: still a failure, but said quietly. */
        cancelled?: boolean;
        /** Running the same sign-in again can succeed. */
        canRetry?: boolean;
        accountId?: string;
        user: {
            user: any;
            exhibit: Experience;
            exhibits: Array<Partial<Experience>>;
        };
        authPayload?: any;
        mergePayload?: any;
    }>;
    isAnonymous: boolean;
    isAnonInitialized?: boolean;
    defaultWallet: string;
    linkedWallets: Array<string>;
}

let noop = (...xs: any[]): any => {};

const getTips = () => {
    if (typeof window !== "undefined") {
        const state =
            JSON.parse(localStorage.getItem("show_tips_desktop")) === true ||
            localStorage.getItem("show_tips_desktop") == null;
        return state;
    } else {
        return false;
    }
};

function getProvidersState({ account, authenticated }) {
    if (!authenticated)
        return {
            google: "Sign in",
            twitter: "Sign in",
            password: "Sign in",
            web3: "Sign in",
        };

    return {
        google: account?.google ? "Unlink" : "Link",
        twitter: account?.twitter ? "Unlink" : "Link",
        password: account?.password ? "Unlink" : "Link",
        web3: "Link",
    };
}

const initialState: UserContextState = {
    user: userInitialState,
    authenticated: false,
    isSignedIn: false,
    isAutograph: false,
    loading: true,
    userData: {},
    dispatch: noop,
    handleCreateExhibit: noop,
    toggleTipsDesktop: noop,
    // createNewAccountAndLogin: noop,
    simple_authenticate: noop,
    addNewAccount: noop,
    changeAccount: noop,
    logout: noop,
    isFirstLogin: false,
    exhibit: {},
    token: "",
    step: "connect",
    currentAccount: "",
    walletConnection: null,
    accounts: {},
    prevState: {},
    isNavHidden: false,
    isSpaceBeta: false,
    showTipsDesktop: getTips(),
    destination: {},
    exhibits: [],
    settings: {
        transformMode: "",
    },
    loadingExhibits: true,
    invite: null,
    providersState: {
        google: "Sign in",
        twitter: "Sign in",
        password: "Sign in",
        web3: "Sign in",
    },
    authHandler: async (opts) => null,
    isAnonymous: false,
    isAnonInitialized: false,
    logoutAccount: async (opts) => null,
    defaultWallet: "",
    linkedWallets: [],
};

export const UserContext = React.createContext(initialState);

export const USER_LOGIN = "USER_LOGIN";
export const USER_LOGOUT = "USER_LOGOUT";
export const LOADING_ENDED = "LOADING_ENDED";
export const LOADING_STARTED = "LOADING_STARTED";
export const EXPERIENCE_DATA_UPDATED = "EXPERIENCE_DATA_UPDATED";
export const UPDATE_EXHIBIT = "UPDATE_EXHIBIT";
export const CHANGE_STEP = "CHANGE_STEP";
export const HANDLE_CREATE_EXHIBIT = "HANDLE_CREATE_EXHIBIT";
export const ALERT_BETA_SPACE = "ALERT_BETA_SPACE";
export const UPDATE_USER_DATA = "UPDATE_USER_DATA";
export const TOGGLE_NAVIGATION = "TOGGLE_NAVIGATION";
export const UPDATE_USER_ASSETS = "UPDATE_USER_ASSETS";
export const UPDATE_CURRENT_DESTINATION = "UPDATE_CURRENT_DESTINATION";
export const UPDATE_IS_ASSETS_SHARED = "UPDATE_IS_ASSETS_SHARED";
export const UPDATE_EXHIBIT_AND_DESTINATION = "UPDATE_EXHIBIT_AND_DESTINATION";
export const UPDATE_EXHIBITS = "UPDATE_EXHIBITS";
export const ENABLE_TIPS_DESKTOP = "ENABLE_TIPS_DESKTOP";
export const CHANGE_SCENE_PLAYER_MODE = "CHANGE_SCENE_PLAYER_MODE";
export const UPDATE_PORTALS = "UPDATE_PORTALS";

export type UserContextAction =
    | { type: typeof UPDATE_PORTALS; payload: { [key: string]: PortalData } }
    | { type: typeof USER_LOGIN; payload: Partial<UserContextState> }
    | { type: typeof USER_LOGOUT; payload: Partial<UserContextState> }
    | { type: typeof LOADING_STARTED }
    | { type: typeof LOADING_ENDED }
    | { type: typeof EXPERIENCE_DATA_UPDATED; payload: Partial<Experience> }
    | { type: typeof UPDATE_EXHIBIT; payload: Experience }
    | { type: typeof CHANGE_STEP; payload: Step }
    | { type: typeof HANDLE_CREATE_EXHIBIT }
    | { type: typeof UPDATE_USER_DATA; payload: Partial<UserState> }
    | {
          type: typeof TOGGLE_NAVIGATION;
          payload: Partial<{ isNavHidden: boolean }>;
      }
    | {
          type: typeof ALERT_BETA_SPACE;
          payload: Partial<{ isSpaceBeta: boolean }>;
      }
    | { type: typeof UPDATE_USER_ASSETS; payload: Array<Asset> }
    | { type: typeof UPDATE_IS_ASSETS_SHARED; payload: boolean }
    | { type: typeof UPDATE_CURRENT_DESTINATION; payload: RoomParameters }
    | { type: typeof UPDATE_EXHIBITS; payload: Array<any> }
    | {
          type: typeof ENABLE_TIPS_DESKTOP;
          payload: {
              enableTipsDesktop: boolean;
          };
      }
    | {
          type: typeof CHANGE_SCENE_PLAYER_MODE;
          payload: {
              playerMode: string;
          };
      }
    | {
          type: typeof UPDATE_EXHIBIT_AND_DESTINATION;
          payload: {
              destination: UserContextState["destination"];
              exhibit: UserContextState["exhibit"];
          };
      };

const reducer = (
    state: UserContextState,
    action: UserContextAction
): UserContextState => {
    if (action.type === USER_LOGIN) {
        return {
            ...state,
            ...(action.payload.user && action.payload.user.id !== state.user?.id ? { exhibits: [] } : {}),
            ...action.payload,
        };
    }

    if (action.type === UPDATE_EXHIBITS) {
        return {
            ...state,
            exhibits: action.payload,
            loadingExhibits: false,
        };
    }

    if (action.type === UPDATE_EXHIBIT_AND_DESTINATION) {
        return {
            ...state,
            ...action.payload,
        };
    }

    if (action.type === UPDATE_CURRENT_DESTINATION) {
        return {
            ...state,
            destination: action.payload,
        };
    }

    if (action.type === UPDATE_USER_DATA) {
        return {
            ...state,
            userData: {
                ...state.userData,
                ...action.payload,
            },
        };
    }

    if (action.type === UPDATE_USER_ASSETS) {
        return {
            ...state,
            userData: {
                ...state.userData,
                assets: action.payload,
            },
        };
    }

    if (action.type === UPDATE_EXHIBIT) {
        return {
            ...state,
            exhibit: action.payload,
        };
    }

    if (action.type === UPDATE_PORTALS) {
        return {
            ...state,
            exhibit: {
                ...state.exhibit,
                portals: {
                    ...state.exhibit.portals,
                    ...action.payload,
                },
            },
        };
    }

    if (action.type === HANDLE_CREATE_EXHIBIT) {
        return {
            ...state,
            authenticated: false,
            step: "create-destination",
        };
    }

    if (action.type === CHANGE_STEP) {
        return {
            ...state,
            step: action.payload,
        };
    }

    if (action.type === EXPERIENCE_DATA_UPDATED) {
        const exhibit = {
            ...state.exhibit,
            ...action.payload,
        };

        const exhibits = state.exhibits.map((it) => {
            /**
             * Normally we should just return `exhibit` here, but it seems items
             * in `state.exhibits` are different from `state.exhibit`. So we nee to also merge
             * the changes in the item in the array
             */
            return it.id === exhibit.id
                ? {
                      ...it,
                      ...action.payload,
                  }
                : it;
        });

        return {
            ...state,
            exhibit,
            exhibits,
        };
    }

    if (action.type === USER_LOGOUT) {
        return {
            ...initialState,
            ...action.payload,
            loading: false,
        };
    }

    if (action.type === LOADING_STARTED) {
        return {
            ...state,
            loading: true,
        };
    }

    if (action.type === LOADING_ENDED) {
        return {
            ...state,
            loading: false,
        };
    }

    if (action.type === ALERT_BETA_SPACE) {
        return {
            ...state,
            isSpaceBeta: action.payload?.isSpaceBeta,
        };
    }

    if (action.type === TOGGLE_NAVIGATION) {
        return {
            ...state,
            isNavHidden: action.payload?.isNavHidden,
        };
    }

    if (action.type === ENABLE_TIPS_DESKTOP) {
        return {
            ...state,
            showTipsDesktop: action.payload?.enableTipsDesktop,
        };
    }

    return state;
};

interface UserProviderProps {
    authenticated: boolean;
    user: UserState;
    isAutograph: boolean;
    token: string;
    userId: string;
    exhibit: Experience;
    destination: RoomParameters;
    step: Step;
    invite: {
        success: boolean;
        message: string;
    };
    children: React.ReactNode;
    isAnonymous: boolean;
}

export function getLocalAccounts(): Record<string, Account> {
    let accounts = JSON.parse(localStorage.getItem("accounts")) as Record<
        string,
        Account
    >;

    for (let key in accounts) {
        let acc = accounts[key];
        // type field is new so we need to deal with old data stored in user's local storage
        // We assume untyped wallets always be 'tezos' or 'ethereum' and use the 0x prefix
        // to distinguish ethereum wallets.
        // Solana wallets are new and thus will always peristed with a type field
        if (acc.type == null) {
            acc.type = acc.walletId.toLowerCase().startsWith("0x")
                ? "ethereum"
                : "tezos";
        }
    }
    return accounts;
}

export const UserProvider: React.FunctionComponent<UserProviderProps> = ({
    children,
    authenticated,
    isAutograph,
    user,
    token,
    userId,
    exhibit,
    destination,
    step,
    invite,
    isAnonymous,
}) => {
    const [authenticationState, dispatch] = useReducer(reducer, {
        ...initialState,
        authenticated: authenticated || false,
        isAutograph: isAutograph || false,
        userData: user || null,
        token: token || "",
        user: { id: userId || "" },
        exhibit,
        currentAccount: userId || "",
        destination: destination || {},
        step: step || "connect",
        isAnonymous: isAnonymous,
    });

    const routeSeed = useMemo(() => ({ authenticated, isAutograph, user, token,
        userId, exhibit, destination, step, isAnonymous }),
        [authenticated, isAutograph, user, token, userId, exhibit, destination, step, isAnonymous]);
    const [hydratedSeed, setHydratedSeed] = useState(isAnonymous ? null : routeSeed);
    const [isAnonInitialized, setIsAnonInitialized] = useState(!isAnonymous);

    const cca_cookie = (walletId: string) =>
        cookie.serialize("_CCA", walletId.toLowerCase(), {
            maxAge: 60 * 60 * 24 * 30,
            // expires:
            path: "/",
        });

    const router = useRouter();

    const [account, setAccount] = useState(null);

    const [authError, setAuthError] = useState("");

    // The session for this page could not be loaded. Pages that wait for it
    // (`isAnonInitialized`) render nothing meanwhile, so it is said here,
    // with a Retry that loads it again.
    const [sessionLoadFailed, setSessionLoadFailed] = useState(false);
    const [sessionLoadAttempt, setSessionLoadAttempt] = useState(0);

    const providersState = getProvidersState({ account, authenticated });

    const [defaultWallet, linkedWallets] = useMemo(() => {
        if (isAnonymous) return [authenticationState?.userData?.walletId, []];

        const defaultWallet = getDefaultWallet(authenticationState?.userData);

        const linkedWallets = getLinkedWallets(authenticationState?.userData);

        return [defaultWallet, linkedWallets];
    }, [authenticationState?.userData?.linkedAccounts]);

    useEffect(() => {
        //

        let accounts = getLocalAccounts();

        const cookies = cookie.parse(document.cookie);

        if (
            authenticated &&
            (router.query?.walletId || router.query?.inviteId)
        ) {
            // to remove query params
            window.history.replaceState(null, "", router.pathname);
        }

        if (router.query.new) {
            window.history.replaceState(null, "", router.pathname);
        }

        if (accounts) {
            dispatch({
                type: USER_LOGIN,
                payload: {
                    accounts,
                    currentAccount: cookies["_CCA"],
                },
            });
        }

        async function initAmplitude() {
            await amplitude_logAnalyticsEvent(
                "",
                {},
                true,
                isAnonymous ? "" : userId
            );

            if (accounts) {
                //!
                amplitude_identify_user(accounts);
            }
        }

        initAmplitude();
    }, []);

    useEffect(() => {
        if (!isAnonymous) return;
        import("@utils/anon/ensureLocalUploads")
            .then(({ ensureLocalUploads }) => ensureLocalUploads())
            .catch((error) =>
                console.error("Local upload storage unavailable", error)
            );
    }, [isAnonymous]);

    useEffect(() => {
        //! when using different authserversideprops
        if (step) {
            dispatch({
                type: CHANGE_STEP,
                payload: step,
            });
        }
    }, [step]);

    useEffect(() => {
        let cancelled = false;
        setIsAnonInitialized(false);
        setSessionLoadFailed(false);
        async function hydrate() {
            let nextExhibit = exhibit;
            let nextDestination = destination;
            if (isAnonymous) {
                await waitForNavigationSaves();
                if (cancelled) return;
                nextExhibit = await getAnonExhibit(exhibit);
                if (cancelled) return;
                if (nextExhibit && destination?.slug !== nextExhibit.info.room)
                    nextDestination = await getDestination(nextExhibit.info.room);
            }
            if (cancelled) return;
            dispatch({ type: USER_LOGIN, payload: {
                authenticated: !!authenticated,
                isAutograph: !!isAutograph,
                userData: user || null,
                token: token || "",
                user: { id: userId || "" },
                currentAccount: userId || "",
                isAnonymous: !!isAnonymous,
                exhibit: nextExhibit,
                destination: nextDestination || {},
                step: step || "connect",
            } });
            setHydratedSeed(routeSeed);
            setIsAnonInitialized(true);
        }
        void hydrate().catch((error) => {
            if (!cancelled) {
                setAuthError(error.message || "Could not restore this space.");
                // Said on the page with a Retry (below), not in a dialog
                // that leaves a blank page behind once it is closed.
                setSessionLoadFailed(true);
                console.error("Route hydration failed", error);
            }
        });
        return () => { cancelled = true; };
    }, [routeSeed, sessionLoadAttempt]);

    if (process.env.NODE_ENV === "development") {
        useHotkey(async (e: KeyboardEvent) => {
            // console.log("key event", e);

            if (!e.repeat && e.shiftKey && e.key.toLowerCase() === "h") {
                let acc = await showPrompt({ type: "text", message: "Development account wallet address" });
                if (acc != null) {
                    if (isEthereumAddress(acc)) {
                        acc = acc.toLowerCase();
                    }
                    let type = getAddrType(acc);
                    const response = await simple_authenticate(acc, {
                        // @ts-ignore
                        type,
                    });

                    if (!response.success) {
                        showError(response.message || "Development sign-in failed.");
                        return;
                    }
                    window.location.reload();
                }
            }
        });
    }

    async function changeAccount(walletId: string) {
        // return;
        document.cookie = cca_cookie(walletId);

        amplitude_logAnalyticsEvent("switch_wallet", {
            from: authenticationState?.user?.id,
            to: walletId,
        });

        let accounts = getLocalAccounts();

        const id = walletId.toLowerCase();

        dispatch({
            type: USER_LOGIN,
            payload: {
                // authenticated: true,
                currentAccount: id,
            },
        });

        // This setTimeout is used to fix an issue with expiring cookies
        setTimeout(() => {
            location.reload();
        }, 1000);
    }

    async function logout() {
        await AccountsApi.logout({});

        document.cookie = `_CCA=${authenticationState.currentAccount.toLowerCase()}; expires=Thu, 18 Dec 2013 12:00:00 UTC; path=/`;

        // Dispatch to change state,

        let accounts = getLocalAccounts();

        if (authenticationState.currentAccount) {
            delete accounts[authenticationState.currentAccount.toLowerCase()];
        }

        localStorage.setItem("accounts", JSON.stringify(accounts));

        if (Object.keys(accounts).length > 0) {
            const [walletId] = Object.keys(accounts);

            changeAccount(walletId.toLowerCase());
        } else {
            // This setTimeout is used to fix an issue with expiring cookies
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }

    async function logoutAccount(account) {
        let accounts = getLocalAccounts();

        if (!accounts[account.toLowerCase()]) return;

        await AccountsApi.logout({
            accountId: account,
        });

        delete accounts[account.toLowerCase()];

        localStorage.setItem("accounts", JSON.stringify(accounts));
    }

    async function addNewAccount() {
        // if (!router.pathname.includes("/studio")) {
        // }

        window.location.assign(`${nodeEnv.PUBLIC_API}/studio?new=true`);

        // dispatch({ type: USER_LOGOUT, payload: {
        //     accounts: authenticationState.accounts,
        //     // This will be used to "re-login" the user if they decide to go back
        //     prevState: authenticationState
        // } });
    }

    const simple_authenticate = async (
        walletId: string,
        connection: NiftyConnection
    ): Promise<AuthResponse> => {
        let token: string;

        const res = await fetch(`/api/user/simple_authenticate`, {
            method: "POST",
            body: JSON.stringify({
                owner: walletId,
                type: connection.type,
            }),
            headers: { "Content-Type": "application/json" },
        }).then((res) => {
            return res.json();
        });
        if (res.success) {
            token = res.token;
        }

        if (token) {
            // console.log(token);
            // _cca = cyber current account
            const isAutograph = await isAutographUser(walletId);

            document.cookie = cca_cookie(walletId);

            let accounts = getLocalAccounts();

            localStorage.setItem(
                "accounts",
                JSON.stringify({
                    [walletId.toLowerCase()]: {
                        walletId,
                        type: connection.type,
                        isAutograph,
                    },
                    ...accounts,
                })
            );

            dispatch({
                type: USER_LOGIN,
                payload: {
                    token,
                    currentAccount: walletId,
                    accounts: {
                        ...accounts,
                        [walletId]: {
                            walletId: walletId,
                            type: connection.type,
                        },
                    },
                },
            });

            // TODO: Will need to test nifty later and see how it works...

            return { success: true, token };
        } else {
            return {
                success: false,
                message: "Failed to authenticate.",
            };
        }
    };

    async function authHandler(opts: AuthenticationHandlerParams) {
        let eventName = "account_auth";

        if (opts.islinking) {
            eventName = "account_link";
        }

        try {
            amplitude_logAnalyticsEvent(eventName + "_triggered", {
                type: opts.type,
            });

            const { skipRedirectToAccount } = opts;

            const isSignIn = !authenticated;

            const isUnlink =
                opts.type !== "web3"
                    ? account?.[opts.type]
                    : account?.[opts?.providerId];

            const { type, ...rest } = opts;

            const { authServices, handleFirebaseAuthErrors } =
                authProviders || (await loadAuthProviders());

            const { signIn, link, providerId } = authServices[type];

            if (isUnlink) {
                // const response = await authHandleUnlink({
                //     providerId:
                //         opts.type === "web3" ? opts.providerId : providerId,
                //     type,
                // });
                // if (response.success) {
                //     setAccount(response.account as any as Account);
                //     return;
                // }
                // return;
            }

            let credentials;

            try {
                // credentials = isSignIn
                //     ? // @ts-ignore
                //       await signIn(rest)
                //     : // @ts-ignore
                //       await link(rest);
                // @ts-ignore
                credentials = await signIn(rest);
            } catch (error) {
                handleFirebaseAuthErrors(error);
            }

            // ignore when type is web3 and link (we already link the web3 account in the api route)
            if (!credentials) {
                throw new Error("Failed to get user credentials");
            }

            let accountData: any = {};

            if (opts.type !== "web3") {
                accountData = {
                    accountId: credentials.user.uid,
                    sig: {
                        type: "web2",
                        sig: await credentials.user.getIdToken(),
                    },
                    connection: {
                        type: "web2",
                    },
                };
            } else {
                accountData = {
                    accountId: credentials.payload.accountId,
                    sig: credentials.payload.sig,
                    connection: credentials.payload.connection,
                };
            }

            const authPayload: AuthPayload = {
                owner: accountData.accountId,
                sig: accountData.sig,
                type: opts.type === "web3" ? "web3" : "web2",
                providerId: credentials.providerId,
                userMetadata: {
                    photoURL: credentials?.user?.photoURL || "",
                    displayName: credentials?.user?.displayName || "",
                    twitterHandle:
                        credentials?.user?.reloadUserInfo?.screenName || "",
                    email: credentials?.user?.email || "",
                },
                linkAccount: opts.islinking ? authenticationState.user?.id : "",
            };

            const response = await AccountsApi.opts({
                // checksum: true, // leads to an error in some cases
                encode: true,
            }).authenticate(authPayload);

            if (!response.success) {
                amplitude_logAnalyticsEvent(eventName + "_failed", {
                    type: opts.type,
                    error: response.message,
                    cause: response.type || "generic",
                });

                return {
                    success: false,
                    message: response.message,
                    type: response.type,
                    authPayload: response?.account || authPayload,
                    mergePayload: authPayload,
                };
            }

            const { connection } = accountData;

            const { token, success, user } = response;

            if (eventName === "account_auth") {
                amplitude_setUserId(user.id);
                if (authPayload.userMetadata?.email) {
                    amplitude_setIndetity(
                        "email",
                        authPayload.userMetadata.email
                    );
                }
                if (authPayload.userMetadata?.displayName) {
                    amplitude_setIndetity(
                        "name",
                        authPayload.userMetadata.displayName
                    );
                }
                if (user.username) {
                    amplitude_setIndetity("username", user.username);
                }
            }

            if (!skipRedirectToAccount) document.cookie = cca_cookie(user.id);

            let accounts = getLocalAccounts();

            localStorage.setItem(
                "accounts",
                JSON.stringify({
                    [user.id.toLowerCase()]: {
                        // IMPORTANT: DO_NOT_LOWERCASE_OR_YOU_WILL_BE_FIRED
                        walletId: user.id,
                        type: connection.type,
                        username: user?.username,
                    },
                    ...accounts,
                })
            );

            const payload: Partial<UserContextState> = {
                token,
                isAutograph,
                walletConnection: connection,
                accounts: {
                    ...accounts,
                    [user.id.toLowerCase()]: {
                        walletId: user.id.toLowerCase(),
                        type: connection.type,
                    },
                },
            };

            if (!skipRedirectToAccount)
                payload.currentAccount = user.id.toLowerCase();

            if (success) {
                dispatch({
                    type: USER_LOGIN,
                    payload: !skipRedirectToAccount
                        ? payload
                        : { accounts: payload.accounts },
                });

                const linkedAccount = response.user.linkedAccounts.find(
                    (a: any) => a.accountId === accountData.accountId
                );

                amplitude_logAnalyticsEvent(eventName + "_success", {
                    linkedAccounts: response.user.linkedAccounts.map(
                        (a: any) => a.accountId
                    ),
                    ...linkedAccount,
                });

                if (response.isNew) {
                    amplitude_logAnalyticsEvent("user_signed_up", {
                        auth_type: opts.type,
                        provider_id: credentials.providerId,
                    });
                }

                return {
                    success: true,
                    token,
                    accountId: user.id,
                    user,
                };
            } else {
                amplitude_logAnalyticsEvent(eventName + "_failed", {
                    type: opts.type,
                    error: "Failed to authenticate. Please Retry.",
                    cause: response.type || "generic",
                });

                return {
                    success: false,
                    message: "Failed to authenticate. Please Retry.",
                };
            }
        } catch (error) {
            console.log("[authHandler err]", error.message);
            console.log("[authHandler err]", error.cause);

            amplitude_logAnalyticsEvent(eventName + "_failed", {
                type: opts.type,
                error: error.message,
                cause: error.cause || "generic",
            });

            setAuthError(error.message);

            // Still a failure for every caller; only the wording is decided
            // here, from the error's code (features/auth/signInErrors).
            const failure = describeSignInError(error);

            return {
                success: false,
                message: failure.message,
                type: error.cause || "",
                code: failure.code,
                cancelled: failure.cancelled,
                canRetry: failure.canRetry,
            };
        } finally {
            // Make sure this is a one time usage nonce
            cookie.serialize("nonce", "", {
                expires: new Date(1970, 1, 1),
                path: "/",
            });
        }
    }

    const handleCreateExhibit = () => {
        dispatch({
            type: HANDLE_CREATE_EXHIBIT,
        });
    };

    const toggleTipsDesktop = (enableTipsDesktop: boolean) => {
        localStorage.setItem("show_tips_desktop", enableTipsDesktop.toString());

        dispatch({
            type: ENABLE_TIPS_DESKTOP,
            payload: {
                enableTipsDesktop,
            },
        });
    };

    const value = {
        ...authenticationState,
        isSignedIn: selectIsSignedIn(authenticationState),
        dispatch,
        // createNewAccountAndLogin,
        handleCreateExhibit,
        simple_authenticate,
        logout,
        changeAccount,
        addNewAccount,
        toggleTipsDesktop,
        invite,
        providersState,
        authHandler,
        isAnonInitialized: isAnonInitialized && hydratedSeed === routeSeed,
        logoutAccount,
        defaultWallet,
        linkedWallets,
    };

    return (
        <UserContext.Provider value={value}>
            {children}
            {sessionLoadFailed ? (
                <SessionLoadError
                    onRetry={() => setSessionLoadAttempt((count) => count + 1)}
                />
            ) : null}
        </UserContext.Provider>
    );
};
