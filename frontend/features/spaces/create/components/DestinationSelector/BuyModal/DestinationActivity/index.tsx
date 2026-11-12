import { useNftBuyContext } from "@components/context/NftBuyContext";
import { useState, useMemo } from "react";
import styled from "styled-components";
import { baseTokens as base } from "@styles/tokens";
import { Activity } from "./Activity";
import { Offers } from "./Offers";
import { PriceHistory } from "./PriceHistory";

const cls = (className: string) => (enabled: boolean) => {
    return enabled ? className : "";
};

const $active = cls("active");

const tabsData = [
    {
        id: "activity",
        title: "Activity",
    },
    {
        id: "offers",
        title: "Offers",
    },
    {
        id: "history",
        title: "Price history",
    },
] as const;

type Tabs = typeof tabsData;

type Tab = Tabs[number]["id"];

export function DestinationActivity() {
    //
    const { fetchPriceData, assetHistory } = useNftBuyContext();

    const [activeTab, setActiveTab] = useState<Tab>("activity");

    if (assetHistory.status === "error" && activeTab === "activity") {
        setActiveTab("offers");
    }

    const tabs = useMemo(() => {
        return tabsData.map((tab) => {
            return (
                <div
                    className={`tab ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => {
                        setActiveTab(tab.id);

                        if (tab.id === "history") {
                            fetchPriceData();
                        }
                    }}
                >
                    {tab.title}
                </div>
            );
        });
    }, [tabsData, activeTab, setActiveTab]);

    let content = null;

    if (activeTab === "activity") {
        content = <Activity />;
    } else if (activeTab === "offers") {
        content = <Offers />;
    } else {
        content = <PriceHistory />;
    }

    return (
        <Container>
            <div className="tab-headers">{tabs}</div>
            <div className="body">{content}</div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-top: 6px;

    height: 100%;
    flex: 0;

    & > .tab-headers {
        display: flex;
        flex-direction: row;

        & > .tab {
            font-weight: 500;
            font-size: 14px;
            line-height: 14px;
            color: ${base.color.muted};
            padding: 0 1rem 0 0;
            cursor: pointer;
        }

        & > .tab.active {
            color: var(--title-color);
        }
    }

    /* & > .body {
        overflow-y: auto;
        height: 250px;
    } */

    @media (min-width: 1200px) {
        & > .body {
            overflow-y: auto;
            height: 250px;
        }
    }
`;
