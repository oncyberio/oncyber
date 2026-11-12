// createBuyOrder,
// fulfillOrder,
// fetchOrders,
// getSellOrders,

import { Asset } from "@uitypes/Asset";
import { WalletConnection } from "./connect";
import { ObjktMarketplace } from "./ObjktMarketplace";
// import { OpenseaMarketplace } from "./OpenseaMarketplace";
import { ReservoirMarketplace } from "./ReservoirMarketplace";
import { Marketplace } from "./types/Marketplace";

export type { AssetEvent } from "./types/AssetEvent";
export type { PriceData, PriceDataItem } from "./types/PriceData";
export type { SellOrder, BuyOrder } from "./types/SellOrder";
export type {
    FullfillError,
    FullfillResult,
    MakeOfferResult,
    Marketplace,
} from "./types/Marketplace";

// const openseaMarketplace = new OpenseaMarketplace();
const reservoirMarketplace = ReservoirMarketplace.getInstance("ethereum");
const reservoirPolygonMarketplace = ReservoirMarketplace.getInstance("polygon");
const objktMarketplace = new ObjktMarketplace();

const marketplaces = {
    // opensea: openseaMarketplace,
    objkt: objktMarketplace,
    // defaults
    ethereum: reservoirMarketplace,
    tezos: objktMarketplace,
};

export function selectMarketplace(
    asset: Pick<Asset, "blockchain" | "marketplace">
) {
    if (asset.marketplace === "matic" || asset.marketplace === "polygon") {
        return reservoirPolygonMarketplace;
    }

    if (asset.blockchain === "ethereum") {
        return reservoirMarketplace;
    }
    return marketplaces[asset.marketplace || asset.blockchain];
}

export function isValidConnection<W extends WalletConnection, O>(
    marketplace: Marketplace<O, W>,
    connection?: WalletConnection
): connection is W {
    if (connection.type === "ethereum") {
        return (
            // marketplace instanceof OpenseaMarketplace ||
            marketplace instanceof ReservoirMarketplace
        );
    }
    if (connection.type === "tezos") {
        return marketplace instanceof ObjktMarketplace;
    }
    return false;
}
