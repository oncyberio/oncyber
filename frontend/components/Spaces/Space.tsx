import {
    CATEGORY,
    formatFacetFilters,
    useFilter,
} from "@components/context/FilterContext";
import { UserContext } from "@components/context/UserContext";
import Avatar from "@ui/components/Avatar";
import AlgoliaProvider from "@utils/algolia/AlgoliaProvider";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { formatWalletAddress } from "@utils/format";
import { cloudinaryLoader, othersLoader } from "@utils/images/loader";
import { getUserByWalletId } from "@utils/saveToDb";
import Image from "next/image";
import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import styled from "styled-components";

interface SpaceProps {
    hit: any;
    index: number;
    loader?: boolean;
}

async function getUserByWalletIdCachedLocal(walletId: string) {
    // cache in local storage
    const cache = localStorage.getItem("@walletIdCache" + walletId);

    if (cache) {
        return JSON.parse(cache);
    }

    const res = await getUserByWalletId(walletId);

    if (res.success) {
        //
        const data = {
            username: res?.username || res?.user?.username,
            avatar: res?.avatar || res?.user?.username,
        };

        localStorage.setItem("@walletIdCache" + walletId, JSON.stringify(data));

        return data;
    }

    return null;
}

export default function Space({ hit, index, loader }: SpaceProps) {
    const {
        headline,
        owner,
        heroImg,
        cHeroImg,
        fHeroImg,
        artworks,
        customLink,
        objectID,
        tags,
        number_of_visits,
    } = hit;

    const [ownerInfo, setOwnerInfo] = useState({
        username: null,
        avatar: null,
    });

    useEffect(() => {
        (async () => {
            if (owner) {
                // we search getUserByWalletId when theres an @
                const d = await getUserByWalletIdCachedLocal("@" + owner);

                if (d.success) {
                    // @ts-ignore

                    setOwnerInfo({
                        username: d?.username || d?.user?.username,
                        avatar: d?.avatar || d?.user?.username,
                    });
                }
            }
        })();
    }, [owner]);

    const { user } = useContext(UserContext);

    const { feed, handleChangeCategory, search, filters, category } =
        useFilter();

    const link = customLink ? `/${customLink}` : `/spaces/${objectID}`;

    const position = feed.spaceHits.page * 30 + index + 1; // needs to start from 1

    const artworksLength =
        typeof artworks === "number"
            ? artworks
            : Object.keys(artworks || {}).length || 0;

    const subInfo =
        artworksLength > 4
            ? artworksLength + " Artworks"
            : number_of_visits + " Visits";

    const _heroImg = fHeroImg || cHeroImg || heroImg || "";

    function handleClick() {
        amplitude_logAnalyticsEvent("click_feed_card", {
            filters: formatFacetFilters(filters).flatMap((t) => t),
            search,
            category,
            page: feed.spaceHits.page,
            pages: feed.spaceHits.pages,
            type: feed.searchType,
            tags: tags.map((t) => ({
                key: t.key,
                title: t.title,
            })),
        });
    }

    return (
        <SpaceWrapper key={index} onClick={handleClick}>
            <Link href={link} target="_blank">
                <ImageWrapper>
                    {fHeroImg || cHeroImg || heroImg ? (
                        <Image
                            priority={index < 5}
                            alt={`${headline} world`}
                            src={_heroImg}
                            loader={
                                _heroImg.includes("cloudinary")
                                    ? cloudinaryLoader
                                    : othersLoader
                            }
                            quality="50"
                            onLoadingComplete={(e) => {
                                e.style.visibility = "visible";
                            }}
                            fill
                            // sizes="80vw"
                            style={{ objectFit: "cover", visibility: "hidden" }}
                            {...{
                                unoptimized: !_heroImg.includes("cloudinary"),
                            }}
                        />
                    ) : null}
                </ImageWrapper>
            </Link>
            <ProfileWrapper>
                <Avatar
                    style={{
                        border: "1px solid #e1dfdf",
                        marginRight: 12,
                    }}
                    // src={
                    //     loader
                    //         ? ""
                    //         : feed?.owners?.[owner]?.avatar ||
                    //           "/images/opensea-black.png"
                    // }
                    src={
                        loader
                            ? ""
                            : ownerInfo?.avatar || "/images/opensea-black.png"
                    }
                    title={`profile ${owner}`}
                />
                <TextWrapper>
                    <h3
                        style={{
                            cursor: "pointer",
                        }}
                    >
                        {!loader ? (
                            <Link href={link} target="_blank">
                                {headline || "Untitled"}
                            </Link>
                        ) : (
                            <TextLoader />
                        )}
                    </h3>
                    {!loader ? (
                        <SubTextWrapper>
                            <Avatar
                                size="small"
                                style={{
                                    border: "1px solid #e1dfdf",
                                }}
                                // src={
                                //     loader
                                //         ? ""
                                //         : feed?.owners?.[owner]?.avatar ||
                                //           "/images/opensea-black.png"
                                // }
                                src={
                                    loader
                                        ? ""
                                        : ownerInfo?.avatar ||
                                          "/images/opensea-black.png"
                                }
                                title={`profile ${owner}`}
                            />
                            <Link
                                target="_blank"
                                href={`/@${
                                    feed?.owners?.[owner]?.username || owner
                                }`}
                            >
                                <p>
                                    @
                                    {ownerInfo?.username
                                        ? ownerInfo?.username
                                        : formatWalletAddress(owner)}
                                </p>
                            </Link>
                            <span>•</span>
                            <p>{subInfo}</p>
                            {tags.map((tag) => {
                                // Tags come from useFeed as { key, title }
                                // objects, but older callers/Algolia hits may
                                // still pass plain strings.
                                const title =
                                    typeof tag === "string" ? tag : tag?.title;

                                if (!title) return null;

                                return (
                                    <Tag
                                        key={title}
                                        onClick={() => {
                                            // if (
                                            //     rest.nonClickable ||
                                            //     key === "online"
                                            // )
                                            //     return;
                                            // handleChangeCategory(
                                            //     key as CATEGORY
                                            // );
                                        }}
                                        // style={
                                        //     rest.nonClickable ||
                                        //     key === "online"
                                        //         ? {}
                                        //         : {
                                        //               cursor: "pointer",
                                        //           }
                                        // }
                                    >
                                        {title?.includes?.("online now") ? (
                                            <OnlineWrapper>
                                                <Round /> {title}
                                            </OnlineWrapper>
                                        ) : (
                                            title
                                        )}
                                    </Tag>
                                );
                            })}
                        </SubTextWrapper>
                    ) : null}
                </TextWrapper>
            </ProfileWrapper>
        </SpaceWrapper>
    );
}

const SpaceWrapper = styled.div`
    width: 100%;
`;

const TextLoader = styled.div`
    background: linear-gradient(110deg, #e9e9e9 8%, #f5f5f5 18%, #e9e9e9 33%);
    background-size: 200% 100%;
    animation: 2s shine linear infinite;
    border-radius: 5px;
    height: 19px;
    width: 70%;
`;

const ImageWrapper = styled.div`
    width: 100%;
    padding-bottom: 38%;
    // 54%
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f5;
    max-height: 333px;
    cursor: pointer;
    position: relative;
    // font-size: 0;

    background: linear-gradient(110deg, #e9e9e9 8%, #f5f5f5 18%, #e9e9e9 33%);
    background-size: 200% 100%;
    animation: 2s shine linear infinite;

    img {
        width: 100%;
        position: absolute;
        object-fit: cover;
        height: 100%;
    }

    @media (max-width: 820px) {
        padding-bottom: 68%;
    }

    @media (max-width: 780px) {
        padding-bottom: 38%;
    }

    @media (max-width: 520px) {
        padding-bottom: 68%;
    }
`;

const ProfileWrapper = styled.div`
    display: flex;
    align-items: center;
    margin-top: 12px;
    margin-bottom: 24px;

    @media (min-width: 820px) {
        & > .ds-avatar {
            display: block;
        }
    }
    @media (max-width: 820px) {
        margin-top: 12px;

        & > .ds-avatar {
            display: none;
        }
    }
`;

const TextWrapper = styled.div`
    width: 100%;

    h3,
    p {
        margin: 0;
    }

    h3 {
        font-weight: 500;
        font-size: 16px;

        color: #070707;
    }
`;

const SubTextWrapper = styled.div`
    display: flex;
    gap: 12px;
    font-weight: 400;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 4px;
    color: #757575;

    p {
        font-size: 14px;
    }

    @media (min-width: 820px) {
        & > .ds-avatar {
            display: none;
        }
    }

    @media (max-width: 820px) {
        gap: 6px;
        margin-top: 4px;

        & > .ds-avatar {
            display: block;
        }
    }
`;

const Tag = styled.div`
    border: 1px solid #e0e0e0;
    padding: 2px 18px;
    border-radius: 900px;
    font-size: 13px;

    margin-top: 2px;
`;

const OnlineWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
`;

const Round = styled.div`
    background: #44c35a;
    width: 6px;
    height: 6px;
    border-radius: 50%;
`;
