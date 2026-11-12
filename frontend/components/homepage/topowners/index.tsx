import { useFilter } from "@components/context/FilterContext";
import Avatar from "@ui/components/Avatar";
import { formatWalletAddress } from "@utils/format";
import Link from "next/link";

import styled from "styled-components";
import RoundInfo from "../shared/RoundInfo";

export default function TopOwners() {
    const { feed } = useFilter();

    return (
        <Container style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "16px 0" }}>Top creators</h3>
            <div>
                {feed.topArtists.slice(0, 7).map((artist, index) => {
                    const username = feed?.owners?.[artist]?.username
                        ? feed?.owners?.[artist]?.username
                        : formatWalletAddress(artist);

                    const numOfSpaces =
                        feed?.owners?.[artist]?.numOfSpaces || 0;

                    const isLoading =
                        typeof feed?.owners?.[artist]?.numOfSpaces ===
                        "undefined";

                    return (
                        <RoundInfo
                            key={username}
                            src={
                                feed?.owners?.[artist]?.avatar ||
                                "/images/opensea-black.png"
                            }
                            alt={`profile ${artist}`}
                            link={`/@${
                                feed?.owners?.[artist]?.username || artist
                            }`}
                            title={`@${username}`}
                            subtitle={
                                isLoading
                                    ? "Fetching…"
                                    : `${numOfSpaces} spaces`
                            }
                        />
                    );
                })}
            </div>
        </Container>
    );
}

const Container = styled.div`
    h3 {
        margin: 0;
        font-weight: 500;
    }
`;

const AvatarItem = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 400;
    font-size: 15px;
    color: #070707;
    margin: 16px 0;

    p {
        margin: 0;
    }

    span {
        font-size: 0.8em;
        color: #757575;
    }
`;
