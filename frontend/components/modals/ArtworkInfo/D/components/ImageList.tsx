import React from "react";
import styled from "styled-components";

interface ImageListProps {
    images: { url: string; alt: string }[];
    onClickMore: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => unknown;
    maxShown?: number;
}

const MAX_SHOWN = 4;

export const ImageList = React.forwardRef<HTMLDivElement, ImageListProps>(
    ({ images, onClickMore, maxShown = MAX_SHOWN }, ref) => {
        //
        const shown = images.slice(0, maxShown);
        const nbHidden = images.length - maxShown;

        return (
            <Container ref={ref} onClick={onClickMore}>
                <ul className="images">
                    {shown.map(({ url, alt }) => {
                        return (
                            <li className="item">
                                <img
                                    key={url}
                                    className="li-img"
                                    src={url}
                                    alt={alt}
                                />
                            </li>
                        );
                    })}
                </ul>
                {nbHidden > 0 && (
                    <div className="pfp-show-more">+{nbHidden}</div>
                )}
            </Container>
        );
    }
);

const Container = styled.div`
    display: flex;
    flex-direction: row;
    gap: 16px;
    align-items: center;
    padding: 8px;
    min-width: var(--min-item-width);
    max-width: var(--max-item-width);

    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 200px;
    cursor: pointer;

    & > .images {
        display: flex;
        list-style-type: none;
        margin: 0;
        padding: 0;

        & > li.item {
            height: 32px;
            width: 20px;
            margin: 0;
            padding: 0;

            & .li-img {
                width: 32px;
                height: 32px;
                max-width: 32px;
                max-height: 32px;
                border: 1px solid #8c8c8c;
                border-radius: 100px;
                object-fit: cover;
                background-color: #1e1e1e;
            }
        }
    }

    & > .pfp-show-more {
        flex: 1;
        font-weight: 500;
        font-size: 16px;
        color: #ffffff;
    }
`;
