import { usePlacedAssets } from "@components/hooks/usePlacedAssets";
import { useAssetsContext } from "@features/studio/EditWorldMenu/context/AssetsContext";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { partition } from "lodash";
import { useMemo, useRef } from "react";
import { getNftId } from "../../utils";
import { useRemoteAssetsQuery } from "./useRemoteAssetsQuery";

function hasText(s: string, pattern: string) {
    if (!s) return false;
    return s?.toLowerCase?.()?.includes?.(pattern);
}

export function useContentAssets(query: string, exhibit, chain = null) {
    //
    // const { exhibit } = useEditWorld();

    const placedAssets = usePlacedAssets(exhibit);

    const { currentUserAssets } = useAssetsContext();

    const queriedAssets = useRemoteAssetsQuery(query, chain);

    const isRemoteQuery = queriedAssets != null;

    const assetsData = isRemoteQuery ? queriedAssets : currentUserAssets;

    const shownAssets = useMemo(() => {
        //
        let assets = assetsData?.data?.assets || [];

        // 1- Apply local search
        if (query && !isRemoteQuery) {
            assets = assets.filter((asset) => {
                return (
                    hasText(asset.name, query) ||
                    hasText(asset.collection?.name, query) ||
                    hasText(asset.token_id, query)
                );
            });
        }

        // 3- prioritize non placed assets
        const [placed, nonPlaced] = partition(assets, (it) => {
            return placedAssets[getNftId(it)];
        });

        return nonPlaced.concat(placed);
        //
    }, [assetsData?.data?.assets, query, isRemoteQuery, placedAssets]);

    return {
        currentUserAssets,
        queriedAssets,
        isRemoteQuery,
        assetsData,
        shownAssets,
    };
}
