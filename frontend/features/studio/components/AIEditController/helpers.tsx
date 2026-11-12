import {
    AI_ACTIONS,
    IntentAssetTypes,
    IntentScope,
    TIntentFilter,
} from "@features/ai/context/types";

import { SpaceArtwork } from "@components/_3DExhibit-v2/three/factory/artwork/abstract";

import { Portal } from "@components/_3DExhibit-v2/three/factory/portal/portal";

import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";

function getAssetId(asset) {
    return asset?.item?.data?.id;
}

function getPortalId(portal) {
    return portal.userData?.spawn?.portalId;
}

export function getTargets({
    scope = "in_front",
    fetchType,
    type,
    filter,
    count,
    prevContext,
    world,
    selectedMesh,
    idRange,
    adding,
}: {
    scope: IntentScope;
    fetchType: "placeholder" | "artworks" | "portals";
    type?: IntentAssetTypes;
    filter?: TIntentFilter;
    count?: number;
    prevContext: any;
    world: any;
    selectedMesh: any;
    idRange?: number[];
    adding?: boolean;
}) {
    if (selectedMesh) {
        return [selectedMesh];
    }

    if (fetchType === "placeholder") {
    
        if (filter !== undefined) {
            return getTargets({
                scope,
                fetchType:"artworks",
                type,
                filter,
                count,
                prevContext,
                world,
                selectedMesh,
                idRange,
            });
        }

        if (scope === "prev_context") {
            return getPrevContext({ ...prevContext.current, world: world });
        }

        if (scope === "all") {
            return (
                world.current
                    .getPlaceholders({
                        bulkAdd: true,
                    })
                    // clean selected placeholders
                    .map((mesh) => {
                        mesh.showSelected(false);

                        return mesh;
                    })
            );
        }

        const placeholders = world.current
            .getPlaceholders({ scope })
            // clean selected placeholders
            .map((mesh) => {
                mesh.showSelected(false);

                return mesh;
            });

        return placeholders;
    }

    let artworks;

    if (scope === "prev_context") {
        artworks = getPrevContext({ ...prevContext.current, world: world });
    }else{
        artworks = world.current.getArtworks();
    }

    const isPortalFilter = fetchType === "portals" || type === "portal" || filter?.type === "portal"
    if (isPortalFilter) {
        if(adding){
            artworks = world.current.getPlaceholders({ scope });
        }else{
            artworks = world.current.getPortals()
        }
    }

    if(scope === "walls" || scope === "in_front") {
        artworks = world.current.getPlaceholders({ scope, artworks })
    }


    artworks = artworks
        .map((artwork) => {
            if (artwork.isPlaceholder && !adding) return null;
            let searchObject = {
                name: artwork.item?.data?.name,
                creator: (artwork.item?.data?.creator?.user?.username || artwork.item?.data?.creator?.username) + " " + artwork.item?.data?.creator?.address,
                collection: artwork.item?.data?.collection?.name,
                contract: artwork.item?.data?.contract_address,
                description: artwork.item?.data?.description,
            }

            let  { blockchain, type:type2, none, ...searchFilter } = filter ?? {};
            let score = compareObjects(searchObject, searchFilter)
            let condition = score > 0;
            
            if (filter?.blockchain) {
                condition =
                    condition &&
                    artwork?.item?.data?.blockchain?.includes?.(filter.blockchain);
            }

            let finalType = (type2 || type ) as string;

            if(finalType === "artwork") finalType = "";
            if(finalType === "text") finalType = "CYBER_TEXT";
            if(finalType === "website") finalType = "HTML_EMBED";
            if(finalType === "youtube") finalType = "YOUTUBE_EMBED";
            if(finalType === "glb" || finalType === "model") finalType = "MODEL";
            if(finalType === "portal"){
                condition = condition && artwork.isPortal;
            }else if (finalType) {
                condition =
                    condition && searchMatch(finalType, artwork.mediaType);
            }
            
            return [condition ? artwork : null, score];
        })
        .filter((asset) => asset?.[0])
        .sort((a, b) => { return b[1] - a[1] })
        .map((asset) => asset[0]);
    
    if (idRange) {
        artworks = artworks.filter((artwork,index) => {
            return idRange.includes(index);
        });
    }

    return artworks;
}

export function setPrevContext({
    placeholderIds,
    type,
    opts,
    world,
    prevContext,
}: {
    type: "artworks" | "portals";
    placeholderIds?: string[];
    opts?: any;
    world: any;
    prevContext: any;
}) {
    if(opts?.preserve_context) return;
    if (!placeholderIds) {
        prevContext.current = {
            opts,
            type,
        };

        return;
    }

    if (type === "portals") {
        const portals = world.current.getPortals();

        const targetIds = portals
            .filter((portal) => {
                return placeholderIds.includes(
                    portal.userData.spawn.placeholderId
                );
            })
            .map((portal) => getPortalId(portal));

        prevContext.current = {
            opts,
            targets: targetIds,
            type,
        };

        return;
    }

    const artworks = world.current.getArtworks();

    const targetIds = artworks
        .filter((artwork) => {
            return placeholderIds.includes(artwork.userData.placeholderId);
        })
        .map((artwork) => getAssetId(artwork));

    prevContext.current = {
        opts,
        targets: targetIds,
        type,
    };
}

function getPrevContext({ targets, opts, type, world }: any) {
    if (type === "artworks") {
        return world.current.getArtworks().filter((artwork) => {
            return targets.includes(getAssetId(artwork));
        });
    }

    if (type === "portals") {
        return world.current.getPortals().filter((portal) => {
            return targets.includes(getPortalId(portal));
        });
    }

    return [];
}

const searchMatch = (search, name) => {
    if (typeof search == "string") {
        return name?.toLowerCase?.()?.includes(search?.trim()?.toLowerCase?.());
    } else {
        return (
            search?.filter?.((x) =>
                name?.toLowerCase?.().includes(x?.trim?.()?.toLowerCase?.())
            )?.length > 0
        );
    }
};

const compareObjects = (obj1, obj2) => {
    let totalKeys = Object.keys(obj2).length;
    let score = 0;
    if (totalKeys === 0) return 100;
    for (const key in obj2) {
        const valueToSearch = obj2[key];
        for (const keyToCompare in obj1) {
            if (searchMatch(valueToSearch, obj1[keyToCompare])) {
                score += 1;
                if (keyToCompare === key) score += 2;
            }
        }
    }
    return (score / totalKeys) * 100;
}

export function getFilter({
    assets,
    opts,
    maxLength,
}: {
    assets: any;
    opts: any;
    maxLength: number;
}) {
    let assetsToAdd = assets
    if(opts?.random) assetsToAdd = assetsToAdd.sort(() => Math.random() - 0.5);
    assetsToAdd = assetsToAdd
        .map((asset) => {

            let searchObject = {
                name: asset.name,
                creator: (asset.creator?.user?.username || asset.creator?.username) + " " + asset.creator.address,
                collection: asset.collection.name,
                contract: asset.contract_address,
                description: asset.description,
            }

            let  { blockchain, type, none, ...searchFilter } = opts?.filter ?? {};
            
            let score = compareObjects(searchObject, searchFilter)
            let condition = score > 0;
            
            if (opts.filter?.blockchain) {
                condition =
                    condition &&
                    searchMatch(opts.filter.blockchain, asset.blockchain);
            }

            let finalType = opts?.filter?.type || opts?.type;

            if(finalType === "artwork") finalType = "";
            if(finalType === "nft") finalType = "";
            if(finalType === "website") finalType = "HTML";
            if(finalType === "glb" || finalType === "model") finalType = "MODEL";

            if (finalType) {
                condition =
                    condition && searchMatch(finalType, asset.mime_type);
            }

            return [condition ? asset : null, score];
        })
        .filter((asset) => asset[0])
        .sort((a, b) => { return b[1] - a[1] })
        .slice(0, opts.count ? opts.count : maxLength)
        .map((asset) => asset[0]);
    return assetsToAdd;
}
