import React from "react";
import { useEditWorld } from "../../context/WorldEditContext";
import { preprocessNftAsset } from "../../utils";
import { AssetListView } from "./AssetListView";
export function AssetList(props: Omit<React.ComponentProps<typeof AssetListView>, "addState" | "placedAssets" | "preprocessNftAsset">) {
    const { addState, placedAssets } = useEditWorld();
    return <AssetListView {...props} addState={addState} placedAssets={placedAssets} preprocessNftAsset={preprocessNftAsset} />;
}
