import React from "react";
import { ArtworkThumbnail } from "../../ArtworkThumbnail";
import VerifiedIcon from "@ui/icons/Verified";
import styled from "styled-components";
import { Horz, Vert } from "../style/Flex";

export const LabelledImg = ({
    label,
    img,
    fallbackImages = [],
    description,
    url,
    className = "",
    verified = false,
}) => {
    return (
        <Container className={`labelled-img ${className}`}>
            <ImgWrapper verified={verified}>
                <ArtworkThumbnail
                    className="li-avatar"
                    sources={[img, ...fallbackImages]}
                    alt={description || label || "Profile"}
                />
                {verified && <VerifiedIcon />}
            </ImgWrapper>

            <Vert>
                <a
                    target="_blank"
                    className="li-link truncated"
                    href={url}
                    rel="noopener noreferrer"
                >
                    {description}
                </a>

                <div className="li-label">{label}</div>
            </Vert>
        </Container>
    );
};

const Container = styled(Horz)`
    cursor: pointer;
    align-items: center;
    position: relative;

    & .li-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        margin-right: 4px;
    }

    & .li-link {
        display: inline-block;
        max-width: 130px;
        font-size: 13px;
        font-weight: 500;
        // color: #070707;
    }

    & .li-label {
        font-size: 12px;
        font-weight: 500;
        color: #7a7a7a;
    }
`;

const ImgWrapper = styled.div<{ verified: boolean }>`
    position: relative;
    ${({ verified }) => verified && "margin-right: 5px;"};

    svg {
        position: absolute;
        bottom: 0px;
        right: -3px;
    }
`;
