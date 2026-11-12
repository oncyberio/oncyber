import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useMemo } from "react";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { resize } from "@utils/urlUtils";
import { getAssetName, getAssetPreviewImg } from "@features/studio/utils";
import { getAssetType } from "../../utils";
import { useCurrentKit } from "./useCurrentKit";
import { AddAssetOpts, AssetType, TriggerZoneOpt } from "../shared/AssetTypes";
import React from "react";

export function getExhibitPreview(exhibit) {
    //
    let url = exhibit?.info?.cHeroImg || "/images/sq_image_placeholder.png";

    url = resize(url, 20);

    return url;
}

export const SpaceItemsOptions = AddAssetOpts
    // Avatar library entries are ordinary models in the Uploads group.
    .filter((it) => it.value !== "avatar")
    .map((it) => {
        //
        let title = it.value === "component" ? "Components" : it.title;

        // transform size of react icon
        let icon = React.cloneElement(it.icon, {
            size: 16,
        });

        return {
            ...it,
            title,
            icon,
        };
        //
    }) as any as typeof AddAssetOpts;

export interface SpaceItemInfo<T = any> {
    id: string;
    name: string;
    image: string;
    icon?: React.ReactElement;
    group?: string;
    hint: string;
    type: string;
    isRequired: boolean;
    item: T;
    children?: SpaceItemInfo[];
}

export type SpaceItems = Record<AssetType, SpaceItemInfo[]>;

export type SpaceItemTypes = keyof SpaceItems;

export type SpaceItemsFilter = Record<SpaceItemTypes, boolean>;

function match(
    query: string,
    filter: SpaceItemsFilter,
    name: string,
    type: string
) {
    //
    if (!filter[type]) return false;

    if (!query) return true;

    return name.toLowerCase().includes(query.toLowerCase());
}

function matchGroup(
    group: SpaceItemInfo,
    query: string,
    filter: SpaceItemsFilter
) {
    //
    const filteredItems = group.children.filter((it) => {
        //
        return match(query, filter, it.name, group.type);
    });

    return {
        ...group,
        children: filteredItems,
    };
}

function addAll(its: SpaceItemInfo[], result: SpaceItemInfo[]) {
    //
    for (let i = 0; i < its.length; i++) {
        //
        const item = its[i];

        result.push(item);

        if (item.children) {
            addAll(item.children, result);
        }
    }
}

export function mapOpts<K>(
    fn: (it: AssetType) => K,
    opts = SpaceItemsOptions
): Record<AssetType, K> {
    //
    const result = {} as Record<AssetType, K>;

    opts.forEach((it) => {
        //
        result[it.value] = fn(it.value);
    });

    return result;
}

export function useSpaceItems(query: string, filter: SpaceItemsFilter) {
    //
    const { exhibit } = useCurrentExhibit();

    const world = useWorld();

    const kit = useCurrentKit();

    const kitImages = kit?.kitbashImgs;

    const wrapper = world.current.getFutureWrapper();

    const components = wrapper.components;

    const kitbashes = wrapper.kitbashes;

    const artworks = world.current.getArtworks();

    const portals = world.current.getPortals();

    const result = useMemo(() => {
        //
        let groupMap: Record<string, SpaceItemInfo[]> = {};

        let groups = SpaceItemsOptions.map((opt) => {
            //
            const it: SpaceItemInfo = {
                id: opt.value,
                type: opt.value,
                name: opt.title,
                icon: opt.icon,
                image: "",
                hint: "",
                isRequired: false,
                item: null,
                children: [],
            };

            groupMap[opt.value] = it.children;

            return it;
        });

        let hasType = mapOpts(() => false);

        let totalByType = mapOpts(() => 0);

        let total = 0;

        for (let i = 0; i < artworks.length; i++) {
            //
            const artwork = artworks[i];

            if (artwork.isPlaceholder) continue;

            const asset = artwork.userData as any;

            const name = getAssetName(asset);

            const type = getAssetType(artwork).value;

            hasType[type] = true;

            totalByType[type]++;

            total++;

            // if (!match(query, filter, name, type)) continue;

            const image = getAssetPreviewImg(asset);

            const item: SpaceItemInfo = {
                id: artwork.userData.id,
                type,
                group: type,
                name,
                image,
                hint: "",
                isRequired: false,
                item: artwork,
            };

            groupMap[type].push(item);
        }

        for (let i = 0; i < portals.length; i++) {
            //
            const portal = portals[i];

            const targetExhibit = portal.portalData?.exhibit;

            const image = getExhibitPreview(targetExhibit);

            const name =
                targetExhibit?.info?.headline ||
                portal.opts.exhibitId ||
                "Untitled";

            hasType.portal = true;

            totalByType.portal++;

            total++;

            // if (!match(query, filter, name, "portal")) continue;

            const item: SpaceItemInfo = {
                id: portal.userData.id,
                type: "portal",
                group: "portal",
                name,
                image,
                hint: "",
                isRequired: false,
                item: portal,
            };

            groupMap.portal.push(item);
        }

        for (let i = 0; i < components.length; i++) {
            //
            const component = components[i];

            const group = component.group ?? "component";

            const item: SpaceItemInfo = {
                id: component.data.id,
                type: component.componentType,
                group,
                name: component.data.name ?? component.title,
                image: component.image,
                hint: component.hint,
                isRequired: component.isRequired,
                item: component,
            };

            hasType[group] = true;

            totalByType[group]++;

            groupMap[group].push(item);

            total++;
        }

        let kitbashesByType = {};

        for (let i = 0; i < kitbashes.length; i++) {
            //
            const kitEl = kitbashes[i];

            totalByType.component++;

            total++;

            // if (!match(query, filter, kitEl.title, "component")) continue;

            const image = kitImages?.[kitEl.data.type];

            const category = kitEl.title;

            const item: SpaceItemInfo = {
                id: kitEl.data.id,
                type: kitEl.data.type,
                name: kitEl.title,
                group: category,
                image,
                hint: kitEl.hint,
                isRequired: false,
                item: kitEl,
            };

            if (!kitbashesByType[category]) {
                //
                kitbashesByType[category] = [];
            }

            kitbashesByType[category].push(item);
        }

        for (let cat in kitbashesByType) {
            //

            const instances = kitbashesByType[cat];

            if (instances.length === 0) continue;

            const item = instances[0];

            if (instances.length === 1) {
                groupMap.kitbash.push({
                    ...item,
                    name: cat,
                });
            } else {
                groupMap.kitbash.push({
                    id: cat,
                    type: item.type,
                    group: "kitbash",
                    name: cat,
                    image: item.image,
                    hint: "",
                    isRequired: false,
                    item: null,
                    children: instances,
                });
            }
        }

        return { groups, hasType, totalByType, total };
    }, [
        exhibit.artworks,
        exhibit.portals,
        exhibit.kitbash,
        artworks.length,
        portals.length,
        components.length,
        kitbashes.length,
        kitImages,
    ]);

    const filtered = useMemo(() => {
        //

        const { groups } = result;

        let filteredGroups = [];

        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];

            const filteredGroup = matchGroup(group, query, filter);

            if (filteredGroup.children.length > 0) {
                filteredGroups.push(filteredGroup);
            }
        }

        let filteredItems: SpaceItemInfo[] = [];

        addAll(filteredGroups, filteredItems);

        return { filteredGroups, filteredItems };

        //
    }, [query, filter, result]);

    return { ...result, ...filtered };
}
