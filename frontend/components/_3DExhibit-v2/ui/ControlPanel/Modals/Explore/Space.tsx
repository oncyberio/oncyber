import {
    CATEGORY,
    formatFacetFilters,
    useFilter,
} from "@components/context/FilterContext";
import { UserContext } from "@components/context/UserContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import Avatar from "@ui/components/Avatar";
import AlgoliaProvider from "@utils/algolia/AlgoliaProvider";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { formatWalletAddress } from "@utils/format";
import { cloudinaryLoader, othersLoader } from "@utils/images/loader";
import Image from "next/image";
import Link from "next/link";
import { useContext } from "react";
import styled, { css } from "styled-components";
import { useCyberTranslation } from "@context/I18nContext";
import { usePanel } from "../../context/PanelProvider";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";

interface SpaceProps {
    hit: any;
    index: number;
    loader?: boolean;
}

export default function Space({ hit, index, loader }: SpaceProps) {
    const {
        room,
        description,
        headline,
        owner,
        heroImg,
        cHeroImg,
        fHeroImg,
        chains,
        collections,
        path,
        artworks,
        customLink,
        objectID,
        tags,
        number_of_visits,
    } = hit;

    const world = useWorld();

    const { setCurrentTab } = usePanel();

    const { t } = useCyberTranslation();

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
            ? artworksLength + " " + t`ARTWORKS`
            : number_of_visits + " " + t`VISITS`;

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

    async function handleOpenPortal() {
        try {
            if (loader) return;

            setCurrentTab("");

            await world.current.summonPortal({
                exhibitId: objectID,
                //coords: exhibitLink.coords,
            });
        } catch (err) {
            console.error(err);
        }
    }

    return (
        <SpaceWrapper key={index} onClick={handleClick}>
            <ImageWrapper onClick={handleOpenPortal}>
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

            <Headline>
                {!loader ? (
                    <div onClick={handleOpenPortal}>
                        {headline || t`UNTITLED`}
                    </div>
                ) : (
                    <TextLoader />
                )}
            </Headline>

            <ProfileWrapper>
                {!loader ? (
                    <SubTextWrapper>
                        <Avatar
                            size="small"
                            style={{
                                border: "1px solid #e1dfdf",
                            }}
                            src={
                                loader
                                    ? ""
                                    : feed?.owners?.[owner]?.avatar ||
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
                                {feed?.owners?.[owner]?.username
                                    ? feed?.owners?.[owner]?.username
                                    : formatWalletAddress(owner)}
                            </p>
                        </Link>
                        <span>•</span>
                        <p>{subInfo}</p>
                    </SubTextWrapper>
                ) : null}
            </ProfileWrapper>

            {!loader ? (
                <TagWrapper>
                    {tags.map(({ title, key, ...rest }) => {
                        if (rest.hideTag) return null;

                        return (
                            <Tag
                                className="explore-tag"
                                key={title}
                                onClick={() => {
                                    if (rest.nonClickable || key === "online")
                                        return;

                                    handleChangeCategory(key as CATEGORY);
                                }}
                                style={
                                    rest.nonClickable || key === "online"
                                        ? {}
                                        : {
                                              cursor: "pointer",
                                          }
                                }
                            >
                                {title.includes("online now") ? (
                                    <OnlineWrapper>
                                        <Round /> {title}
                                    </OnlineWrapper>
                                ) : (
                                    title
                                )}
                            </Tag>
                        );
                    })}
                </TagWrapper>
            ) : null}
        </SpaceWrapper>
    );
}

const SpaceWrapper = styled.div`
    width: 100%;
    margin-bottom: 32px;
`;

const TextLoader = styled.div`
    background: linear-gradient(
        110deg,
        rgba(245, 245, 245, 0.1) 8%,
        rgba(245, 245, 245, 0.1) 18%,
        rgba(245, 245, 245, 0.1) 33%
    );
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
    max-height: 333px;
    cursor: pointer;
    position: relative;
    // font-size: 0;
    background: linear-gradient(
        110deg,
        rgba(245, 245, 245, 0.1) 8%,
        rgba(245, 245, 245, 0.1) 18%,
        rgba(245, 245, 245, 0.1) 33%
    );
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
    margin-top: 2px;

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
    color: #757575;

    p {
        font-weight: 400;
        font-size: 14px;
        line-height: 100%;
        display: flex;
        align-items: center;
        color: #ffffff;
        opacity: 0.5;
    }
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

const Headline = styled.h3`
    font-weight: 500;
    font-size: 16px !important;
    line-height: 100%;
    color: #ffffff;
    cursor: pointer;
    margin: 0px;
    padding: 0px;
    margin-top: 16px;
`;

const Tag = styled.div`
    border: 1px solid #e0e0e0;
    padding: 2px 18px;
    border-radius: 900px;
    font-size: 13px;
    margin-top: 2px;
    margin-right: 4px;
`;

const TagWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-bottom: 24px;
`;
