import styled, { useTheme } from "styled-components";
import EmptyState, { surfaceOfTheme } from "@ui/components/EmptyState";

import { Tabs, Headers, Header } from "../style/Tabs";

import { formatUser } from "../utils";
import { Title } from "../style/Title";
import { useContext, useEffect, useId, useState } from "react";
import { Vert } from "../style/Flex";
import { Offers } from "./Offers";
import { Listings } from "./Listings";
import { useArtworkInfo } from "./ArtworkContext";
import { AssetPreview } from "./AssetPreview";
import { UserContext } from "@components/context/UserContext";
import { AssetHistory } from "./AssetHistory";
import Ownership from "./Ownership";
import CuratorNotes from "./CuratorNotes";
import { ArtworkSummary } from "../../ArtworkSummary";

// export interface ArtworkInfoProps {
//     loading: boolean;
//     asset: Asset;
//     offers: BuyOrder[];
//     listings: SellOrder<unknown>[];
// }

enum TabName {
    // ArtistInfo,
    // Price,
    History,
    Listing,
    Offers,
    // PriceHistory,
    CuratorNotes,
}

export function AssetInfo({ assetInfoRef, themeDark = false }) {
    const { user, userData } = useContext(UserContext);

    const [showMore, setShowMore] = useState(false);
    const panelId = useId();

    const {
        type,
        asset,
        buyOrders,
        sellOrders,
        refreshAssetLoading: loading,
        fetchPriceData,
        assetType,
    } = useArtworkInfo();

    const [activeTab, setActiveTab] = useState<TabName>(
        asset?.source?.blockchain === "none" ? null : TabName.History
    );

    const theme = useTheme() as any;

    const isActive = (tab) => tab === activeTab;

    const onTabClick = (tab: TabName) => () => {
        setActiveTab(tab);
    };

    let content = null;

    if (loading) {
        content = "Loading data…";
    } else if (activeTab === TabName.History) {
        content = <AssetHistory />;
    } else if (activeTab === TabName.Offers) {
        content = <Offers offers={buyOrders} />;
    } else if (activeTab === TabName.Listing) {
        content = <Listings listings={sellOrders} />;
    } else if (activeTab === TabName.CuratorNotes) {
        content = <CuratorNotes text={asset?.curatorNotes} />;
    } else if (assetType !== "Nft") {
        content = <></>;
    } else {
        content = (
            <EmptyState
                surface={themeDark ? "dark" : surfaceOfTheme(theme)}
                icon="activity"
                title="No market data yet."
            />
        );
    }

    const title =
        asset?.name ||
        (asset?.collection?.name &&
            `${asset.collection.name} #${asset.token_id ?? ""}`) ||
        asset?.contract_address ||
        "Untitled artwork";

    const headerTheme = themeDark
        ? {
              theme: {
                  color: "#fff",
                  tab: {
                      header: { color: "#999999" },
                  },
              },
          }
        : {};

    return (
        <Container
            ref={assetInfoRef}
            className="artwork-asset-info scrollbar-hidden"
        >
            {type === "3d" ? (
                <ArtworkSummary asset={asset} />
            ) : (
                <Title as="h2" title={title}>
                    {title}{" "}
                </Title>
            )}
            {/** TODO: Add hashtag data */}
            {/* <Tags tags={[]} /> */}
            {type != "3d" && (
                <div className="mobile">
                    <AssetPreview />
                </div>
            )}

            <Ownership id="asset-info-ownership" asset={asset} />

            <>
                {type !== "3d" && asset?.description && (
                    <>
                        <Description className="artwork-description">
                            <div className="label">Description</div>
                            <p className="text">
                                {showMore
                                    ? asset.description
                                    : asset.description.substring(0, 100)}
                                {asset.description.length > 100 && (
                                    <>
                                        {" "}
                                        <DescriptionToggle
                                            type="button"
                                            aria-expanded={showMore}
                                            onClick={() =>
                                                setShowMore((value) => !value)
                                            }
                                        >
                                            {showMore
                                                ? "Show less"
                                                : "Show more"}
                                        </DescriptionToggle>
                                    </>
                                )}
                            </p>
                        </Description>
                    </>
                )}

                <Hr />

                {asset?.mime_type !== "embed/youtube" ? (
                    <TabsContainer
                        id="asset-info-tabs"
                        className="artwork-tabs"
                        gap="1rem"
                        style={{ marginTop: "24px" }}
                    >
                        <StyledHeaders
                            id="asset-info-tab-headers"
                            role="tablist"
                            aria-label="Artwork information"
                            onKeyDown={(event) => {
                                if (
                                    ![
                                        "ArrowLeft",
                                        "ArrowRight",
                                        "Home",
                                        "End",
                                    ].includes(event.key)
                                )
                                    return;
                                const tabs = Array.from(
                                    event.currentTarget.querySelectorAll<HTMLButtonElement>(
                                        "button:not([hidden])"
                                    )
                                );
                                const index = tabs.indexOf(
                                    event.target as HTMLButtonElement
                                );
                                if (index < 0 || !tabs.length) return;
                                event.preventDefault();
                                const next =
                                    event.key === "Home"
                                        ? 0
                                        : event.key === "End"
                                        ? tabs.length - 1
                                        : (index +
                                              (event.key === "ArrowRight"
                                                  ? 1
                                                  : -1) +
                                              tabs.length) %
                                          tabs.length;
                                tabs[next].focus();
                                tabs[next].click();
                            }}
                        >
                            <Header
                                {...headerTheme}
                                active={isActive(TabName.History)}
                                role="tab"
                                aria-selected={isActive(TabName.History)}
                                aria-controls={panelId}
                                id={`${panelId}-History`}
                                tabIndex={isActive(TabName.History) ? 0 : -1}
                                onClick={onTabClick(TabName.History)}
                                hidden={asset?.source?.blockchain === "none"}
                            >
                                History
                            </Header>
                            <Header
                                {...headerTheme}
                                active={isActive(TabName.Listing)}
                                role="tab"
                                aria-selected={isActive(TabName.Listing)}
                                aria-controls={panelId}
                                id={`${panelId}-Listing`}
                                tabIndex={isActive(TabName.Listing) ? 0 : -1}
                                onClick={onTabClick(TabName.Listing)}
                                hidden={!sellOrders?.length}
                            >
                                Listings
                            </Header>
                            <Header
                                {...headerTheme}
                                active={isActive(TabName.Offers)}
                                role="tab"
                                aria-selected={isActive(TabName.Offers)}
                                aria-controls={panelId}
                                id={`${panelId}-Offers`}
                                tabIndex={isActive(TabName.Offers) ? 0 : -1}
                                onClick={onTabClick(TabName.Offers)}
                                hidden={!buyOrders?.length}
                            >
                                Offers
                            </Header>
                            <Header
                                {...headerTheme}
                                active={isActive(TabName.CuratorNotes)}
                                role="tab"
                                aria-selected={isActive(TabName.CuratorNotes)}
                                aria-controls={panelId}
                                id={`${panelId}-CuratorNotes`}
                                tabIndex={
                                    isActive(TabName.CuratorNotes) ? 0 : -1
                                }
                                onClick={onTabClick(TabName.CuratorNotes)}
                                hidden={!asset?.curatorNotes}
                            >
                                Curator Notes
                            </Header>
                        </StyledHeaders>
                        <Content
                            role="tabpanel"
                            id={panelId}
                            aria-labelledby={
                                activeTab === null
                                    ? undefined
                                    : `${panelId}-${TabName[activeTab]}`
                            }
                        >
                            {content}
                        </Content>
                    </TabsContainer>
                ) : null}
            </>
        </Container>
    );
}

const Container = styled(Vert)`
    flex: 1;
    padding: 0 16px;
    overflow-y: auto;
    overflow-x: hidden;
    margin-bottom: 0px;

    @media (min-width: 1368px) {
        padding: 0;
    }
`;

const TabsContainer = styled(Tabs)`
    height: auto;
`;

const Content = styled(Vert)`
    flex: 1;
    align-items: stretch;
    justify-content: flex-start;

    @media (min-width: 1368px) {
        padding: 0;
        max-height: 240px;
    }
`;

const Description = styled.div`
    margin: 24px 0 0 0;
    flex: 0;

    & > .label {
        color: ${({ theme }) => theme.label.color};
    }

    a {
        color: #ffffff;
        font-size: 16px;
    }

    & > .text {
        font-size: 15px;
        color: #c2c2c2;
        font-weight: 400;
        margin-top: 0.5em;
        line-height: 24px;
        padding-right: 20px;
        padding-bottom: 10px;

        @media (min-width: 1368px) {
            max-height: 130px;
            overflow-y: scroll;
            display: -webkit-box !important;
            white-space: normal;

            ::-webkit-scrollbar {
                width: 5px;
                background-color: transparent;
            }

            ::-webkit-scrollbar-thumb {
                border-radius: 8px;
                background-color: #333333;
            }
        }
    }
`;

const Hr = styled.div`
    width: 100%;
    border-top: 1px solid;
    border-color: var(--oc-line-strong, #5c5c5c);

    @media (max-width: 830px) {
        display: none;
    }
`;

const StyledHeaders = styled.div`
    overflow-x: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: var(--oc-canvas, transparent);
    border-radius: 12px;
    flex-shrink: 0;

    & > button {
        white-space: nowrap;
        width: auto;
    }

    ::-webkit-scrollbar {
        height: 4px;
        background-color: transparent;
    }

    ::-webkit-scrollbar-thumb {
        border-radius: 8px;
        background-color: #dddddd;
    }
`;

const DescriptionToggle = styled.button`
    display: inline;
    padding: 0;
    border: 0;
    background: none;
    color: var(--oc-ink, #ffffff);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
`;
