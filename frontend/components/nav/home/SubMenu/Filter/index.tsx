import { FILTERS, useFilter } from "@components/context/FilterContext";
import { useHome } from "@components/context/HomeContext";
import { useOnClickOutside } from "@components/hooks/useClickOutside";

import { Divider } from "@ui/components/Divider";

import IconImg from "@ui/components/IconImg";
import { NButton } from "@ui/components/NButton";
import { formatWalletAddress } from "@utils/format";

import styled from "styled-components";

import { MaxWrapper, RoundNum } from "../../shared";

export default function Filter() {
    const { applyFilter, filters, resetFilter, feed, searchFilters } =
        useFilter();

    const { openedMenu, handleToggle, filterTab, handleFilterTab } = useHome();

    const { clickRef, addTogglerRef } = useOnClickOutside({
        handler: () => {
            // Close only in desktop
            if (window.innerWidth > 780) {
                handleFilterTab("");
            }
        },
    });

    function handleOpenFilterTab(type) {
        if (openedMenu !== "filter") {
            handleToggle("filter");
        }

        handleFilterTab(type);

        if (filterTab === type) {
            handleToggle("filter");
        }
    }

    return (
        <Container>
            <DesktopWrapper>
                <Text>Filter by:</Text>

                {FILTERS.map(({ key, title }, index) => {
                    return (
                        <DropdownOpener
                            key={index}
                            ref={(el) => addTogglerRef(key, el)}
                            onClick={() => {
                                handleOpenFilterTab(key);
                            }}
                        >
                            <span>{title}</span>{" "}
                            {Object.keys(filters[key]).length > 0 ? (
                                <RoundNum>
                                    {Object.keys(filters[key]).length}
                                </RoundNum>
                            ) : key === filterTab ? (
                                <IconImg size={16} name="chevron-up" />
                            ) : (
                                <IconImg size={16} name="chevron-down" />
                            )}
                        </DropdownOpener>
                    );
                })}

                {searchFilters.flatMap((d) => d).length ? (
                    <>
                        <Divider
                            direction="vertical"
                            style={{
                                background: "rgba(7, 7, 7, 0.2)",
                                height: 32,
                            }}
                        />

                        <IconWrapper>
                            <IconImg size={14} name="refresh-cw" />
                            <div onClick={resetFilter}>Clear filters</div>
                        </IconWrapper>
                    </>
                ) : null}
            </DesktopWrapper>
            {filterTab ? (
                <FilterTabContainer ref={clickRef}>
                    <MaxWrapper>
                        <SelectionWrapper>
                            {feed?.spaceHits?.facets?.[filterTab]?.map?.(
                                ({ id, total }) => {
                                    const title =
                                        filterTab === "owner"
                                            ? feed?.owners?.[id]?.username
                                                ? feed?.owners?.[id]?.username
                                                : formatWalletAddress(id)
                                            : id;

                                    return (
                                        <NButton
                                            key={id}
                                            outline={!filters[filterTab]?.[id]}
                                            onClick={() =>
                                                applyFilter(filterTab, id)
                                            }
                                        >
                                            {title} ({total})
                                        </NButton>
                                    );
                                }
                            )}
                        </SelectionWrapper>
                    </MaxWrapper>
                </FilterTabContainer>
            ) : null}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const DesktopWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 42px;
`;

const Text = styled.div`
    font-weight: 400;
    font-size: 12px;
    color: #070707;
`;

const DropdownOpener = styled.div`
    display: flex;
    position: relative;
    cursor: pointer;

    font-weight: 400;
    font-size: 12px;
    text-transform: uppercase;

    color: #070707;

    .icon-img {
        position: absolute;
        right: -20px;
        // top: 2px;
    }
`;

const IconWrapper = styled.div`
    display: flex;
    position: relative;
    cursor: pointer;
    margin-left: 12px;
    font-weight: 400;
    font-size: 12px;
    text-transform: uppercase;
    color: #070707;

    .icon-img {
        position: absolute;
        left: -22px;
        top: 0;
    }
`;

const FilterTabContainer = styled.div`
    position: absolute;
    top: 100%;
    background: #fff;
    left: 0;
    width: 100%;
    padding: 24px;
    display: flex;
    border-top: 1px solid rgba(7, 7, 7, 0.2);
    border-bottom: 1px solid rgba(7, 7, 7, 0.2);
    justify-content: center;
    z-index: var(--zIndex_nav-filter-desktop-tab);
`;

const SelectionWrapper = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
`;
