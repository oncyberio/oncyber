import { fetchArtworkHistory } from "@utils/artworks/history/client";
import { nodeEnv } from "@env";
import { Asset } from "@uitypes/Asset";
import { ethers } from "ethers";
import { delay, Failure, param, Result, Success } from "@utils/js";
import { EthereumConnection, isEthAbort } from "./connect";
import {
    AssetEvent,
    BuyOrder,
    FullfillResult,
    MakeOfferResult,
    Marketplace,
    PriceData,
    PriceDataItem,
    SellOrder,
} from "./Marketplace";

// Important: use type import because we don't want to load the kit immediately
// We'll import dynamically when buy/makeOffer functions are used
import type { ReservoirClient, _Data1 } from "@reservoir0x/reservoir-sdk";
import { Ownership } from "./types/Ownership";

export type ReservoirOrder = SellOrder<any>;

// For now we take only (w)eth listings
// TODO:  enable other ERC20 tokens
const erc20Tokens = {
    ETH: "ETH",
    WETH: "WETH",
    MATIC: "MATIC",
};

function isNullAddress(addr: string) {
    return Number(addr) === 0;
}

function ethToWei(amount: number) {
    return amount * 10 ** 18;
}

const ETHPaymentToken = {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
    usdPrice: null,
};

const MaticaymentToken = {
    name: "MATIC",
    symbol: "MATIC",
    decimals: 18,
    usdPrice: null,
};

export type ReservoirChain = "ethereum" | "polygon";

const API_BASES: Record<ReservoirChain, string> = {
    ethereum: "https://api.reservoir.tools",
    polygon: "https://api-polygon.reservoir.tools",
};

export class ReservoirMarketplace
    implements Marketplace<ReservoirOrder, EthereumConnection>
{
    name = "reservoir";
    _client: ReservoirClient = null;
    basePath = API_BASES.ethereum;
    chain: ReservoirChain = "ethereum";

    static getInstance(chain: ReservoirChain = "ethereum") {
        const inst = new ReservoirMarketplace();
        inst.basePath = API_BASES[chain];
        inst.chain = chain;
        return inst;
    }

    async getClient() {
        if (this._client == null) {
            const module = await import("@reservoir0x/reservoir-sdk");

            this._client = module.createClient({
                apiBase: this.basePath,
                apiKey: nodeEnv.RESERVOIR_API_KEY,
            });
        }

        return this._client;
    }

    async fetchApi(
        path: string,
        params: URLSearchParams,
        abort?: AbortSignal
    ): Promise<any> {
        //
        const response = await fetch(`${this.basePath}${path}?${params}`, {
            headers: {
                "x-api-key": nodeEnv.RESERVOIR_API_KEY,
            },
            signal: abort,
        });

        if (!response.ok) {
            throw new Error("Couldn't fetch historical data for this asset");
        }

        return response.json();
    }

    async fetchOrders(asset: Asset, path: string): Promise<ReservoirOrder[]> {
        try {
            let params = new URLSearchParams();

            params.set("token", this.token(asset));
            params.set("status", "active");
            params.set("sortBy", "price");

            if (window.location.pathname === "/looksrare") {
                params.set("source", "looksrare.org");
            }

            let { orders } = await this.fetchApi(path, params);

            const now = Date.now();

            orders = orders?.filter((o) => {
                const token = o?.price?.currency?.symbol?.toUpperCase();
                return (
                    token in erc20Tokens &&
                    (!o.validUntil || now < o.validUntil * 1000)
                );
            });

            if (!orders?.length) return null;

            return orders.map((order) => this.formatSellOrder(order));
        } catch (err) {
            console.error("[ReservoirMarketplace/getSellOrder]", err);
            return null;
        }
    }

    async getSellOrder(asset: Asset): Promise<ReservoirOrder> {
        const orders = await this.getSellOrders(asset);
        return orders?.[0];
    }

    async getSellOrders(asset: Asset): Promise<ReservoirOrder[]> {
        return this.fetchOrders(asset, "/orders/asks/v3");
    }

    async getBuyOrders(asset: Asset): Promise<BuyOrder[]> {
        return this.fetchOrders(asset, "/orders/bids/v4");
    }

    async fullfillOrder(
        order: ReservoirOrder,
        wallet: EthereumConnection,
        onStartTransaction: (hash: string) => void
    ) {
        //

        return this._buyToken(
            { type: "OrderId", id: order.nativeOrder.id },
            wallet,
            onStartTransaction
        );
    }

    async buyToken(
        contract: string,
        tokenId: string,
        wallet: EthereumConnection,
        onStartTransaction: (hash: string) => void
    ) {
        //

        return this._buyToken(
            { type: "Token", contract, tokenId },
            wallet,
            onStartTransaction
        );
    }

    async _buyToken(
        target:
            | { type: "Token"; contract: string; tokenId: string }
            | { type: "OrderId"; id: string },
        wallet: EthereumConnection,
        onStartTransaction: (hash: string) => void
    ): Promise<FullfillResult> {
        try {
            //
            // await delay(2000);

            // onStartTransaction("0xxxx");

            // await delay(3000);

            // return { type: "Success", data: "" };

            const client = await this.getClient();

            const signer = this.getSigner(wallet);

            let param: Partial<_Data1>;

            if (target.type === "OrderId") {
                param = { orderIds: [target.id] };
            } else if (target.type === "Token") {
                param = {
                    tokens: [
                        { tokenId: target.tokenId, contract: target.contract },
                    ],
                };
            }

            await client.actions.buyToken({
                ...param,
                signer,
                onProgress: this.createTransactionListener(onStartTransaction),
            });

            return { type: "Success", data: "success" };
        } catch (err) {
            //
            console.error(err);

            this._processTransactionError(err);
        }
    }

    _processTransactionError(err) {
        if (err.code === 4001) {
            throw err;
        }

        if (
            err.code === "ACTION_REJECTED" ||
            err.message
                ?.toLowerCase?.()
                ?.startsWith("user rejected transaction")
        ) {
            throw new Error("DENIED");
        }

        let message = err?.response?.data?.message || err?.message;

        const match = message?.toLowerCase?.() || "";

        if (
            match?.includes("balance too low") ||
            match?.includes("does not have sufficient balance")
        ) {
            message =
                "Balance is too low to proceed with the transaction. Please switch to a wallet with enough balance.";
        } else {
            message = "Error while processing the buy transaction";
        }

        throw new Error(message);
    }

    async makeOffer(
        asset: Asset,
        wallet: EthereumConnection,
        ethAmount: number,
        onStartTransaction: (hash: string) => void
    ): Promise<MakeOfferResult> {
        //

        // await delay(2000);

        // onStartTransaction("0xxxx");

        // await delay(3000);

        // return { type: "Success", data: "" };
        try {
            const client = await this.getClient();

            const signer = this.getSigner(wallet);

            const bid = {
                weiPrice: String(ethToWei(ethAmount)),
                orderbook: "reservoir" as const,
                orderKind: "seaport" as const,
                token: this.token(asset),
            };

            await client.actions.placeBid({
                bids: [bid],
                signer,
                onProgress: this.createTransactionListener(onStartTransaction),
            });

            return { type: "Success", data: null };
        } catch (err) {
            //
            console.error(err);

            this._processTransactionError(err);
        }
    }

    eventTypes = ["sale", "transfer", "mint", "ask"];
    async getAssetHistory(
        asset: Asset,
        abort?: AbortSignal
    ): Promise<Result<AssetEvent[]>> {
        return fetchArtworkHistory(asset, this.chain, abort);
    }

    async getOwners(
        asset: Asset,
        abort?: AbortSignal
    ): Promise<Result<Ownership[]>> {
        try {
            const token = this.token(asset);
            const path = `/owners/v1`;

            const params = new URLSearchParams();
            params.set("token", token);
            params.set("limit", "20");

            this.eventTypes.forEach((it) => {
                params.append("types", it);
            });

            const result = await this.fetchApi(path, params, abort);

            const owners = (result.owners as any[]).map((it) => {
                //
                const res: Ownership = {
                    account: {
                        address: it.address,
                    },
                    quantity: +it.ownership.tokenCount,
                };

                return res;
            });

            return Success(owners);
        } catch (err) {
            console.error(err);
            return Failure(err.message || "Error fetching Ownership");
        }
    }

    getSigner(wallet: EthereumConnection) {
        const provider = new ethers.providers.Web3Provider(wallet.eth);
        return provider.getSigner();
    }

    createEvent(event, asset): AssetEvent {
        //
        const date = new Date(event.timestamp * 1000);

        const paymentToken =
            asset.marketplace === "matic" ? MaticaymentToken : ETHPaymentToken;

        if (event.type === "mint") {
            return {
                type: "Mint",
                date,
                to: {
                    address: event.toAddress,
                },
                transactionHash: event.txHash,
            } as AssetEvent;
        }
        if (event.type === "transfer") {
            let from = event.fromAddress;
            let to = event.toAddress;

            if (isNullAddress(to)) {
                return {
                    type: "Burn",
                    date,
                    from,
                    transactionHash: event.txHash,
                };
            } else {
                return {
                    type: "Transfer",
                    date,
                    from: {
                        address: from,
                    },
                    to: {
                        address: to,
                    },
                    transactionHash: event.txHash,
                };
            }
        } else if (event.type === "ask") {
            return {
                type: "Listing",
                date,
                from: {
                    address: event.fromAddress,
                },
                quantity: +event.amount,
                price: +event.price,
                paymentToken,
                orderId: event.order?.id,
            };
        } else if (event.type === "sale") {
            return {
                type: "Sale",
                date,
                from: {
                    address: event.fromAddress,
                },
                to: {
                    address: event.toAddress,
                },
                quantity: +event.amount,
                price: event.price,
                paymentToken,
                transactionHash: event.txHash,
            };
        }
    }

    async getPriceData(
        asset: Asset,
        abort?: AbortSignal
    ): Promise<Result<PriceData>> {
        let sales = [];
        let data;

        let timestamp = -Infinity;
        let startTimestamp = Math.floor(
            (Date.now() - 90 * 24 * 3600 * 1000) / 1000
        );

        try {
            do {
                if (abort?.aborted) return null;

                const params = new URLSearchParams();
                params.set("token", this.token(asset));
                params.set("includeTokenMetadata", "false");
                params.set("startTimestamp", String(startTimestamp));

                if (data?.continuation) {
                    params.set("continuation", data.continuation);
                }

                data = await this.fetchApi("/sales/v4", params);

                if (data?.sales?.length) {
                    sales = sales.concat(data.sales);

                    timestamp = data.sales[data.sales.length - 1].timestamp;
                }
            } while (data?.continuation && timestamp > startTimestamp);
        } catch (err) {
            console.error(err);
            return Failure(
                err.message || "Error fetching reservoir price data"
            );
        }

        let items: PriceDataItem[] = [];

        sales.reverse();
        sales.forEach((event) => {
            //
            const date = new Date(event.timestamp * 1000);
            const quantity = +event.amount;

            const unitPrice = +event.price.amount.decimal;

            const volume = quantity * unitPrice;

            items.push({
                date,
                quantity,
                volume,
            });
        });

        return Success({
            items,
            paymentToken: {
                symbol: "ETH",
            },
        });
    }

    async getCollectionFloorPrices(
        address: string
    ): Promise<Result<Record<string, number>>> {
        try {
            const params = new URLSearchParams();

            params.set("contract", address);

            const res = await this.fetchApi("/tokens/floor/v1", params);

            return Success(res?.tokens || {});
        } catch (err) {
            console.error(err);
            return Failure(err.message || "Failed to fetch floor prices");
        }
    }

    token(asset: Asset): string {
        return `${asset.contract_address}:${asset.token_id}`;
    }

    formatSellOrder(order: any): ReservoirOrder {
        //
        let currentPrice = +order.price.amount.decimal;
        let usdPriceNum =
            currentPrice > 0 ? +order.price.amount.usd / currentPrice : 0;

        const maker = order.maker;

        return {
            marketplace: this,
            quantity: 1,
            expirationDate: order.validUntil
                ? new Date(order.validUntil * 1000)
                : null,
            currentPrice: currentPrice,
            paymentToken: {
                symbol: order.price.currency.symbol,
                usdPrice: !isNaN(usdPriceNum) ? usdPriceNum : undefined,
            },
            maker: {
                address: maker,
                link: order.source?.url,
            },
            source: order.source,
            nativeOrder: order,
            orderId: order.id,
        };
    }

    createTransactionListener(onStartTransaction: (txHash: string) => void) {
        //
        let txCallbackCalled = false;

        return function onProgress(steps) {
            if (txCallbackCalled) return;

            let txHash;

            steps.forEach((it) => {
                console.log("step", it);
                if (it.kind === "transaction") {
                    it.items?.forEach((it) => {
                        if (it.txHash) {
                            txHash = it.txHash;
                        }
                    });
                }
            });

            if (txHash) {
                txCallbackCalled = true;
                onStartTransaction(txHash);
            }
        };
    }
}
