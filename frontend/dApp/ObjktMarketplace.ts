import {
    BuyOrder,
    FullfillError,
    FullfillResult,
    MakeOfferResult,
    Marketplace,
    PriceData,
    PriceDataItem,
    SellOrder,
} from "./Marketplace";
import { Asset } from "@uitypes/Asset";
import { TezosConnection } from "./connect";
import { Failure, Result, Success } from "@utils/js";
import { fetchEventsById } from "@utils/tezosAssets";

type ObjktOrder = SellOrder<any>;

const OBJKT_CONTRACT_V1 = "KT1FvqJwEDWb1Gwc55Jd1jjTHRVWbYKUUpyq";

const OBJKT_CONTRACT_V2 = "KT1WvzYHCNBvDSdwafTHv7nJ1dWmZ8GCYuuC";

const MUTEZ_PER_TEZOS = 1_000_000;

export class ObjktMarketplace
    implements Marketplace<ObjktOrder, TezosConnection>
{
    name = "objkt.com";

    async makeOffer(
        asset: Asset,
        wallet: TezosConnection,
        // this is Tezos
        price: number,
        onStartTransaction: (hash: string) => void
    ): Promise<MakeOfferResult> {
        try {
            const rawAsset = asset.raw_asset;

            const amount = price * MUTEZ_PER_TEZOS;
            const shares = rawAsset.royalties.map((r: any) => {
                const amount = r.amount * 10 ** (4 - r.decimals);
                return {
                    recipient: r.receiver_address,
                    amount,
                };
            });

            const c = await wallet.tezos.wallet.at(OBJKT_CONTRACT_V2);
            // cf https://better-call.dev/mainnet/KT1WvzYHCNBvDSdwafTHv7nJ1dWmZ8GCYuuC/interact?entrypoint=offer
            const tx = await c.methods
                .offer(
                    // token { address, token_id }
                    rawAsset.fa.contract,
                    rawAsset.token_id,
                    // currency : { tez: null }
                    "tez",
                    null,
                    //
                    amount,
                    shares,
                    null, // expiry_time
                    null, // target
                    null // proxy
                )
                .send({
                    amount,
                    mutez: true,
                    storageLimit: 310,
                });

            onStartTransaction(tx.opHash);

            await tx.receipt();
            return {
                type: "Success",
                data: "Done!",
            };
        } catch (error) {
            console.error(error);
            return handleError(error);
        }
    }
    async getSellOrders(asset: Asset): Promise<ObjktOrder[]> {
        return asset.sell_orders?.map((order) => this.formatSellOrder(order));
    }

    async getSellOrder(asset: Asset): Promise<ObjktOrder> {
        return this.getSellOrders(asset)?.[0];
    }

    async getBuyOrders(asset: Asset): Promise<BuyOrder[]> {
        return asset.buy_orders?.map((order) => this.formatBuyOrder(order));
    }

    async fullfillOrder(
        objkOrder: ObjktOrder,
        wallet: TezosConnection,
        onStartTransaction: (hash: string) => void
    ): Promise<FullfillResult> {
        try {
            const c = await wallet.tezos.wallet.at(OBJKT_CONTRACT_V1);
            const tx = await c.methods
                .fulfill_ask(objkOrder.nativeOrder.id)
                .send({
                    amount: objkOrder.nativeOrder.price,
                    mutez: true,
                    storageLimit: 310,
                });
            onStartTransaction(tx.opHash);
            await tx.receipt();
            return {
                type: "Success",
                data: "Done!",
            };
        } catch (error) {
            return handleError(error);
        }
    }

    formatSellOrder(order): ObjktOrder {
        let currentPrice = +order.price / MUTEZ_PER_TEZOS;
        return {
            marketplace: this,
            quantity: order.amount,
            expirationDate: order.expiry ? new Date(order.expiry) : null,
            currentPrice: currentPrice,
            paymentToken: {
                symbol: "ꜩ",
                usdPrice: undefined,
            },
            maker: {
                address: order.seller_address,
                link: `https://objkt.com/profile/${order.seller_address}`,
            },
            nativeOrder: order,
        };
    }

    formatBuyOrder(order): ObjktOrder {
        let currentPrice = +order.price / MUTEZ_PER_TEZOS;
        return {
            marketplace: this,
            quantity: 1,
            expirationDate: order.expiry ? new Date(order.expiry) : null,
            currentPrice: currentPrice,
            paymentToken: {
                symbol: "ꜩ",
                usdPrice: undefined,
            },
            maker: {
                address: order.buyer_address,
                link: `https://objkt.com/profile/${order.buyer_address}`,
            },
            nativeOrder: order,
        };
    }

    async getPriceData?(
        asset: Asset,
        abort?: AbortSignal
    ): Promise<Result<PriceData>> {
        let events;

        try {
            if (abort.aborted) return null;

            const result = await fetchEventsById(
                asset.contract_address,
                asset.token_id,
                ["offer_accept", "list_buy"]
            );

            if (result.success === false) {
                return Failure(result.error);
            }

            events = result.value;
        } catch (error) {
            return Failure(error.message);
        }

        let items: PriceDataItem[] = [];

        events.forEach((event) => {
            const tzPrice = event.price / MUTEZ_PER_TEZOS;

            const date = new Date(Date.parse(event.timestamp));

            items.push({
                date,
                quantity: event.amount,
                volume: tzPrice,
            });
        });

        return Success({
            items,
            paymentToken: {
                symbol: "ꜩ",
                usdPrice: undefined,
            },
        });
    }
}

function handleError(error) {
    console.error("[ObjktMarketplace/fullfillOrder]", error);
    let errorCode: FullfillError;
    let message = error?.message;

    if (message?.toLowerCase().includes("action was aborted by the user")) {
        errorCode = "DENIED";
    } else {
        errorCode = "OTHER";
        if (message?.toLowerCase().includes("the transaction is invalid")) {
            message =
                "The transaction was rejected by the blockchain. Please make sure you have sufficient funds in your wallet";
        }
    }
    return {
        type: "Error" as const,
        errorCode,
        message: "Error while executing the transaction.\n" + message || "",
    };
}
