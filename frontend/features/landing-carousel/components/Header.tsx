import {
    ReactNode,
    useContext,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";
import Link from "@components/InAppLink";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
import CyberloopMark from "./CyberloopMark";
import AccountSidebar from "./AccountSidebar";
import ProfilePortrait from "@ui/components/ProfilePortrait";
import { blueAction, compactActionSizing } from "@styles/brand";
import { showError, showModal } from "@components/Dialogs";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

const ConnectModal = dynamic(() => import("@ui/components/ConnectWallet"), {
    ssr: false,
});

const FriendsPanel = dynamic(() => import("@features/social/FriendsPanel"), { ssr: false });

const AccountDashboard = dynamic(
    () => import("@components/modals/AccountDashboard"),
    { ssr: false }
);

export default function Header({
    menu,
    search,
    immersive = false,
    onHome,
    onConnected,
    authRequest = 0,
}: {
    menu: ReactNode;
    search: ReactNode;
    immersive?: boolean;
    onHome?: () => void;
    onConnected?: (
        userData: any,
        account: string,
        token: string
    ) => void | Promise<void>;
    /** Bump to open the sign-in modal from elsewhere (the / command menu). */
    authRequest?: number;
}) {
    const { user, userData, authenticated, isAnonymous, logout } =
        useContext(UserContext);
    const username = userData?.username?.replace(/^@/, "");
    const accountName = username ? `@${username}` : "My account";
    const wallet = userData?.walletId || user?.id || "";
    const accountDetail =
        userData?.walletCustomName ||
        (userData?.type === "web2"
            ? "My spaces"
            : wallet.length > 18
            ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
            : wallet);
    const [authOpen, setAuthOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [friendsOpen, setFriendsOpen] = useState(false);
    const accountButton = useRef<HTMLButtonElement>(null);
    const openingFocus = useRef<"first" | "last">("first");
    const accountMenuId = useId();
    const accountButtonId = `${accountMenuId}-trigger`;
    const signedIn = !!(user?.id && authenticated && !isAnonymous);
    const profileHref = `/@${encodeURIComponent(username || user?.id || "")}`;

    function closeAccountMenu() {
        setAccountOpen(false);
        accountButton.current?.focus();
    }

    useEffect(() => {
        setAccountOpen(false);
        setFriendsOpen(false);
    }, [user?.id, signedIn]);

    useEffect(() => {
        if (authRequest > 0 && !signedIn) setAuthOpen(true);
    }, [authRequest]);

    function editProfile(defaultStep: "account" | "connections" = "account") {
        amplitude_logAnalyticsEvent("account_settings_opened");
        void showModal(<AccountDashboard defaultStep={defaultStep} />);
    }

    async function signOut() {
        closeAccountMenu();
        try {
            await logout();
        } catch {
            showError("Please try again.", "Could not sign out");
        }
    }
    return (
        <>
            <Container data-immersive={immersive || undefined}>
                <div className="browse-menu">{!immersive && menu}</div>
                <Link
                    href="/"
                    className="brand"
                    aria-label="Oncyber home"
                    onClick={
                        onHome
                            ? (event) => {
                                  event.preventDefault();
                                  onHome();
                              }
                            : undefined
                    }
                >
                    <CyberloopMark scrollLinked />
                    <img
                        className="wordmark"
                        src="/brand/oncyber-wordmark-white.png"
                        alt="Oncyber"
                    />
                </Link>
                <div className="account-actions">
                    {!immersive && search}
                    {signedIn ? (
                        <div className="account-menu">
                            <button
                                type="button"
                                ref={accountButton}
                                id={accountButtonId}
                                className="account-profile"
                                aria-label={`${accountName} — Account menu`}
                                aria-haspopup="dialog"
                                aria-expanded={accountOpen}
                                aria-controls={accountMenuId}
                                onClick={() => {
                                    openingFocus.current = "first";
                                    setAccountOpen(!accountOpen);
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "ArrowDown" ||
                                        event.key === "ArrowUp"
                                    ) {
                                        event.preventDefault();
                                        openingFocus.current =
                                            event.key === "ArrowUp"
                                                ? "last"
                                                : "first";
                                        setAccountOpen(true);
                                    }
                                }}
                            >
                                <span className="account-copy">
                                    <span className="account-name">
                                        {accountName}
                                    </span>
                                    <span className="account-detail">
                                        {accountDetail}
                                    </span>
                                </span>
                                <ProfilePortrait
                                    className="account-avatar"
                                    src={userData?.avatar}
                                />
                            </button>
                        </div>
                    ) : (
                        <button
                            className="sign-in"
                            onClick={() => setAuthOpen(true)}
                        >
                            <span>
                                Sign in <span aria-hidden="true">→</span>
                            </span>
                        </button>
                    )}
                </div>
            </Container>
            {signedIn && accountOpen && (
                <AccountSidebar
                    id={accountMenuId}
                    name={accountName}
                    detail={accountDetail}
                    photo={userData?.avatar}
                    profileHref={profileHref}
                    initialFocus={openingFocus.current}
                    onClose={() => setAccountOpen(false)}
                    onEditProfile={() => editProfile()}
                    onConnections={() => editProfile("connections")}
                    onFriends={() => setFriendsOpen(true)}
                    onSignOut={signOut}
                />
            )}
            {signedIn && friendsOpen && (
                <FriendsPanel
                    key={user.id}
                    onClose={() => setFriendsOpen(false)}
                />
            )}
            {authOpen && (
                <ConnectModal
                    open={authOpen}
                    toggle={() => setAuthOpen(false)}
                    noShowClose={false}
                    fullScreenMobile={false}
                    skipRedirectToAccount={!!onConnected}
                    callbackAfterAuth={
                        onConnected
                            ? (token, account, _connection, { userData }) =>
                                  onConnected(userData, account, token)
                            : undefined
                    }
                />
            )}
        </>
    );
}

const Container = styled.header`
    position: relative;
    z-index: 5;
    height: var(--landing-header-height, 106px);
    flex-shrink: 0;
    margin: 0 7%;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    .browse-menu {
        justify-self: start;
        min-width: 0;
    }
    .brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }
    .brand > img {
        width: 34px;
        height: 34px;
    }
    .brand > .wordmark {
        width: 108px;
        height: auto;
    }
    .account-actions {
        display: flex;
        align-items: center;
        justify-self: end;
        gap: 24px;
    }
    .account-actions > button,
    .account-actions > a {
        color: var(--oc-secondary);
        font-size: 14px;
        padding: 10px 0;
        background: none;
        border: 0;
        cursor: pointer;
        white-space: nowrap;
    }
    .account-actions > button:hover,
    .account-actions > a:hover {
        color: var(--oc-ink);
    }
    .account-menu {
        position: relative;
    }
    .account-profile {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0;
        min-width: 0;
        color: var(--oc-ink);
        background: none;
        border: 0;
        border-radius: var(--oc-radius-control);
        cursor: pointer;
    }
    .account-profile:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 5px;
    }
    .account-copy {
        display: flex;
        flex-direction: column;
        gap: 3px;
        text-align: right;
        min-width: 0;
        max-width: min(14vw, 180px);
    }
    .account-name,
    .account-detail {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .account-name {
        font-size: 14px;
        line-height: 1.35;
    }
    .account-detail {
        font: 12px/1.35 var(--oc-mono);
        color: var(--oc-muted);
    }
    .account-avatar {
        display: block;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 50%;
    }
    .account-actions > .sign-in {
        ${compactActionSizing}
        ${blueAction}
        border: 0;
    }
    .sign-in svg {
        flex-shrink: 0;
    }
    @media (max-width: 700px) {
        height: var(--landing-header-height, 86px);
        margin: 0 20px;
        .brand > img {
            width: 30px;
            height: 30px;
        }
        .brand > .wordmark {
            display: none;
        }
        .brand > .cyberloop-mark {
            width: 44px;
            height: 44px;
        }
        .account-actions {
            gap: 16px;
        }
        .account-copy {
            display: none;
        }
        .account-avatar {
            width: 34px;
            height: 34px;
        }
        .account-actions > button,
        .account-actions > a {
            font-size: 12px;
        }
    }
`;
