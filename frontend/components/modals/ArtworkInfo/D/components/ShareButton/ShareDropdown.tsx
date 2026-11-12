import IconImg from "@ui/components/IconImg";
import { CSSProperties } from "react";
import styled from "styled-components";
import { useArtworkInfo } from "../../ArtworkContext";
import { useCyberTranslation } from "@components/context/I18nContext";

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
    //
    const { asset } = useArtworkInfo();

    const { t } = useCyberTranslation();

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
                <IconImg size={20} name="twitter" mode="light" />
                {t`SHARE_ON_TWITTER`}
            </Item>
            {/* <Item onClick={handleItemClick(ShareType.Facebook)}>
                <img src="/v2/icons/facebook.svg" />
                Share on Meta (Facebook)
            </Item> */}
            <Item onClick={handleItemClick(ShareType.Link)}>
                <IconImg size={20} name="link" mode="light" />
                {t`COPY_LINK`}
            </Item>
            {/* <Item onClick={handleItemClick(ShareType.Embed)}>
                <img src="/v2/icons/embed.svg" />
                Embed item
            </Item> */}
            {asset?.blockchain == "ethereum" && (
                <>
                    <Item onClick={handleItemClick(ShareType.Looks)}>
                        <IconImg size={20} name="looksrare" mode="light" />
                        {t`VIEW_ON_LOOKSRARE`}
                    </Item>
                    <Item onClick={handleItemClick(ShareType.Opensea)}>
                        <IconImg size={20} name="opensea" mode="light" />
                        {t`VIEW_ON_OPENSEA`}
                    </Item>
                </>
            )}
        </Container>
    );
}

const Item = styled.button.attrs({ type: "button" })`
    border: 0;
    background: transparent;
    color: var(--oc-secondary, #c2c2bd);
    font-family: inherit;
    text-align: left;
    border-radius: 8px;
    &:hover {
        background: var(--oc-hover, #2c2c2c);
        color: var(--oc-ink, white);
    }
    &:focus-visible {
        outline: 2px solid var(--oc-accent, #d3ec42);
        outline-offset: -2px;
    }
    display: flex;
    flex-direction: horizontal;
    align-items: center;
    height: 100%;
    width: 100%;
    padding: 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 400;

    & > .icon-img {
        margin-right: 12px;
    }
`;

const Container = styled.div<{
    isShowing?: boolean;
    center?: boolean;
    borderColor?: string;
}>`
    display: flex;
    flex-direction: column;
    ${(props) => (!props.isShowing ? `display: none;` : "")}
    position: absolute;
    width: 284px;
    right: 50%;
    top: 120%;
    transform: translateX(30%);
    padding: 8px;
    z-index: 1000001;

    background: var(--oc-panel, #191919);
    border: 1px solid var(--oc-line-strong, #ffffff24);
    &[hidden] {
        display: none;
    }
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15);
    border-radius: 8px;
    color: #fff;

    ${Item}:not(:first-child) {
        border-top: 0.5px solid;
        border-color: ${({ borderColor }) => borderColor};
    }
`;
