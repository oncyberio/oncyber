import styled from "styled-components";
import { SearchInput } from "../shared/SearchInput";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useMemo, useState } from "react";
import { cloudinary } from "@utils/urlUtils";
import { useEditWorld } from "../../context/WorldEditContext";
import { useStylekit } from "@components/hooks/useStylekit";
import { KitbashAssets } from "./Kits3DTab/KitbashAssets";
import { Section } from "./Section";
import { Component } from "./ComponentsTab/Component";
import { useEventCallback } from "@components/hooks/useEventCallback";
import ReactDOM from "react-dom";
import { EMPTY_ROOM } from "@utils/emptyRoom";
import { ToggleTab } from "./ToggleTab";
import { ComponentsTab } from "./ComponentsTab";
import { Kits3DTab } from "./Kits3DTab";

export function WorldEditor({ tab }: { tab: "Scene" | "Kits" }) {
    //
    const { exhibit, scope } = useEditWorld();

    // const [selectedTab, setSelectedTab] = useState("Scene");

    // const handleChangeTab = useEventCallback((value) => {
    //     //
    //     setSelectedTab(value);
    // }, []);

    // if (scope === "uploader") {
    //     //
    //     return <KitbashAssets query={query} kit={exhibit.info.room} />;
    // }

    return (
        <Container>
            {/* <ToggleTab
                value1={"Scene"}
                value2={scope === "uploader" ? "Kit Assets" : "3D Kits"}
                selected={selectedTab}
                onChange={handleChangeTab}
            /> */}
            {tab === "Scene" ? (
                <ComponentsTab key={"Scene"} />
            ) : scope === "uploader" ? (
                <KitbashAssets kit={exhibit.info.room} />
            ) : (
                <Kits3DTab key={"Kits3D"} />
            )}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.5em;
    /* height: 420px; */
`;
