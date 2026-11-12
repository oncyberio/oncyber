import { useHome } from "@components/context/HomeContext";
import { UserContext } from "@components/context/UserContext";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import useModal from "@components/modals/useModal";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/factory/player/constants";
import Avatar from "@ui/components/Avatar";
import { Divider } from "@ui/components/Divider";
import IconImg from "@ui/components/IconImg";
import ChevronDown from "@ui/components/Icons/ChevronDown";
import Cyber from "@ui/components/Icons/Cyber";
import { NButton } from "@ui/components/NButton";
import { GradientButton } from "@ui/components/NButton/GradientButton";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import Link from "next/link";
import { useRouter } from "next/router";
import { useContext, useState } from "react";
import styled from "styled-components";
import {
    Container,
    LinksContainer,
    LinksWrapper,
    MaxWrapper,
} from "../../shared";
import UserDropdown from "../../UserDropdown";
import { useCyberTranslation } from "@components/context/I18nContext";

export default function DesktopMenu() {
    //
    const { user, userData } = useContext(UserContext);

    const router = useRouter();

    const { t } = useCyberTranslation();

    const { toggleAuth, isAuthShowing, hasBorder } = useHome();

    const [isDropdownOpened, toggleDropdown] = useState(false);

    const { toggle: toggleDropdownAuth, isShowing: isDropdownAuthShowing } =
        useModal();

    const { clickRef, addTogglerRef } = useOnClickOutside({
        handler: () => {
            if (!isDropdownAuthShowing) {
                toggleDropdown(false);
            }
        },
    });

    const path = router.asPath;

    return (
        <Container hasBorder={hasBorder} className="desktop">
            <MaxWrapper>
                <LinksContainer>
                    <Link href="/" legacyBehavior>
                        <Cyber style={{ cursor: "pointer" }} size={42} />
                    </Link>

                    <DesktopSection>
                        <Divider
                            style={{
                                height: 32,
                                margin: "0 32px",
                                background:
                                    "var(--home_navigation-separator-color)",
                            }}
                            direction="vertical"
                        />

                        <LinksWrapper>
                           
                            <p
                                style={
                                    router.pathname !== "/"
                                    ? {
                                          color: "var(--home_navigation-secondary-color)",
                                      }
                                    : {}
                                }
                            >
                                <Link href="/">Explore</Link>
                            </p>
                        

                            {path === "/templates" ? 
                                <p>
                                    <Link href="/templates">Templates</Link>
                                </p> : 
                                <p
                                style={
                                    router.pathname !== "/marketplace"
                                        ? {
                                              color: "var(--home_navigation-secondary-color)",
                                          }
                                        : {}
                                }
                            >
                                <Link href="/templates">Templates</Link>
                            </p> }

                            {/* <p
                                style={{
                                    color: "var(--home_navigation-secondary-color)",
                                }}
                            >
                                <a
                                    href="/docs"
                                    target="_blank"
                                >
                                    About
                                </a>
                            </p> */}
                        </LinksWrapper>
                    </DesktopSection>
                </LinksContainer>

                <DesktopSection>
                    {/* <IconButtonWrapper style={{ cursor: "pointer" }}>
                        <IconImg name="bell" size={21} mode="dark" />
                    </IconButtonWrapper> */}

                    {user.id ? (
                        <>
                            <GradientButton
                                spanStyle={{ padding: "10px 24px" }}
                                onClick={() => {
                                    amplitude_logAnalyticsEvent(
                                        "clicked_3Dstudio_nav_button"
                                    );
                                }}
                            >
                                <a href="/studio">Create</a>
                            </GradientButton>
                            <div style={{ position: "relative" }}>
                                <AvatarWrapper
                                    ref={(el) => addTogglerRef("to", el)}
                                    onClick={() =>
                                        toggleDropdown((state) => !state)
                                    }
                                >
                                    <Avatar
                                        src={
                                            userData?.avatar ||
                                            DEFAULT_PLAYER_AVATAR_PICTURE
                                        }
                                        size={"medium"}
                                        style={{
                                            cursor: "pointer",
                                        }}
                                    />
                                    <ChevronDown size={18} />
                                </AvatarWrapper>
                                {isDropdownOpened ? (
                                    <UserDropdown
                                        toggleDropdownAuth={toggleDropdownAuth}
                                        isDropdownAuthShowing={
                                            isDropdownAuthShowing
                                        }
                                        clickRef={clickRef}
                                    />
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <ConnectAction onClick={toggleAuth}>
                            <span style={{ fontSize: "0.8em" }}>◯</span>
                            {t`LOG_IN`}
                        </ConnectAction>
                    )}
                </DesktopSection>
            </MaxWrapper>
        </Container>
    );
}

const DesktopSection = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 16px;

    p {
        font-weight: 500;
    }

    @media (max-width: 780px) {
        display: none;
    }
`;

const AvatarWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    position: relative;

    path {
        stroke: var(--home_navigation-main-color);
    }
`;

const ConnectAction = styled.div`
    color: var(--home_navigation-main-color);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;

    & > span {
        font-size: 0.8em;
        margin-top: 0.1em;
    }

    &:hover {
        opacity: 0.3;
    }
`;
