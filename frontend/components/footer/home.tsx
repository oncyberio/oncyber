import { UserContext } from "@components/context/UserContext";
import { MaxWrapper } from "@components/nav/home/shared";
import IconImg from "@ui/components/IconImg";
import Link from "next/link";
import { useContext } from "react";
import styled from "styled-components";

export default function HomeFooter({
    marginTop = "48px",
    discordLink = "https://discord.gg/3dEQXmAXnv",
}) {
    const { user, userData } = useContext(UserContext);

    return (
        <Container style={{ marginTop }}>
            <MaxWrapperExtended>
                <CopyWrapper>
                    <IconImg size={56} name="cyber" />

                    <div>
                        <p>© {new Date().getFullYear()} oncyber</p>
                        <p>All rights reserved.</p>
                    </div>
                </CopyWrapper>

                <ColumnsWrapper>
                    <div>
                        <h3>Sitemap</h3>
                        <p>
                            <Link href="/">Home Feed</Link>
                        </p>
                        <p>
                            <Link href="/studio">Create</Link>
                        </p>
                        <p>
                            <Link
                                target="_blank"
                                href="/docs"
                            >
                                Docs
                            </Link>
                        </p>
                        <p>
                            <Link
                                target="_blank"
                                href="https://docs.oncyber.io/faq"
                            >
                                FAQ
                            </Link>
                        </p>
                    </div>

                    {user.id ? (
                        <div>
                            <h3>Account</h3>
                            <p>
                                <Link
                                    href={`/@${userData?.username || user.id}`}
                                >
                                    Profile
                                </Link>
                            </p>
                            <p>
                                <Link href="/studio">Create</Link>
                            </p>
                        
                        </div>
                    ) : null}

                    <div>
                        <h3>Platforms</h3>
                        <p>
                            <a
                                href="https://opensea.io/category/oncyber"
                                target="_blank"
                            >
                                Opensea
                            </a>
                        </p>
                        <p>
                            <a
                                href="https://github.com/oncyberio"
                                target="_blank"
                            >
                                Github
                            </a>
                        </p>
                    </div>

                    <div>
                        <h3>Social</h3>
                        <p>
                            <a
                                href="https://twitter.com/oncyber"
                                target="_blank"
                            >
                                Twitter
                            </a>
                        </p>
                        <p>
                            <a
                                href="https://www.instagram.com/oncyber"
                                target="_blank"
                            >
                                Instagram
                            </a>
                        </p>
                        <p>
                            <a href={discordLink} target="_blank">
                                Discord
                            </a>
                        </p>
                    </div>
                </ColumnsWrapper>
            </MaxWrapperExtended>
        </Container>
    );
}

const Container = styled.div`
    border-top: 1px solid rgba(7, 7, 7, 0.2);
    display: flex;
    justify-content: center;
    padding: 0 24px;
    width: 100%;
`;

const MaxWrapperExtended = styled(MaxWrapper)`
    display: grid;
    grid-template-columns: 0.5fr 1.5fr;
    padding: 64px 0;

    @media (max-width: 550px) {
        grid-template-columns: 1fr;
    }
`;

const ColumnsWrapper = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;

    & > div {
        justify-self: flex-end;

        h3 {
            font-weight: 400;
            margin-top: 0;
            font-size: 14px;
            line-height: 16px;
            color: rgba(0, 0, 0, 0.6);
        }

        p {
            font-weight: 500;
            font-size: 16px;
            line-height: 100%;
            color: #070707;
        }
    }

    @media (max-width: 780px) {
        grid-template-columns: repeat(2, 1fr);

        & > div {
            justify-self: flex-start;
        }
    }

    @media (max-width: 280px) {
        grid-template-columns: 1fr;
    }
`;

const CopyWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 48px;
    height: 100%;
    p {
        margin: 0;
        font-weight: 400;
        font-size: 14px;
        line-height: 16px;

        color: rgba(0, 0, 0, 0.6);
    }

    @media (max-width: 1320px) {
        gap: 24px;
    }

    @media (max-width: 780px) {
        gap: 12px;
        margin-bottom: 24px;
    }
`;
