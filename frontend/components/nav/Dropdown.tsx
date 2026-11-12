import Link from "next/link";
import { noop } from "lodash";
import { Theme } from "@ui/types";
import Icon from "@components/Icon";
import ChevronDown from "@ui/icons/ChevronDown";
import styled, { css } from "styled-components";
import { actionSpec, blueAction, pillAction } from "@styles/brand";
import { baseTokens } from "@styles/tokens";
import useModal from "@components/modals/useModal";
import { UserContext } from "@context/UserContext";
import ConnectWallet from "@ui/components/ConnectWallet";
import useOuterClick from "@components/hooks/useOuterClick";
import { useContext, useState, CSSProperties } from "react";
import { RoundButton } from "@components/DesignSystem/buttons";
import { useCyberTheme } from "@components/context/ThemeProvider";
import { useGatingError } from "@components/context/GatingErrorContext";
import dynamic from "next/dynamic";
import { useCyberTranslation } from "@components/context/I18nContext";
import { classes } from "@utils/js";
import ReactDOM from "react-dom";
import AccountDashboard from "@components/modals/AccountDashboard";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { showModal } from "@components/Dialogs";
import Wallets from "./Wallets";
import Img from "@components/Img";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";

const ConnectModal = dynamic(() => import("@ui/components/ConnectWallet"));

const HelpModal = dynamic(() => import("@components/_3DExhibit-v2/ui/Help"));

type DropdownProps = {
    onLogin?: Function;
    isMenuOpen?: boolean;
    hideLabel?: boolean;
    hideChevronDown?: boolean;
    style?: CSSProperties;
    overrideTheme?: Theme;
    isCreatePage?: boolean;
    onlyEthereum?: boolean;
    entryDropdown?: boolean;
};

export default function Dropdown({
    style = {},
    isMenuOpen,
    overrideTheme,
    hideLabel = false,
    hideChevronDown = false,
    onLogin = null,
    isCreatePage = null,
    onlyEthereum = false,
    entryDropdown,
}: DropdownProps) {
    const {
        user,
        logout,
        accounts,
        userData,
        changeAccount,
        authenticated = false,
    } = useContext(UserContext);

    const { isLightTheme, setLightMode } = useCyberTheme();

    const theme = overrideTheme || isLightTheme ? "light" : "dark";

    const { isShowing: editProfile, toggle: setEditProfile } = useModal();

    const { gatingError } = useGatingError();

    const requiresLogin =
        !authenticated &&
        (gatingError === "no-anonymous-error" ||
            gatingError === "whitelist-error" ||
            gatingError === "nft-owner-error");

    const [walletsExtended, setWalletsExtended] = useState(true);

    const { t } = useCyberTranslation();

    // ! why is this state not within the Profile component?
    const [showDropdown, setShowDropdown] = useState(false);

    const [helpIsShowing, toggleHelp] = useState(false);

    const [isCopying, setCopying] = useState<string>("");

    const { toggle: toggleAuth, isShowing: isAuthShowing } = useModal();

    const innerRef = useOuterClick(
        (ev) => !editProfile && !isAuthShowing && setShowDropdown(false)
    );

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopying(text);

        setTimeout(() => {
            setCopying("");
        }, 1000);
    };

    function handleOpenDashboardSettings() {
        amplitude_logAnalyticsEvent("account_settings_opened");
        showModal(<AccountDashboard />);
    }

    if (authenticated) {
        return (
            <Settings
                style={style}
                ref={innerRef}
                userId={user?.id}
                isMenuOpen={isMenuOpen}
                data-cy="navbar-dropdown"
                className="users-dropdown"
                overrideTheme={overrideTheme}
                entryDropdown={entryDropdown}
            >
                {isAuthShowing ? (
                    <ConnectWallet
                        toggle={toggleAuth}
                        open={isAuthShowing}
                        callbackAfterAuth={noop}
                        onlyEthereum={onlyEthereum}
                        skipRedirectToAccount={true}
                    />
                ) : null}

                {helpIsShowing ? (
                    <HelpModal isShowing={helpIsShowing} toggle={toggleHelp} />
                ) : null}

                <Collapsed onClick={() => setShowDropdown(!showDropdown)}>
                    <AvatarImg
                        className="dropdown-avatar"
                        entryDropdown={entryDropdown}
                        style={{ marginLeft: 0 }}
                    >
                        <Img
                            src={userData?.avatar || "/images/avatar.png"}
                            fallbackImg={DEFAULT_PLAYER_AVATAR_PICTURE}
                        />
                    </AvatarImg>
                    {!hideLabel && (
                        <div className="hideMobile">
                            <p
                                style={{ marginBottom: 4 }}
                                className="dropdown-username"
                            >
                                @{userData?.username || "Anonymous"}{" "}
                            </p>
                            <span className="dropdown-wallet-address">
                                {user?.id.slice(0, 14)}...
                            </span>
                        </div>
                    )}
                    {!hideChevronDown && (
                        <span
                            style={{ marginLeft: 12, display: "inline-block" }}
                        >
                            <ChevronDown
                                strokeColor={
                                    overrideTheme == "light" || isLightTheme
                                        ? "#cdcdcd"
                                        : "#f7f7f7"
                                }
                                width="12px"
                            />
                        </span>
                    )}
                </Collapsed>
                {showDropdown && (
                    <DropdownMenu
                        overrideTheme={overrideTheme}
                        className="dropdown-menu"
                    >
                        <CurrentWallet>
                            <div className="dropdown main">
                                <Link
                                    href={
                                        userData?.username &&
                                        userData?.username !== "anon"
                                            ? `/@${userData?.username}`
                                            : `/@${userData?.walletId}`
                                    }
                                    legacyBehavior
                                >
                                    <p className="cur-pointer">
                                        @{userData?.username || "anon"}{" "}
                                    </p>
                                </Link>
                                <span
                                    className={classes({
                                        "cur-pointer": !isCopying,
                                    })}
                                    onClick={(e) => copyToClipboard(user?.id)}
                                >
                                    {user?.id.slice(0, 12)}
                                </span>
                            </div>
                            <span
                                className={classes({
                                    "cur-pointer": !isCopying,
                                })}
                                onClick={(e) => copyToClipboard(user?.id)}
                            >
                                {isCopying ? t`COPIED` : t`COPY`}
                            </span>
                        </CurrentWallet>

                        <Wallets />

                        <RoundButton onClick={toggleAuth}>
                            {t`ADD_ANOTHER_WALLET`}
                        </RoundButton>

                        <ExtraAction>
                            <Link href="/destinations">
                                <p>My destinations</p>
                            </Link>
                        </ExtraAction>

                        <ExtraAction>
                            <p
                                onClick={handleOpenDashboardSettings}
                            >{t`EDIT_PROFILE`}</p>
                        </ExtraAction>

                        {/* <ExtraAction>
                            <p onClick={() => setLightMode(!isLightTheme)}>
                                {isLightTheme ? "Dark" : "Light"} Mode
                            </p>
                        </ExtraAction> */}

                        {/* Later manage wallets */}
                        <ExtraAction style={{ padding: "4px 0" }}>
                            <p onClick={logout}>{t`DISCONNECT`}</p>
                        </ExtraAction>
                    </DropdownMenu>
                )}
            </Settings>
        );
    }

    return isCreatePage ? (
        <span style={{ height: "41px" }}></span>
    ) : (
        <>
            {/* Make sure user is logged in after and if no profile we can pop up the edit account settings with setEditProfile(true) */}
            {isAuthShowing ? (
                <ConnectWallet
                    toggle={toggleAuth}
                    onlyEthereum={onlyEthereum}
                    open={isAuthShowing}
                    callbackAfterAuth={(
                        token,
                        account,
                        connection,
                        { userData, exhibit }
                    ) => {
                        if (!userData.username) {
                            handleOpenDashboardSettings();
                        }
                        if (onLogin) {
                            onLogin(userData, account, token);
                        }
                    }}
                    skipRedirectToAccount={false}
                />
            ) : null}
            <Settings
                isMenuOpen={isMenuOpen}
                isButton={true}
                onClick={() => {
                    onLogin && toggleAuth();
                }}
                overrideTheme={overrideTheme}
                higlight={gatingError != null}
                animate={requiresLogin}
            >
                {onLogin ? (
                    <div
                        className="link"
                        style={{ textTransform: "uppercase" }}
                    >{t`CONNECT_WALLET`}</div>
                ) : (
                    <Link
                        href="/studio"
                        style={{ textTransform: "uppercase" }}
                    >{t`CONNECT_WALLET`}</Link>
                )}
            </Settings>
        </>
    );
}

const Settings = styled.div<{
    userId?: string;
    mobile?: boolean;
    animate?: boolean;
    isButton?: boolean;
    higlight?: boolean;
    isMenuOpen?: boolean;
    overrideTheme?: Theme;
    entryDropdown?: boolean;
}>`
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
    appearance: none;
    border: none;
    position: relative;
    // width: ${({ userId }) => (userId ? 175 : 150)}px;
    height: 41px;
    padding: 0 2px 0 6px;
    border-radius: 40px;
    text-align: center;
    padding: 0;
    // cursor: pointer;
    transition: 0.2s;
    white-space: nowrap;

    ${({ theme, isMenuOpen, overrideTheme }) => {
        if (typeof isMenuOpen === "undefined" || isMenuOpen) {
            return css`
                --color: ${(overrideTheme ? overrideTheme : theme.type) ===
                "light"
                    ? "#070707"
                    : "#fff"};
                --background-color: ${(overrideTheme
                    ? overrideTheme
                    : theme.type) === "light"
                    ? "rgba(255, 255, 255, 1)"
                    : "rgba(0, 0, 0, 1)"};
                --border-color: ${(overrideTheme
                    ? overrideTheme
                    : theme.type) === "light"
                    ? "rgba(7,7,7,0.1)"
                    : "rgba(255, 255, 255, 0.1)"};
                --dropdown-background-color: ${(overrideTheme
                    ? overrideTheme
                    : theme.type) === "light"
                    ? "#FFFFFF"
                    : "#131313"};

                --avatar-border-color: ${(overrideTheme
                    ? overrideTheme
                    : theme.type) === "light"
                    ? "rgba(0, 0, 0, 0.3);"
                    : "rgba(255, 255, 255, 0.3)"};

                --icon-color: ${({ theme }) =>
                    (overrideTheme ? overrideTheme : theme.type) === "light"
                        ? "invert(1)"
                        : "invert(0)"};

                @media (max-width: 830px) {
                    --avatar-border-color: ${(overrideTheme
                        ? overrideTheme
                        : theme.type) === "light"
                        ? "rgba(0, 0, 0, 0.3);"
                        : "rgba(255, 255, 255, 0.3)"};
                }
            `;
        } else {
            // dark
            return css`
                --color: "#fff";
                --background-color: rgba(0, 0, 0, 0.3);
                --border-color: rgba(255, 255, 255, 0.1);
                --dropdown-background-color: #131313;
                --icon-color: invert(0);
                --avatar-border-color: rgba(255, 255, 255, 0.3);
            `;
        }
    }}

    ${({ isButton, higlight, entryDropdown }) =>
        isButton
            ? css`
                  /* Connect wallet signs the visitor in: the blue action. */
                  ${actionSpec}
                  ${pillAction}
                  ${higlight
                      ? css`
                            background: #fff;
                        `
                      : blueAction}
                  cursor: pointer;

                  a,
                  .link {
                      color: ${higlight ? "#070707" : baseTokens.color.white};
                  }
                  && > a,
                  && .link {
                      font: inherit;
                  }
              `
            : css`
                  color: var(--color);

                  @media (max-width: 550px) {
                      //   width: 80px !important;
                  }
              `};

    :focus {
        outline: none;
    }

    a,
    .link {
        width: 100%;
        padding: 4px 0;
    }

    @media (max-width: 1150px) {
        height: 40px;
        // width: ${({ userId }) => (userId ? 160 : 140)}px;
    }

    @media (max-width: 800px) {
        height: 40px;
        // width: ${({ userId }) => (userId ? 170 : 140)}px;
    }

    border-radius: 30px;
    position: relative;
    // cursor: pointer;
    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Firefox */
    -ms-user-select: none; /* Internet Explorer/Edge */
    user-select: none;

    & > a,
    .link {
        font-size: 11px;
        font-weight: 500;
    }

    animation: ${(props) => (props.animate ? "blink 4s linear 5" : "none")};

    @keyframes blink {
        from,
        50%,
        to {
            opacity: 1;
        }

        25%,
        75% {
            opacity: 0;
        }
    }
`;

const CurrentWallet = styled.div`
    padding: 8px 8px 16px 8px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 8px;

    .main {
        display: flex;
        flex-direction: column;
        align-items: start;

        p,
        a,
        .link {
            margin: 0;
            margin-bottom: 4px;
            font-size: 15px;
            font-weight: 400;
        }
    }
    span {
        opacity: 0.4;
        font-size: 11px;
        transition: 0.2s;

        &:hover {
            opacity: 1;
        }
    }
`;

const AvatarImg = styled.div<{
    entryDropdown?: boolean;
}>`
    height: 40px;
    width: 40px;
    border: 1px solid var(--avatar-border-color);
    border-radius: 100%;

    padding: 6px;

    ${({ entryDropdown }) =>
        entryDropdown &&
        css`
            border: none;
            padding: 0;
            height: 35px;
            width: 35px;
        `}

    & > img {
        height: 100%;
        border-radius: 100%;
        object-fit: cover;
        width: 100%;
    }
`;

const Collapsed = styled.div`
    display: flex;
    align-items: center;
    padding: 0 5px 0 0;
    border-radius: 30px;
    width: 100%;
    overflow: hidden;
    font-size: 13px;
    cursor: pointer;

    & > div {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        margin-left: 5px;

        & > p {
            margin: 0;
            max-width: 11ch;
            overflow: hidden;
            font-size: 13px;
            text-overflow: ellipsis;
            text-align: left;
            width: 100%;
            font-weight: 500;

            @media (max-width: 800px) {
                max-width: 12ch;
            }
        }

        & > span {
            font-size: 0.7em;
            max-width: 12ch;
            text-overflow: ellipsis;
            opacity: 0.5;
        }
    }

    & > span {
        font-size: 18px;
    }

    @media (max-width: 550px) {
        .hideMobile {
            display: none;
        }
    }
`;

const DropdownMenu = styled.div<{ overrideTheme: Theme }>`
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 53px;
    padding: 8px;
    right: 0;
    // width: 130%;
    min-width: 200px;
    border-radius: 4px;
    z-index: 3000;
    max-height: 60vh;
    overflow: auto;
    letter-spacing: -0.03em;
    box-shadow: 0px 4px 40px rgba(0, 0, 0, 0.25);
    color: var(--color);
    background: var(--dropdown-background-color);

    ${({ theme, overrideTheme }) => {
        return css`
            --color: ${(overrideTheme ? overrideTheme : theme.type) === "light"
                ? "#070707"
                : "#fff"};
            --background-color: ${(overrideTheme
                ? overrideTheme
                : theme.type) === "light"
                ? "rgba(255, 255, 255, 0.3)"
                : "rgba(0, 0, 0, 0.3)"};
            --border-color: ${(overrideTheme ? overrideTheme : theme.type) ===
            "light"
                ? "rgba(7,7,7,0.1)"
                : "rgba(255, 255, 255, 0.1)"};
            --dropdown-background-color: ${(overrideTheme
                ? overrideTheme
                : theme.type) === "light"
                ? "#FFFFFF"
                : "#131313"};
        `;
    }}

    button {
        border: 1px solid var(--color);
        backdrop-filter: blur(28.8889px);
        font-size: 12px;
        color: var(--color);
        background: transparent;
        padding: 0px;
        height: 30px;
        margin: 8px 0;
        font-weight: 500;
        line-height: 36px;
        text-transform: uppercase;
        transition: 0.2s;

        &:hover {
            opacity: 0.4;
        }
    }

    & > div .walletsTitle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 8px 0;
        padding: 0 8px;

        p {
            text-align: left;
            font-size: 15px;
            margin: 0;
        }
    }

    @media (max-width: 550px) {
        left: -121px;
    }
`;

const ExtraAction = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    transition: 0.2s;

    &:hover {
        opacity: 0.4;
        img {
            opacity: 1;
        }

        & > p {
            color: var(--color);
        }
    }

    &:last-child {
        border-top: 1px solid var(--border-color);
        margin-top: 8;
        padding-top: 8;
    }

    img {
        width: 12px;
        filter: invert(1);
        opacity: 0.8;
    }

    & > p,
    & > a,
    & > .link {
        margin: 0;
        text-align: left;
        margin-left: 8px;
        cursor: pointer;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 15px;
        padding: 8px 0;
        text-align: left;
        font-weight: 400;
        letter-spacing: -0.03em;
    }
`;
