import { FILTERS, useFilter } from "@components/context/FilterContext";
import { useHome } from "@components/context/HomeContext";
import { IconButton } from "@ui/components/IconButton.tsx";
import IconImg from "@ui/components/IconImg";
import { NButton } from "@ui/components/NButton";
import { formatWalletAddress } from "@utils/format";
import styled from "styled-components";
import { RoundNum, SubMenuWrapper } from "../../shared";

export default function MobileFilter() {
    const { filterTab, filters, resetFilter, feed, applyFilter } = useFilter();

    const { openedMenu, handleToggle, handleFilterTab } = useHome();

    function handleOpenFilterTab(type) {
        handleFilterTab(type);
    }

    return (
        <Container>
            {openedMenu === "filter" ? (
                <Wrapper>
                    <Header>
                        <p>Filter By</p>
                        <div
                            style={{ cursor: "pointer" }}
                            onClick={() => handleToggle("filter")}
                        >
                            <IconImg name="x" mode="dark" />
                        </div>
                    </Header>

                    <SubMenuWrapper
                        style={{
                            flexDirection: "column",
                            justifyContent: "space-between",
                            display: "flex",
                            borderTop: "1px solid rgba(7, 7, 7, 0.2)",
                        }}
                    >
                        <div>
                            {FILTERS.map(({ key, title }, index) => {
                                return (
                                    <div key={index}>
                                        <TypeWrapper
                                            onClick={() => {
                                                handleOpenFilterTab(key);
                                            }}
                                        >
                                            <h3>{title}</h3>
                                            {Object.keys(filters[key]).length >
                                            0 ? (
                                                <RoundNum
                                                    style={{
                                                        position: "relative",
                                                        top: "auto",
                                                        right: "auto",
                                                    }}
                                                >
                                                    {
                                                        Object.keys(
                                                            filters[key]
                                                        ).length
                                                    }
                                                </RoundNum>
                                            ) : key === filterTab ? (
                                                <IconImg
                                                    size={18}
                                                    name="chevron-up"
                                                />
                                            ) : (
                                                <IconImg
                                                    size={18}
                                                    name="chevron-down"
                                                />
                                            )}
                                        </TypeWrapper>
                                        {filterTab === key ? (
                                            <div>
                                                {/* <Header>
                                                <h3>Sort by</h3>
                                                <p>Alphabetical</p>
                                                <p>Popular</p>
                                            </Header> */}
                                                <FilterOptionsWrapper>
                                                    {feed?.spaceHits?.facets?.[
                                                        filterTab
                                                    ].map(({ id, total }) => {
                                                        const title =
                                                            filterTab ===
                                                            "owner"
                                                                ? feed
                                                                      ?.owners?.[
                                                                      id
                                                                  ]?.username
                                                                    ? feed
                                                                          ?.owners?.[
                                                                          id
                                                                      ]
                                                                          ?.username
                                                                    : formatWalletAddress(
                                                                          id
                                                                      )
                                                                : id;
                                                        return (
                                                            <NButton
                                                                key={id}
                                                                outline={
                                                                    !filters[
                                                                        filterTab
                                                                    ]?.[id]
                                                                }
                                                                onClick={() =>
                                                                    applyFilter(
                                                                        filterTab,
                                                                        id
                                                                    )
                                                                }
                                                            >
                                                                {title} ({total}
                                                                )
                                                            </NButton>
                                                        );
                                                    })}
                                                </FilterOptionsWrapper>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>

                        <Footer>
                            <NButton
                                onClick={() => {
                                    resetFilter();
                                }}
                                outline
                                style={{
                                    width: "50%",
                                    display: "flex",
                                    justifyContent: "center",
                                }}
                            >
                                <IconImg size={18} name="refresh-cw" />
                                <span>Clear filters</span>
                            </NButton>
                            <NButton
                                style={{
                                    width: "50%",
                                    display: "flex",
                                    justifyContent: "center",
                                }}
                                onClick={() => handleToggle("filter")}
                            >
                                <IconImg size={18} mode="light" name="filter" />
                                <span>Apply filter</span>
                            </NButton>
                        </Footer>
                    </SubMenuWrapper>
                </Wrapper>
            ) : null}

            {!openedMenu ? (
                <FilterBtnWrapper>
                    <NButton
                        onClick={() => {
                            handleToggle("filter");
                            // handleOpenFilterTab("chains");
                        }}
                    >
                        <IconImg size={18} mode="light" name="filter" />
                        <span>Filter by</span>
                    </NButton>
                </FilterBtnWrapper>
            ) : null}
        </Container>
    );
}

const Container = styled.div`
    position: relative;
    height: 100%;
    z-index: var(--zIndex_nav-submenu);

    p {
        margin: 0;
    }

    @media (min-width: 780px) {
        display: none;
    }
`;

const FilterBtnWrapper = styled.div`
    position: fixed;
    bottom: 15px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--zIndex_nav-filter-mobile-button);
`;

const Wrapper = styled.div`
    position: fixed;
    height: var(--100-vh);
    width: 100%;
    top: 0;
    left: 0;
    background: #fff;
`;

const Header = styled.div`
    height: 80px;
    background: #fff;
    width: 100%;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(7, 7, 7, 0.2);
    font-weight: 400;
`;

const Footer = styled.div`
    display: flex;
    gap: 12px;
    justify-content: space-between;
    border-top: 1px solid rgba(7, 7, 7, 0.2);
    padding-top: 24px;
    position: sticky;
    bottom: 0;
    left: 0;
    background: #fff;
    padding-bottom: 24px;
`;

const TypeWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-transform: uppercase;

    font-weight: 400;
    font-size: 20px;

    color: #070707;

    h3 {
        font-weight: 500;
    }
`;

const FilterOptionsWrapper = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    border-bottom: 1px solid rgba(7, 7, 7, 0.2);
    padding-bottom: 24px;
`;
