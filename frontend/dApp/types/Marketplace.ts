import { Asset } from "@uitypes/Asset";
import { Result } from "@utils/js";
import { WalletConnection } from "../connect";
import { AssetEvent } from "./AssetEvent";
import { Ownership } from "./Ownership";
import { PriceData } from "./PriceData";
import { SellOrder, BuyOrder } from "./SellOrder";

export type FullfillError = "INSUFFICIENT_FUNDS" | "DENIED" | "OTHER";

export type FullfillResult =
    | { type: "Success"; data: string }
    | { type: "Error"; errorCode: FullfillError; message?: string };

export type MakeOfferResult =
    | { type: "Success"; data: any }
    | { type: "Error"; message: string };

export interface Marketplace<
    O = any,
    W extends WalletConnection = WalletConnection
> {
    name: string;
    getSellOrder(asset: Asset): Promise<SellOrder<O>>;
    getSellOrders(asset: Asset): Promise<SellOrder<O>[]>;
    getBuyOrders(asset: Asset): Promise<BuyOrder[]>;
    // sell(asset: Asset, wallet: W);
    fullfillOrder(
        order: SellOrder<O>,
        wallet: W,
        onStartTransaction: (hash: string) => void
    ): Promise<FullfillResult>;
    makeOffer(
        asset: Asset,
        wallet: W,
        amount: number,
        onStartTransaction: (hash: string) => void
    ): Promise<MakeOfferResult>;

    getAssetHistory?: (
        asset: Asset,
        abort?: AbortSignal
    ) => Promise<Result<AssetEvent[]>>;

    getPriceData?: (
        asset: Asset,
        abort?: AbortSignal
    ) => Promise<Result<PriceData>>;

    getCollectionFloorPrices?: (
        address: string
    ) => Promise<Result<Record<string, number>>>;

    getOwners?: (
        asset: Asset,
        abort?: AbortSignal
    ) => Promise<Result<Ownership[]>>;
}
