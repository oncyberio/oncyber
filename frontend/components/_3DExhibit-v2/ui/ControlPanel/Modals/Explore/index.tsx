import React, { useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import useFeed from "@components/hooks/useFeed";
import { CATEGORIES } from "@utils/feed/category";
import { IconButton } from "@ui/components/IconButton";
import HomeProvider from "@components/context/HomeContext";
import FilterProvider from "@components/context/FilterContext";
import { CATEGORY, useFilter } from "@components/context/FilterContext";
import Spaces from "./Spaces";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { usePanel } from "../../context/PanelProvider";
import useEmblaCarousel from "embla-carousel-react";
import { useCyberTranslation } from "@context/I18nContext";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";

function Explore_Child({ isMobile = false }) {
    const { category, search, handleChangeCategory, changePage, handleSearch } =
        useFilter();

    const [emblaRef, emblaApi] = useEmblaCarousel({
        dragFree: false,
        containScroll: "trimSnaps",
    });

    const [openSearch, setOpenSearch] = useState(false);

    const { t } = useCyberTranslation();

    const { setCurrentTab, clickRef } = usePanel();

    const divRef = useRef(null);

    const categoryRef = useRef(false);

    const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = divRef.current;

        if (
            scrollHeight - (scrollTop + clientHeight) < 0.1 * clientHeight &&
            !categoryRef.current
        ) {
            changePage();
        }

        categoryRef.current = false;
    };

    const handleSwitchCategory = (key: CATEGORY) => {
        categoryRef.current = true;
        if (divRef?.current) divRef.current.scrollTop = 0;
        handleChangeCategory(key);
    };

    const handleCarousel = useEventCallback(
        (key) => {
            if (!emblaApi || !emblaApi.clickAllowed()) return;

            handleSwitchCategory(key);
        },
        [emblaApi]
    );

    return (
        <Container ref={isMobile ? null : clickRef}>
            <Header>
                {!openSearch ? (
                    <>
                        <h2>{t`EXPLORE`}</h2>
                        <div className="icon-right">
                            <IconButton
                                mode="light"
                                size="xsmall"
                                name="search"
                                className="btn-icon"
                                onClick={() => setOpenSearch(true)}
                            />
                            <IconButton
                                mode="light"
                                size="xsmall"
                                name="x"
                                className="btn-icon"
                                onClick={() => setCurrentTab("")}
                            />
                        </div>
                    </>
                ) : (
                    <InputWrapper>
                        <input
                            type={"text"}
                            value={search}
                            className="search"
                            onChange={(e) => {
                                handleSearch(e.target.value);
                            }}
                            placeholder={t`PANEL_EXPLORE_SEARCH`}
                        />
                        <IconButton
                            mode="light"
                            size="xsmall"
                            name="x"
                            className="search-x-icon"
                            onClick={() => {
                                handleSearch("");
                                setOpenSearch(false);
                            }}
                        />
                    </InputWrapper>
                )}
            </Header>
            <Hr />
            <div className="embla">
                <div className="embla__viewport" ref={emblaRef}>
                    <div className="embla__container">
                        {Object.values(CATEGORIES).map(
                            // @ts-ignore
                            ({ title, key, hidden }, index) => {
                                if (hidden) return null;
                                return (
                                    <Tag
                                        key={key}
                                        isActive={category === key}
                                        onClick={() => {
                                            handleCarousel(key);
                                        }}
                                    >
                                        {title}
                                    </Tag>
                                );
                            }
                        )}
                    </div>
                </div>
            </div>
            {/* <TabWrapper>
                <Tab
                    isActive={category === ""}
                    onClick={() => {
                        handleSwitchCategory(category);
                    }}
                >
                    {t`FOR_YOU`}
                </Tab>
                <Tab
                    isActive={category === "lastModified"}
                    onClick={() => handleSwitchCategory("lastModified")}
                >
                    {t`LATEST`}
                </Tab>
            </TabWrapper> */}
            <SpaceWrapper
                className="scrollbar-hidden"
                onScroll={handleScroll}
                ref={divRef}
            >
                <Spaces />
            </SpaceWrapper>
        </Container>
    );
}

export default function Explore(props) {
    useEffect(() => {
        // initialize
        props.feed.init();
    }, []);

    return (
        <HomeProvider isFilter>
            <FilterProvider {...props} feed={props.feed}>
                <Explore_Child isMobile={props?.isMobile} />
            </FilterProvider>
        </HomeProvider>
    );
}

const Container = styled.div`
    padding: 14px 24px;
    height: 100%;
    width: 100%;

    ${(props) =>
        IS_MOBILE &&
        css`
            padding: 0px;
            overflow: auto;
            max-height: var(--100-vh);

            &::-webkit-scrollbar {
                display: none;
            }

            -ms-overflow-style: none; /* IE and Edge */
            scrollbar-width: none; /* Firefox */
        `};

    .embla {
        position: relative;
        margin-top: 6px;
        margin-left: auto;
        margin-right: auto;
    }

    .embla__viewport {
        overflow-x: auto;
        width: 100%;

        &::-webkit-scrollbar {
            display: none;
        }

        -ms-overflow-style: none; /* IE and Edge */
        scrollbar-width: none; /* Firefox */
    }

    .embla__viewport.is-draggable {
        cursor: move;
        cursor: grab;
    }

    .embla__viewport.is-dragging {
        cursor: grabbing;
    }

    .embla__container {
        display: flex;
        flex-wrap: nowrap;
        gap: 8px;
        user-select: none;
        -webkit-touch-callout: none;
        -khtml-user-select: none;
        -webkit-tap-highlight-color: transparent;
    }

    .embla__slide {
        padding-left: 10px;
        min-width: 100%;
        position: relative;
    }
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    & > h2 {
        margin: 0px;
        padding: 0px;
        font-style: normal;
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        color: #ffffff;
    }

    & > .icon-right {
        display: flex;
        align-items: center;
        justify-content: flex-start;

        & > .btn-icon {
            background: transparent;
            border: 1px solid transparent;
        }
    }
`;

const Hr = styled.div`
    width: 100%;
    height: 1px;
    opacity: 0.2;
    margin-top: 10px;
    margin-bottom: 16px;
    background: #ffffff;
`;

const Tag = styled.div<{ isActive: boolean }>`
    border-radius: 6px;
    padding: 10px 16px;
    font-weight: 500;
    font-size: 13px;
    line-height: 100%;
    cursor: pointer;
    white-space: nowrap;

    ${(props) =>
        props.isActive
            ? css`
                  color: #070707;
                  background: #f5f5f5;
              `
            : css`
                  color: #ffffff;
                  background: rgba(245, 245, 245, 0.1);
              `}
`;

const TabWrapper = styled.div`
    display: flex;
    margin: 0px 0 5px 0;
`;

const SpaceWrapper = styled.div`
    width: 100%;
    margin-top: 20px;
    overflow-x: auto;
    overflow-y: auto;
    height: calc(var(--100-vh) - 75vh);

    ${(props) =>
        IS_MOBILE &&
        css`
            height: calc(var(--100-vh));
        `};
`;

const InputWrapper = styled.div`
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;

    & > input {
        width: 100%;
        border: none;
        outline: none;
        color: #ffffff;
        background: transparent;
    }

    & > .search-x-icon {
        background: transparent;
        border: 1px solid transparent;
    }
`;

const Tab = styled.p<{
    isActive?: boolean;
}>`
    color: #ffffff;
    cursor: pointer;
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    border-bottom: 2px solid #fff;
    padding-bottom: 8px;
    width: 50%;

    ${(props) => {
        return (
            !props.isActive &&
            css`
                font-weight: 400;
                color: rgba(255, 255, 255, 0.4);
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            `
        );
    }}
`;
