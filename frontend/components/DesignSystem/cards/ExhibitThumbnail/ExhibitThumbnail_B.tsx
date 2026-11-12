import Link from "next/link";
import styled from "styled-components";
import { useState, useEffect, useContext, forwardRef } from "react";
import { amplitude_logAnalyticsEvent } from "../../../../utils/analytics";

import Creator from "../../../Creator";
import Icon from "../../../Icon";
import EyeIcon from "../../../Icons/eyeIcon";
import { UserContext } from "../../../context/UserContext";

interface ExhibitThumbnailProbs {
    style?: any;
    data: any;
    isLanding?: boolean;
    showCreatorImage?: boolean;
    source?: string;
}

const ExhibitThumbnail = forwardRef<HTMLDivElement, ExhibitThumbnailProbs>(
    (
        { style, data, isLanding = false, showCreatorImage = false, source },
        ref
    ) => {
        const { info, id } = data;

        const [offset, setOffset] = useState(0);
        const { user } = useContext(UserContext);

        const { headline, heroImg, cHeroImg, description, customLink } =
            info || {};

        const img =
            (heroImg && heroImg.split("hero")[1]
                ? heroImg.split("hero")[0] +
                  "hero_800x600" +
                  heroImg.split("hero")[1]
                : heroImg) || cHeroImg || "/images/thumbnail.png";

        const fireEvent = (exhibit) => {
            amplitude_logAnalyticsEvent("click_exibition_thumbnail", {
                item_id: exhibit?.id,
                user_id: user?.id,
                item_name: exhibit?.info?.headline,
                source: source || "",
            });
        };


        return (
            <SuperContainer ref={ref}>
                <Link
                    href={customLink ? `/${customLink}` : `/spaces/${id}`}
                    onClick={() => fireEvent(data)}>

                    <Container
                        style={style}
                        id={`hero-${id}`}
                        bg={
                            img ||
                            "https://cyber.mypinata.cloud/ipfs/QmbAU929f8tZp6UzVTv76ZbnRUNXWTTYmfAbvVhu4HzL6k?filename=thumbnail_yvbk53.png"
                        }
                        bg2={
                            heroImg ||
                            "https://cyber.mypinata.cloud/ipfs/QmbAU929f8tZp6UzVTv76ZbnRUNXWTTYmfAbvVhu4HzL6k?filename=thumbnail_yvbk53.png"
                        }
                    >
                        <InfoWrapper>
                            <div style={{ padding: 12, cursor: "pointer" }}>
                                <Title isLanding={isLanding}>
                                    <h1> {headline || "Untitled"}</h1>
                                    {/* {description && <p>{description}</p>} */}
                                </Title>

                                <CreatorWrapper>
                                    <Creator
                                        style={{
                                            background: "transparent",
                                            color: "#ffffff",
                                        }}
                                        showImage={true}
                                        key={data.owner}
                                        //id={data.owner}
                                        creator={{ id: data.owner }}
                                    />
                                </CreatorWrapper>
                            </div>
                        </InfoWrapper>
                        {/*
                            <div>
                                <EyeIcon />
                                <p>{data.number_of_visits}</p>
                            </div> */}
                    </Container>

                </Link>
            </SuperContainer>
        );
    }
);

const SuperContainer = styled.div`
    position: relative;
    width: 100%;
    height: 100%;
    // overflow: hidden;
    max-width: 100%;
`;

const Container = styled.div<{ bg: string; bg2: string }>`
    z-index: 1;
    width: 100%;
    height: 280px;
    position: relative;
    overflow: hidden;
    margin: 0 auto;
    background-image: url(${(props) => props.bg}), url(${(props) => props.bg2});
    // padding-bottom: 74%;
    background-size: cover;
    background-position: center;
    transition: 0.2s;
    border-radius: 8px;
    box-shadow: 6px 4px 10px rgba(0, 0, 0, 0.12);

    &:hover {
        transform: scale(1.05);
        // box-shadow: rgb(0 0 0 / 25%) 0px 16px 30px;
        z-index: 100;

        /* .more-info-wrapper {
            opacity: 1;
            height: auto;
            visibility: visible;
            width: 100%;
            transition: 0.5s opacity, visibility, height ease;
        } */
    }
`;

const InfoWrapper = styled.div`
    background: linear-gradient(
        0.72deg,
        rgba(0, 0, 0, 0.92) 0%,
        rgba(0, 0, 0, 0) 95%,
        rgba(0, 0, 0, 0) 100%
    );

    // padding: 18px;
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
    justify-content: flex-end;
`;

const MoreInfoWrapper = styled.div`
    background: #000000;
    color: #ffffff;

    opacity: 0;
    height: 0;
    visibility: hidden;
    width: 0;

    padding: 24px;

    h4 {
        margin: 0;
        margin-bottom: 6px;
    }
`;

const Main = styled.div`
    background: #f2efef;
    background-size: cover;
    background-position: center;
    height: 170px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    border-radius: 6px 6px 0 0;

    @media (max-width: 1400px) {
        height: 160px;
    }

    @media (max-width: 1000px) {
        height: 150px;
    }

    @media (max-width: 640px) {
        flex-direction: column;

        h1 {
            margin: 20px 0;
            width: 100%;
        }
    }
`;

const CreatorWrapper = styled.div`
    color: #ffffff;

    h3 {
        margin: 0;
    }

    img {
        border-radius: 100%;
    }
`;

const Info = styled.div`
    min-height: 150px;
    width: 100%;
    border-radius: 0 0 6px 6px;
    position: relative;

    display: grid;
    grid-template-columns: 1fr;
    justify-content: space-between;
    align-items: space-between;
    color: white;

    padding: 16px 24px;

    @media (max-width: 1400px) {
        padding: 14px;
    }

    @media (max-width: 1300px) {
        padding: 8px;
    }

    @media (max-width: 1300px) {
        grid-template-columns: 1fr;
        min-height: 120px;
    }
`;

const Title = styled.div<{ isLanding: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: start;
    position: relative;
    margin-bottom: 8px;

    color: #ffffff;

    h1 {
        font-size: 24px;
        font-weight: 600;
        padding-bottom: 0;
        margin: 4px 0 4px 0;
        overflow: hidden;
        width: 100%;
        // white-space: nowrap;
        text-overflow: ellipsis;
        line-height: 1.15 !important;
    }

    p {
        font-weight: 400;
        font-size: 16px;
        margin: 4px 0;
        overflow: hidden;
        opacity: 0.8;
        text-overflow: ellipsis;
    }

    @media (max-width: 1300px) {
        h1 {
            font-size: 20px;
        }
        p {
            font-size: 15px;
        }
    }
`;

const Editors = styled.div`
    overflow-y: hidden;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-gap: 10px;
    max-height: 50px;
    position: relative;

    &::-webkit-scrollbar {
        width: 5px;
        height: 5px;
        border-radius: 5px;
    }

    &::-webkit-scrollbar-track {
        background: #ffffff;
    }

    &::-webkit-scrollbar-thumb {
        background: #737373;
    }

    &::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
`;

const Next = styled.div`
    position: absolute;
    border-radius: 100%;
    padding: 8px;
    background: #343434;
    width: 40px;
    height: 40px;
    top: 56%;
    right: 2px;
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
        filter: invert(1);
    }

    &:hover {
        background: #000000;
    }

    @media (max-width: 800px) {
        top: 60%;
        width: 35px;
        height: 35px;
    }
`;

const Countdowns = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: flex-end;
    p {
        font-size: 16px;
        margin: 2px 0;
    }

    p span {
        font-size: 0.8em;
        color: #aeaeae;
    }

    @media (max-width: 1300px) {
        p {
            font-size: 14px;
        }
    }
`;

export default ExhibitThumbnail;
