import TopOwners from "@components/homepage/topowners";
import { Divider } from "@ui/components/Divider";
import { IconButton } from "@ui/components/IconButton";
import Spinner from "@ui/components/Spinner";
import dynamic from "next/dynamic";
import styled from "styled-components";

const Description = dynamic(() => import("./Sidebar/Description"), {
    ssr: false,
    loading: () => <p>Loading…</p>,
});

export default function Sidebar({ collection, feed }) {
    const shouldDisplayLinks =
        collection?.socials?.twitter_username ||
        collection?.socials?.instagram_username ||
        collection?.socials?.external_url;

    const shouldDisplayDivider = collection?.description || shouldDisplayLinks;

    return (
        <Container>
            <Description text={collection.description} />

            {shouldDisplayLinks ? (
                <LinksWrapper>
                    {collection?.socials?.twitter_username ? (
                        <a
                            href={`https://twitter.com/${collection.socials.twitter_username}`}
                            target={"_blank"}
                        >
                            <IconButton
                                style={{ border: "none" }}
                                mode="light"
                                size="small"
                                name="twitter"
                            />
                        </a>
                    ) : null}
                    {collection?.socials?.instagram_username ? (
                        <a
                            href={`https://www.instagram.com/${collection.socials.instagram_username}`}
                            target={"_blank"}
                        >
                            <IconButton
                                style={{ border: "none" }}
                                mode="light"
                                size="small"
                                name="instagram"
                            />
                        </a>
                    ) : null}
                    {collection?.socials?.external_url ? (
                        <a
                            href={collection.socials.external_url}
                            target={"_blank"}
                        >
                            <IconButton
                                style={{ border: "none" }}
                                mode="light"
                                size="small"
                                name="globe"
                            />
                        </a>
                    ) : null}
                    {/* <IconImg name="discord" /> */}
                </LinksWrapper>
            ) : null}

            {shouldDisplayDivider ? (
                <Divider style={{ margin: "24px 0" }} />
            ) : null}

            <TopOwnersWrapper>
                <TopOwners />
            </TopOwnersWrapper>
        </Container>
    );
}

const Container = styled.div`
    position: sticky;
    top: 0;
    position: -webkit-sticky;
    height: 100%;
    min-width: 320px;
    width: 320px;

    @media (max-width: 800px) {
        display: block;
        width: 100%;
        position: static;
    }
`;

const LinksWrapper = styled.div`
    display: flex;
    gap: 16px;
    margin-top: 16px;
`;

const TopOwnersWrapper = styled.div`
    @media (max-width: 800px) {
        display: none;
    }
`;
