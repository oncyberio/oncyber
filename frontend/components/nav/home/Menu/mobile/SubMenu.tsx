import { useHome } from "@components/context/HomeContext";
import { UserContext } from "@components/context/UserContext";
import { NButton } from "@ui/components/NButton";
import { GradientButton } from "@ui/components/NButton/GradientButton";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import Link from "next/link";
import { useContext } from "react";

import styled from "styled-components";
import { SubMenuWrapper } from "../../shared";
import { useCyberTranslation } from "@components/context/I18nContext";

export default function SubMenu({ toggle }) {
    const { logout, user } = useContext(UserContext);

    const { openedMenu } = useHome();

    const { t } = useCyberTranslation();

    if (openedMenu !== "menu") return null;

    return (
        <SubMenuWrapper>
            <Container>
                <div>
                    <p className="title" style={{ marginTop: 32 }}>
                        MAIN NAVIGATION
                    </p>

                    <LinksWrapper>
                        <p>
                            <Link href="/about">About</Link>
                        </p>

                        <p>
                            <Link href="/">Feed</Link>
                        </p>

                        <p>
                            <Link href="/templates">Templates</Link>
                        </p>

                        <a href="/docs" target="_blank">
                            <p>Knowledge Base</p>
                        </a>
                    </LinksWrapper>
                </div>

                <div>
                    <p className="title" style={{ marginBottom: 24 }}>
                        ACCOUNT
                    </p>

                    <div>
                        {
                            <a href="/studio">
                                <GradientButton
                                    onClick={() => {
                                        amplitude_logAnalyticsEvent(
                                            "clicked_3Dstudio_nav_button",
                                            { mobile: true }
                                        );
                                    }}
                                    style={{
                                        width: "100%",
                                        justifyContent: "center",
                                        marginBottom: 18,
                                    }}
                                    spanStyle={{
                                        padding: "10px 24px",
                                    }}
                                    outline
                                >
                                    World Builder
                                </GradientButton>
                            </a>
                        }
                        <NButton
                            onClick={user.id ? logout : toggle}
                            style={{ width: "100%", justifyContent: "center" }}
                        >
                            {user.id ? "Logout" : t`LOG_IN`}
                        </NButton>
                    </div>

                    <p className="footer-title">
                        © {new Date().getFullYear()} oncyber
                    </p>
                </div>
            </Container>
        </SubMenuWrapper>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    z-index: var(--zIndex_nav-submenu);

    h1 {
        margin: 0;
    }

    .title {
        font-weight: 400;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
    }

    .footer-title {
        font-weight: 400;
        font-size: 14px;

        color: rgba(0, 0, 0, 0.6);
    }

    @media (min-width: 780px) {
        display: none;
    }
`;

const LinksWrapper = styled.div`
    p {
        font-weight: 600;
        font-size: 40px;
        cursor: pointer;
        color: #070707;
        margin: 0;
        margin-bottom: 40px;
    }
`;
