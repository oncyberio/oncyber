import Menu from "./menu";
import Link from "next/link";
import { Theme } from "@ui/types";
import ReactDOM from "react-dom";
import Dropdown from "./Dropdown";
import { useRouter } from "next/router";
import styled from "styled-components";
import MenuIcon from "../Icons/MenuIcon";
import useModal from "../modals/useModal";
import CloseIcon from "../Icons/CloseIcon";
import { useContext, useState } from "react";
import HelpModal from "../_3DExhibit-v2/ui/Help";
import { UserContext } from "../context/UserContext";
import { ThemeContext } from "@components/context/ThemeProvider";

export type NavigationProps = {
    minWidth?: string;
    onLogin?: Function;
    overrideTheme?: Theme;
    onlyEthereum?: boolean;
};

export default function Navigation({
    minWidth,
    onLogin = null,
    overrideTheme = null,
    onlyEthereum = false,
}: NavigationProps) {
    const {
        authenticated = false,
        userData,
        isNavHidden,
    } = useContext(UserContext);

    const { isLightTheme, setLightMode } = useContext(ThemeContext);

    const router = useRouter();

    const [isMenuOpen, setMenuOpen] = useState(false);

    const isExplorePage = router.pathname === "/explore";
    const isCreatePage = router.pathname === "/studio";

    const { isShowing: helpIsShowing, toggle: toggleHelp } = useModal();

    return (
        <>
            <HelpModal isShowing={helpIsShowing} toggle={toggleHelp} />
            <Container
                minWidth={minWidth}
                style={{
                    display: isNavHidden ? "none" : "block",
                    overflow: "inherit",
                }}
                isLight={overrideTheme === "light" || isLightTheme}
                className={!isMenuOpen ? "navigationContainer" : ""}
            >
                <Nav
                    isCreatePage={isCreatePage && !authenticated}
                    className="nav"
                >
                    <BaseButton
                        onClick={() => setMenuOpen((isOpen) => !isOpen)}
                    >
                        {isMenuOpen ? (
                            <CloseIcon
                                size={30}
                                color={
                                    overrideTheme === "light" || isLightTheme
                                        ? "#010103"
                                        : "#fff"
                                }
                            />
                        ) : (
                            <MenuIcon
                                size={30}
                                color={
                                    overrideTheme === "light" || isLightTheme
                                        ? "#010103"
                                        : "#fff"
                                }
                            />
                        )}
                    </BaseButton>
                    <div
                        className="logoCenter"
                        style={{ justifyContent: "center" }}
                    >
                        <Link href="/">
                            <img
                                className="invertColor logo"
                                src="/images/logo.png"
                            />
                        </Link>
                    </div>
                    <div
                        style={{
                            justifyContent: "flex-end",
                            alignItems: "center",
                        }}
                    >
                        {authenticated ? (
                            <div className="links">
                                <Link href="/">
                                    <img
                                        className="invertColor"
                                        src="/v2/icons/eye.svg"
                                    />
                                    Feed
                                </Link>
                                <Link href="/studio">
                                    <img
                                        className="invertColor"
                                        src="/v2/icons/box.svg"
                                    />{" "}
                                    World{" "}
                                    <span className="mobileHidden">
                                        &nbsp;Builder
                                    </span>
                                </Link>
                            </div>
                        ) : (
                            <div className="links" style={{ marginTop: "2px" }}>
                                {!isExplorePage && (
                                    <Link href="/">
                                        <img
                                            className="invertColor"
                                            src="/v2/icons/eye.svg"
                                        />
                                        Feed
                                    </Link>
                                )}
                                {/* <LightSwitch
                                    className="invertColor"
                                    onClick={() => setLightMode(!isLightTheme)}
                                    src="/v2/icons/lightmode.svg"
                                    isCreatePage={isCreatePage}
                                /> */}
                            </div>
                        )}
                        <Dropdown
                            onLogin={onLogin}
                            onlyEthereum={onlyEthereum}
                            isCreatePage={isCreatePage}
                            overrideTheme={overrideTheme}
                        />
                    </div>

                    {typeof window !== "undefined" &&
                        isMenuOpen &&
                        ReactDOM.createPortal(
                            <MobileMenu
                                isLight={
                                    overrideTheme === "light" || isLightTheme
                                }
                            >
                                <Menu
                                    userData={userData}
                                    setLightMode={setLightMode}
                                    isLight={
                                        overrideTheme === "light" ||
                                        isLightTheme
                                    }
                                />
                            </MobileMenu>,
                            document.getElementById("__next")
                        )}
                </Nav>
            </Container>
        </>
    );
}

const Container = styled.div<{ isLight: boolean; minWidth: string }>`
    width: 100%;
    overflow: hidden;
    max-width: 1260px;
    margin: 0 auto;
    padding: 8px 32px;
    user-select: none;
    -o-user-select: none;
    -moz-user-select: none;
    -khtml-user-select: none;
    -webkit-user-select: none;
    background: ${({ isLight }) => (isLight ? "#fff" : "#000")};
    color: ${({ isLight }) => (isLight ? "#000" : "#fff")};

    .invertColor {
        filter: ${({ isLight }) =>
            isLight ? "invert(1)" : "invert(0)"} !important;
    }

    @media (max-width: 900px) {
        grid-template-columns: 9fr;
    }

    @media (max-width: 650px) {
        grid-template-columns: 9fr;
    }

    z-index: 2000;

    @media (max-width: 600px) {
        padding: 8px 16px;
        .nav {
            display: grid;
            justify-content: center;
            grid-template-columns: 1fr 1fr 9fr;
        }
        .mobileHidden {
            display: none;
        }
    }
`;

const MobileMenu = styled.div<{ isLight: boolean }>`
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(100vh - 57px);
    z-index: 2550;
    background: ${({ isLight }) => (isLight ? "#fff" : "#000")};
    width: 100%;
    max-width: 1260px;
    padding: 0 32px;
    margin: 0 auto;
    display: flex;

    @media (max-width: 550px) {
        padding: 0 16px;
    }
`;

const BaseButton = styled.div`
    border: none;
    background: none;
    padding: 2px 0px;
    border-radius: 3px;
    cursor: pointer;
    :focus {
        outline: none;
    }
`;

const Nav = styled.header<{ isCreatePage: boolean }>`
    width: 100%;
    max-width: 1720px;
    display: grid;
    padding-bottom: 24px;
    padding: 8px 0;
    position: relative;
    grid-template-columns: 2fr 1fr 2fr;
    align-items: center;
    justify-content: center;

    & > div {
        display: flex;
    }

    .logo {
        width: 45px;
        margin: 0 auto;
    }

    .links {
        display: flex;

        a {
            margin-right: 16px;
            font-size: 14px;
            display: flex;
            align-items: center;

            img {
                margin-right: 4px;
                margin-top: 2px;
                width: 14px;
            }

            transition: 0.2s;

            &:hover {
                opacity: 0.5;
            }
        }

        @media (max-width: 900px) {
            .create {
                display: none;
            }
        }

        @media (max-width: 800px) {
            display: ${({ isCreatePage }) => (isCreatePage ? "flex" : "none")};
        }
    }

    & > a {
        font-size: 16px;
        cursor: pointer;
        color: inherit;
        text-align: right;
    }

    @media (orientation: landscape) and (hover: none) and (pointer: coarse) {
        padding: 0 0;
    }

    @media (max-width: 600px) {
        padding: 8px 0;

        .logo {
            margin: 0;
            margin-left: 12px;
        }

        & > div:nth-child(2) {
            justify-content: flex-end !important;
        }

        /* img {
            display: none;
        }

        img.logo {
            display: flex;
        } */

        grid-template-columns: 1fr 1fr;
    }
`;

type LighSwitchProps = {
    isCreatePage?: boolean;
};

const LightSwitch = styled.img<LighSwitchProps>`
    margin-right: ${({ isCreatePage }) => !isCreatePage && "16px"};
    width: 20px;
    cursor: pointer;

    &:hover {
        opacity: 0.8;
    }
`;
