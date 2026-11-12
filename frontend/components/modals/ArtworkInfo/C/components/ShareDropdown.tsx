import { CSSProperties } from "react";
import styled from "styled-components";
import { Horz, Vert } from "../style/Flex";
import { useArtworkInfo } from "./ArtworkContext";

export enum ShareType {
    Twitter,
    Facebook,
    Link,
    Embed,
    Opensea,
    Looks,
}

export interface ShareDropdownProps {
    style?: CSSProperties;
    isShowing: boolean;
    onClick: (shareType: ShareType) => void;
    borderColor?: string;
}

export function ShareDropdown({
    style = {},
    isShowing,
    onClick,
    borderColor = "#e0e0e0",
}: ShareDropdownProps) {
    const { asset } = useArtworkInfo();

    const handleItemClick = (type: ShareType) => () => {
        onClick(type);
    };

    return (
        <Container
            style={style}
            isShowing={isShowing}
            hidden={!isShowing}
            aria-label="Share artwork options"
            borderColor={borderColor}
        >
            <Item onClick={handleItemClick(ShareType.Twitter)}>
                <img src="/v2/icons/twitter.svg" />
                Share on Twitter
            </Item>
            {/* <Item onClick={handleItemClick(ShareType.Facebook)}>
                <img src="/v2/icons/facebook.svg" />
                Share on Meta (Facebook)
            </Item> */}
            <Item onClick={handleItemClick(ShareType.Link)}>
                <img src="/v2/icons/link.svg" />
                Copy Link
            </Item>
            {/* <Item onClick={handleItemClick(ShareType.Embed)}>
                <img src="/v2/icons/embed.svg" />
                Embed item
            </Item> */}
            {asset?.blockchain == "ethereum" && (
                <>
                    <Item onClick={handleItemClick(ShareType.Looks)}>
                        <img src="/v2/icons/embed.svg" />
                        View on LooksRare
                    </Item>
                    <Item onClick={handleItemClick(ShareType.Opensea)}>
                        <img src="/v2/icons/embed.svg" />
                        View on Opensea
                    </Item>
                </>
            )}
        </Container>
    );
}

const Item = styled.button.attrs({ type: "button" })`
    display: flex;
    border: 0;
    background: transparent;
    color: var(--oc-secondary, #c2c2bd);
    font-family: inherit;
    text-align: left;
    border-radius: 8px;
    &:hover {
        color: var(--oc-ink, #f3f3f1);
        background: var(--oc-hover, #2c2c2c);
    }
    &:focus-visible {
        outline: 2px solid var(--oc-accent, #d3ec42);
        outline-offset: -2px;
    }
    align-items: center;
    height: 100%;
    width: 100%;
    padding: 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 400;

    & > img {
        width: 20px;
        height: 20px;
        margin-right: 12px;
        filter: invert(${({ theme }) => theme.filters.invert});
    }
`;

const Container = styled(Vert)<{
    isShowing?: boolean;
    center?: boolean;
    borderColor?: string;
}>`
    ${(props) => (!props.isShowing ? `display: none;` : "")}
    position: absolute;
    width: 284px;
    right: 50%;
    top: 120%;
    transform: translateX(50%);
    padding: 8px;
    z-index: 1000001;
    background: ${({ theme }) =>
        theme.dropdown?.background || theme.background};
    border-radius: 16px;
    border: 1px solid var(--oc-line-strong, #ffffff24);
    box-shadow: 0px 10px 20px 0px rgb(0 0 0 / 60%);
    background: var(--oc-panel, #191919);
    &[hidden] {
        display: none;
    }

    ${Item}:not(:first-child) {
        border-top: 1px solid;
        border-color: ${({ borderColor }) => borderColor};
    }
`;
