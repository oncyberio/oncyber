import React from "react";
import { ArtworkThumbnail } from "../../../ArtworkThumbnail";
import styled from "styled-components";

export interface LabelledImgProps {
    label?: string;
    img: string;
    fallbackImages?: string[];
    description: string;
    url: string;
    className?: string;
    style?: React.CSSProperties;
}

export const LabelledImg = React.forwardRef<HTMLDivElement, LabelledImgProps>(
    (
        {
            label,
            img,
            fallbackImages = [],
            description,
            url,
            className = "",
            style = {},
        },
        ref
    ) => {
        return (
            <Container
                ref={ref}
                className={`li-card ${className}`}
                style={style}
            >
                <ArtworkThumbnail
                    className="li-img"
                    sources={[img, ...fallbackImages]}
                    alt={description || label || "Profile"}
                />

                <div className="li-desc">
                    {label && <div className="li-label">{label}</div>}
                    <a
                        target="_blank"
                        className="li-link truncated"
                        href={url}
                        rel="noopener noreferrer"
                    >
                        {description}
                    </a>
                </div>
            </Container>
        );
    }
);

const Container = styled.div`
    display: flex;
    flex-direction: row;
    cursor: pointer;
    align-items: center;
    padding: 6px 14px 6px 6px;
    min-width: var(--min-item-width);
    max-width: var(--max-item-width);
    box-sizing: border-box;

    background: #14161bcc;
    border: 1px solid #ffffff18;
    border-radius: 12px;

    & > .li-img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        margin-right: 10px;
    }

    & > .li-desc {
        display: flex;
        flex-direction: column;
        align-items: flex-start;

        font-weight: 400;
        font-size: 13px;
        line-height: 18px;
        color: #f3f3f1;

        & > .li-label {
            color: #93938e;
            font-size: 11px;
            line-height: 14px;
            max-width: calc(var(--max-item-width) - 80px);
        }

        & > .li-link {
            display: inline-block;
        }

        & .truncated {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }
`;
