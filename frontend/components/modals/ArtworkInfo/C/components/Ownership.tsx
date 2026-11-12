import { marketplaceProfileUrl } from "@utils/marketplaceProfile";
import { collectionImageSources } from "@utils/artworks/collectionImage";
import React from "react";
import { LabelledImg } from "./LabelledImg";
import styled from "styled-components";
import { formatUser } from "../utils";
import { Horz } from "../style/Flex";
import { Profile } from "./Profile";
import { VertSep } from "./VertSep";

type OwnershipType = React.HTMLProps<HTMLButtonElement> & {
    asset: Record<string, any>;
};

export default function Ownership(props: OwnershipType) {
    const { asset, ...rest } = props;

    const [collectionImg, ...collectionFallbacks] = collectionImageSources(
        asset?.collection?.image_url,
        asset?.blockchain
    );

    const hasCreator = asset?.creator?.address != null;
    // Require a real owner address — without the `&&`, a missing address makes
    // `undefined?.includes(...)` return undefined → `!undefined` === true, so the
    // owner block renders with no resolvable user and sticks on "Loading…".
    const hasOwner =
        !!asset?.owner?.address && !asset.owner.address.includes("0x0000");

    return (
        <Container className="artwork-ownership">
            {hasCreator && (
                <Profile
                    label="Artist"
                    url={marketplaceProfileUrl(
                        asset?.creator?.address,
                        asset?.account_base_url
                    )}
                    user={formatUser(asset?.creator)}
                />
            )}

            {hasOwner && (
                <>
                    {hasCreator && (
                        <VertSep
                            className="ownership-separator"
                            style={{ margin: "0 16px" }}
                        />
                    )}

                    {asset?.mime_type === "embed/youtube" ? (
                        <LabelledImg
                            label={"Owner"}
                            img="/images/opensea-black.png"
                            url=""
                            verified={false}
                            description={asset?.collection?.name}
                        />
                    ) : (
                        <Profile
                            label="Owner"
                            url={marketplaceProfileUrl(
                                asset?.owner?.address,
                                asset?.account_base_url
                            )}
                            user={formatUser(asset?.owner)}
                        />
                    )}
                </>
            )}

            {collectionImg && (
                <>
                    {(hasCreator || hasOwner) && (
                        <VertSep
                            style={{ margin: "0 16px" }}
                            className="desktop ownership-separator"
                        />
                    )}
                    <LabelledImg
                        className="desktop"
                        label={"Collection"}
                        img={collectionImg}
                        fallbackImages={collectionFallbacks}
                        url={asset?.collection?.external_url}
                        description={asset?.collection?.name}
                    />
                </>
            )}
        </Container>
    );
}

export const Container = styled(Horz)`
    flex: 0;
    justify-content: start;
    align-items: center;
    width: 100%;
    margin: 32px 0 8px 0 !important;

    & > .spacer {
        margin: 0 14px;
    }

    img {
        width: 25px;
        height: 25px;
        border-radius: 50%;
        object-fit: cover;
    }

    .row {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
    }

    @media (max-width: 1368px) {
        margin: 16px 0 4px 0 !important;
        & .desktop {
            display: none;
        }
    }
`;
