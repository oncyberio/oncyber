import styled from "styled-components";
import { amplitude_logAnalyticsEvent } from "../utils/analytics";

export default function Footer({ isLight = false }: { isLight?: boolean }) {
    const fireEvent = (type) => {
        amplitude_logAnalyticsEvent(`footer_click_${type}`);
    };

    return (
        <Container isLight={isLight}>
            {/* <div>
            <StepsWrapper style={{ margin: "0 5px" }}>
                <Title>how it works with <Logo href="https://unrvl.com">UNRVL</Logo></Title>
                <Steps>
                    <li>1. Create account</li>
                    <li>2. Curate exhibit</li>
                    <li>3. Invite people to check it out</li>
                </Steps>
            </StepsWrapper>
        </div> */}
            <FooterWrapper>
                <LogoContainer>
                    <img className="invertColor" src="../images/logo.png" />
                    <p>
                        Powered by{" "}
                        <Logo href="https://oncyber.io">
                            <span className="pixelated">on</span>cyber
                        </Logo>
                    </p>
                </LogoContainer>
                <Socials data-cy="footer-socials">
                    <div onClick={() => fireEvent("opensea")}>
                        <a
                            target="_blank"
                            href="https://opensea.io/category/oncyber"
                        >
                            <img src="../images/icons/opensea-transparent.svg" />
                        </a>
                    </div>
                    <div onClick={() => fireEvent("discord")}>
                        <a
                            target="_blank"
                            href="https://github.com/oncyberio/factory"
                        >
                            <img
                                className="invertColor"
                                src="../images/icons/github.png"
                            />
                        </a>
                    </div>
                    <div onClick={() => fireEvent("discord")}>
                        <a target="_blank" href="https://discord.gg/YTpSRnB65U">
                            <img
                                className="invertColor"
                                src="../images/icons/discord.png"
                            />
                        </a>
                    </div>
                    <div onClick={() => fireEvent("twitter")}>
                        <a target="_blank" href="https://twitter.com/oncyber">
                            <img
                                className="invertColor"
                                src="../images/icons/twitter.png"
                            />
                        </a>
                    </div>
                    <div onClick={() => fireEvent("instagram")}>
                        <a target="_blank" href="https://instagram.com/oncyber">
                            <img
                                className="invertColor"
                                src="../images/icons/instagram.png"
                            />
                        </a>
                    </div>
                </Socials>
            </FooterWrapper>
        </Container>
    );
}

const Container = styled.div<{ isLight: boolean }>`
    background: ${({ isLight }) => (isLight ? "#fff" : "#000")};
    color: ${({ isLight }) => (isLight ? "#000" : "#fff")};

    .invertColor {
        ${({ isLight }) => isLight && "filter: invert(1) !important;"}
    }
`;

const LogoContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;

    img {
        width: 50px;
    }

    p {
        margin: 8px 0;
    }
`;

const Socials = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;

    img {
        margin: 0 16px;
        width: 40px;
    }

    p {
        margin: 8px 0;
    }

    @media (max-width: 800px) {
        img {
            margin: 0 8px;
            width: 32px;
        }
    }
`;

const Logo = styled.a`
    font-size: 1.1em;
    margin-left: 1px;
    text-decoration: none;
`;

const FooterWrapper = styled.footer`
    display: grid;
    grid-template-columns: 2fr 2fr;
    justify-content: space-between;
    vertical-align: middle;
    font-size: 22px;
    max-width: 1260px;
    margin: 0 auto;

    ul li a {
        margin-right: 24px;
    }

    ul {
        display: flex;
        list-style: none;
        li:not(:last-child) {
            margin-right: 12px;
        }
    }

    padding: 48px 32px;

    @media (max-width: 678px) {
        font-size: 14px;
        padding: 48px 16px;

        // padding: 24px 5% 64px 5%;

        ul {
            li:not(:last-child) {
                margin-right: 6px;
            }
        }

        ul li a {
            margin-right: 8px;
        }
    }
`;
