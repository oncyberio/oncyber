import styled from "styled-components";
import React, {
    Children,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import dynamic from "next/dynamic";
import { logEvent } from "@utils/saveToDb";

import { formatAsset, isSameAsset } from "@utils/formatAssets";
import { mergeArtworkMetadata } from "@utils/artworks/mergeArtworkMetadata";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UserContext } from "@context/UserContext";
import { useRouter } from "next/router";
import { Experience } from "@uitypes/experience";
import { Asset } from "@uitypes/Asset";
import {
    AssetEvent,
    BuyOrder,
    isValidConnection,
    selectMarketplace,
} from "@dapp/Marketplace";
import { PriceData } from "@dapp/types/PriceData";
import { Marketplace } from "@dapp/types/Marketplace";
import { SellOrder } from "@dapp/types/SellOrder";
import { fetchAssetById } from "@utils/fetchAssets";

import {
    connectMetamask,
    connectTezos,
    isEthAbort,
    WalletConnection,
} from "@dapp/connect";
import { switchWalletNetwork, wrongNetworkMessage } from "@dapp/switchNetwork";
import { ArtworkInfoProps } from "../../types";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import {
    initialPurchaseState,
    OrderError,
    purchaseFlags,
    PurchaseState,
    purchaseTransition,
} from "./purchaseMachine";

export type { OrderError } from "./purchaseMachine";

type InfoState = "Collapsed" | "Full";

interface ArtworkContextState extends ArtworkInfoProps {
    asset: Asset;
    sellOrders: SellOrder<any>[];
    sellOrder: any;
    buyOrders: BuyOrder[];
    priceData: Data<PriceData>;
    assetHistory: Data<AssetEvent[]>;
    refreshAssetLoading: boolean;
    submitting: boolean;
    // setSubmitting: (b: boolean) => void;
    transactionHash: any;
    // setTransactionHash: (h: any) => void;
    confirming: boolean;
    setConfirming: (b: boolean) => void;
    /** What the confirming overlay is waiting on, so it can word itself. */
    confirmingAction?: "purchase" | "offer";
    buyingSuccess: boolean;
    // setBuyingSuccess: (b: boolean) => void;
    /** The whole purchase state; the flags above are read from it. */
    purchase?: PurchaseState;
    marketplace?: Marketplace;
    buyArtwork: () => Promise<void>;
    fetchPriceData: () => Promise<void>;
    makeOfferOnArtwork: (amount: number) => Promise<void>;
    /** Set when a purchase or offer fails; cleared by the next attempt. */
    orderError?: OrderError;
    /** Runs the failed purchase or offer again. */
    retryOrder?: () => Promise<void>;
    clearOrderError?: () => void;
    toExternallink: () => void;
    isRedirect: boolean;
}

export interface Data<T> {
    data?: T;
    error?: string;
    status: "idle" | "loading" | "loaded" | "error";
}

export const ArtworkContext = React.createContext<ArtworkContextState>(null);

// The visitor closed their wallet's confirmation. That is a choice, not a
// failure, so the buy and offer flows end without a message.
function isWalletCancel(error): boolean {
    return isEthAbort(error) || error?.code === "ACTION_REJECTED";
}

export const ArtworkInfoProvider: React.FC<ArtworkInfoProps> = ({
    children,
    ...props
}) => {
    const { artwork, exhibit } = props;

    const { user, walletConnection } = useContext(UserContext);
    const { asPath } = useRouter();

    //#region State
    const [sellOrders, setSellOrders] = useState<SellOrder<any>[]>(null);
    const [buyOrders, setBuyOrders] = useState<BuyOrder[]>(null);

    const [assetHistory, setAssetHistory] = useState<Data<AssetEvent[]>>({
        status: "idle",
    });

    const [priceData, setPriceData] = useState<Data<PriceData>>({
        status: "idle",
    });

    const [refreshAssetLoading, setRefreshAssetLoading] = useState(false);
    const [asset, setAsset] = useState<Asset>(artwork);

    const [marketplace, setMarketplace] = useState<Marketplace>(null);

    // vars for confirming a transaction
    const [transactionHash, setTransactionHash] = useState(null);

    // Submitting, confirming, success and failure are one state
    // (purchaseMachine.ts); the flags below are read from it.
    const [purchase, dispatchPurchase] = useReducer(
        purchaseTransition,
        initialPurchaseState
    );
    const {
        submitting,
        confirming,
        confirmingAction,
        buyingSuccess,
        orderError,
    } = purchaseFlags(purchase);
    // The overlay's own close, and showing it again.
    const setConfirming = (show: boolean) =>
        dispatchPurchase({ type: show ? "reveal" : "dismiss" });
    const clearOrderError = () => dispatchPurchase({ type: "clear" });

    // Failures are shown beside the Buy / offer controls (docs/feedback.md).
    const failOrder = (
        action: OrderError["action"],
        message: string,
        amount?: number
    ) =>
        dispatchPurchase({
            type: "failed",
            error: {
                action,
                amount,
                message:
                    message ||
                    (action === "offer"
                        ? "The offer didn't go through."
                        : "The purchase didn't go through."),
            },
        });

    const abortController = useRef<AbortController>(null);

    const sellOrder = sellOrders?.[0];

    const isRedirect =
        asset?.contract_address == "0xc5f9b9845a7b04bdbc66d3f52128c4634054b23c";

    const assetType =
        artwork?.source?.api === "oncyber" &&
        artwork?.source?.blockchain === "none"
            ? "Upload"
            : artwork?.contract_address && artwork?.token_id
            ? "Nft"
            : artwork?.mime_type === "embed/youtube"
            ? "Youtube"
            : artwork?.mime_type?.includes("embed/html")
            ? "Website"
            : artwork?.mime_type === "cyber/text"
            ? "Text"
            : "Unknown";
    //#endregion

    //#region Effects

    useEffect(() => {
        const controller = new AbortController();
        abortController.current = controller;
        setAssetHistory({ status: "idle" });
        setSellOrders(null);
        clearOrderError();
        if (artwork?.token_id == null) return;

        setAsset(artwork);
        const _marketplace = selectMarketplace(artwork);

        setMarketplace(_marketplace);

        if (_marketplace) {
            refetchAsset(_marketplace);
        }

        return () => {
            controller.abort("Unmounted");
        };
    }, [
        artwork?.token_id,
        artwork?.contract_address,
        artwork?.blockchain,
        artwork?.marketplace,
    ]);

    // A failure describes the listing it was attempted on.
    useEffect(() => {
        clearOrderError();
    }, [sellOrder]);

    const getConnection = async (
        action: OrderError["action"],
        amount?: number
    ): Promise<WalletConnection> => {
        try {
            if (asset.blockchain === "ethereum") {
                // TODO: Refactor this to popup QuickAuth showing only wallets that can be used
                //       to buy the asset
                // Awaited so a wallet that refuses lands in the catch.
                return await connectMetamask();
            } else if (asset.blockchain === "tezos") {
                // We force a new connection in case the user wants another wallet
                // TODO: should we use the last tezos account ? seems a lot of modals there
                return await connectTezos(false);
            }
        } catch (err) {
            console.error("[ArtworkInfo/getConnection]", err);
            if (isWalletCancel(err)) return;
            failOrder(
                action,
                ["Couldn't connect to your wallet.", err?.message]
                    .filter(Boolean)
                    .join(" "),
                amount
            );
        }
    };

    // An Ethereum wallet is asked to move to the network the artwork is
    // listed on before the order is sent, as NftBuyContext does. Closing that
    // request ends the order quietly; a wallet that cannot switch is told
    // which network to use. False when the order should not be sent.
    const ensureOrderNetwork = async (
        connection: WalletConnection,
        action: OrderError["action"],
        amount?: number
    ): Promise<boolean> => {
        if (connection.type !== "ethereum") return true;
        const network =
            asset?.marketplace === "matic" || asset?.marketplace === "polygon"
                ? "polygon"
                : "ethereum";
        const result = await switchWalletNetwork(
            connection.eth,
            network === "polygon" ? 137 : 1
        );
        if (result === "failed") {
            failOrder(
                action,
                wrongNetworkMessage(
                    network,
                    action === "offer" ? "make an offer" : "buy this artwork"
                ),
                amount
            );
        }
        return result === "ready";
    };

    async function fetchAssetOrders(
        asset: Asset,
        marketplace: Marketplace,
        signal: AbortSignal
    ) {
        if (!marketplace) return;

        const [orders, buyOrders] = await Promise.all([
            marketplace.getSellOrders(asset),
            marketplace.getBuyOrders(asset),
        ]);
        if (signal.aborted) return;
        // disable marketplace functionality
        setSellOrders(orders);

        setBuyOrders(buyOrders);

        console.log("ArtworkInfo/fetchAssetsOrders", buyOrders, orders);
    }

    const fetchAssetHistory = async (
        asset: Asset,
        marketplace: Marketplace,
        signal: AbortSignal
    ) => {
        if (marketplace.getAssetHistory) {
            try {
                setAssetHistory({ status: "loading" });

                const result = await marketplace.getAssetHistory(asset, signal);

                if (signal.aborted) {
                    return;
                } else if (result.success === true) {
                    setAssetHistory({
                        status: "loaded",
                        data: result.value,
                    });
                } else {
                    setAssetHistory({
                        status: "error",
                        error: result.error,
                    });
                }
            } catch (err) {
                if (signal.aborted) return;
                console.error("[ArtworkInfoContex.setAssetHistory", err);
                setAssetHistory({
                    status: "error",
                    error: "Artwork history is temporarily unavailable.",
                });
            }
        }
    };

    async function refetchAsset(marketplace: Marketplace) {
        const signal = abortController.current.signal;
        const requestedAsset = artwork;
        setRefreshAssetLoading(true);
        const historyRequest = fetchAssetHistory(
            requestedAsset,
            marketplace,
            signal
        );
        try {
            const result = await fetchAssetById(
                requestedAsset.owner?.address,
                requestedAsset.contract_address,
                requestedAsset.token_id,
                requestedAsset.marketplace
            );

            if (signal.aborted) return;

            if (!result.success) return;
            if (
                /^0x0{40}$/i.test(result.asset?.owner?.address || "") &&
                result.asset?.top_ownerships?.[0]?.owner?.address
            ) {
                result.asset.owner = result.asset.top_ownerships[0].owner;
            }

            if (result?.asset?.asset_contract?.schema_name == "ERC1155")
                result.asset.owner = requestedAsset.owner;

            const newAsset = mergeArtworkMetadata(requestedAsset, {
                ...formatAsset(result.asset),
                raw_asset: result.asset.raw_asset,
                ownerships: result.asset.ownerships,
                supply: result.asset.supply,
            });

            await fetchAssetOrders(newAsset, marketplace, signal);

            if (signal.aborted) return;

            setAsset((currentAsset) => {
                return isSameAsset(currentAsset, newAsset)
                    ? newAsset
                    : currentAsset;
            });
        } catch (e) {
            console.error("[ArtworkInfo/refetchAsset]", e);
        } finally {
            await historyRequest;
            if (!signal.aborted) setRefreshAssetLoading(false);
        }
    }
    //#endregion

    //#region Callbacks

    const buyArtwork = async () => {
        if (!marketplace) return;
        clearOrderError();

        let connection: WalletConnection = walletConnection;
        if (!connection || !isValidConnection(marketplace, connection)) {
            connection = await getConnection("purchase");
        }

        if (!connection || !isValidConnection(marketplace, connection)) return;
        if (!(await ensureOrderNetwork(connection, "purchase"))) return;

        try {
            dispatchPurchase({ type: "start", action: "purchase" });

            amplitude_logAnalyticsEvent("trigger_purchase", {
                user_id: user?.id,
                placeholderId: artwork?.id,
                id: artwork?.contract_address + "/" + artwork?.token_id,
                name: artwork?.name,
                artistId: artwork?.creator?.address,
                ownerId: artwork?.owner?.address,
                exhibitId: exhibit?.id,
                asset_type: artwork?.mime_type,
                destination: exhibit?.info?.room,
                buy_now: true,
                price: sellOrder?.currentPrice,
                chain: artwork?.blockchain,
                source:
                    (asPath.includes("artworks") && "assets_page") ||
                    (asPath?.split?.("/")?.[1]?.includes?.("@") &&
                        "profile_page") ||
                    "live_exhibit",
            });

            const transaction = await marketplace.fullfillOrder(
                sellOrder,
                connection,
                setTransactionHash
            );

            if (transaction.type === "Success") {
                await refetchAsset(marketplace);
                setSellOrders(null);
                dispatchPurchase({ type: "succeeded" });

                amplitude_logAnalyticsEvent("finalize_purchase", {
                    user_id: user?.id,
                    placeholderId: artwork?.id,
                    id: artwork?.contract_address + "/" + artwork?.token_id,
                    name: artwork?.name,
                    artistId: artwork?.creator?.address,
                    ownerId: artwork?.owner?.address,
                    exhibitId: exhibit?.id,
                    asset_type: artwork?.mime_type,
                    destination: exhibit?.info?.room,
                    buy_now: true,
                    price: sellOrder?.currentPrice,
                    chain: artwork?.blockchain,
                    source:
                        (asPath.includes("artworks") && "assets_page") ||
                        (asPath?.split?.("/")?.[1]?.includes?.("@") &&
                            "profile_page") ||
                        "live_exhibit",
                });

                // alert("Congrats! Your asset will appear in your wallet in a few minutes.")
            } else {
                console.error(
                    "[ArtworkInfo/buyArtwork]",
                    transaction.errorCode,
                    transaction.message
                );
                amplitude_logAnalyticsEvent("failed_purchase", {
                    user_id: user?.id,
                    placeholderId: artwork?.id,
                    id: artwork?.contract_address + "/" + artwork?.token_id,
                    name: artwork?.name,
                    artistId: artwork?.creator?.address,
                    ownerId: artwork?.owner?.address,
                    exhibitId: exhibit?.id,
                    asset_type: artwork?.mime_type,
                    destination: exhibit?.info?.room,
                    buy_now: true,
                    price: sellOrder?.currentPrice,
                    chain: artwork?.blockchain,
                    failure_reason:
                        transaction?.errorCode || transaction?.message,
                    source:
                        (asPath.includes("artworks") && "assets_page") ||
                        (asPath?.split?.("/")?.[1]?.includes?.("@") &&
                            "profile_page") ||
                        "live_exhibit",
                });
                if (transaction.errorCode === "INSUFFICIENT_FUNDS")
                    failOrder(
                        "purchase",
                        "You do not have enough funds in the connected wallet."
                    );
                else if (transaction.errorCode === "DENIED") {
                    console.error("DENIED");
                } else {
                    failOrder(
                        "purchase",
                        transaction?.message?.split?.("!.")?.[0]
                    );
                }
            }
        } catch (error) {
            if (isWalletCancel(error)) return;

            const message =
                error.message ||
                "Error while processing the buy transaction. Make sure you're using a wallet with enough balance";
            failOrder("purchase", message);
        } finally {
            // Ends an order that has neither succeeded nor failed.
            dispatchPurchase({ type: "ended" });
        }
    };

    const makeOfferOnArtwork = async (startAmount: number) => {
        if (!marketplace) return;
        clearOrderError();

        let connection: WalletConnection = walletConnection;
        if (!connection || !isValidConnection(marketplace, connection)) {
            connection = await getConnection("offer", startAmount);
        }

        if (!connection || !isValidConnection(marketplace, connection)) return;
        if (!(await ensureOrderNetwork(connection, "offer", startAmount)))
            return;

        try {
            dispatchPurchase({ type: "start", action: "offer" });

            logEvent("make_offer_asset", {
                exhibitId: exhibit?.id,
                ownerId: exhibit?.editors[0],
                userId: exhibit?.editors[0],
                artworkTokenId: asset?.token_id,
                artworkContractAddress: asset?.token_address,
                value: startAmount,
            });

            const result = await marketplace.makeOffer(
                asset,
                connection,
                startAmount,
                setTransactionHash
            );

            if (result.type === "Success") {
                await refetchAsset(marketplace);
                setSellOrders(null);
            } else {
                console.error(
                    "[ArtworkInfo/makeOfferOnArtwork]",
                    result.message
                );
                // Tezos reports a closed wallet as a result, like buyArtwork.
                if ((result as any).errorCode !== "DENIED") {
                    failOrder("offer", result.message, startAmount);
                }
            }
        } catch (error) {
            console.error("[ArtworkInfo/makeOfferOnArtwork]", error);
            if (isWalletCancel(error)) return;

            failOrder("offer", error.message, startAmount);
        } finally {
            // Ends an order that has neither succeeded nor failed.
            dispatchPurchase({ type: "ended" });
        }
    };

    const retryOrder = async () => {
        if (orderError?.action === "offer") {
            await makeOfferOnArtwork(orderError.amount);
        } else if (orderError) {
            await buyArtwork();
        }
    };

    const fetchPriceData = async () => {
        if (priceData.status === "idle" && marketplace.getPriceData) {
            try {
                setPriceData({ status: "loading" });

                const result = await marketplace.getPriceData(
                    asset,
                    abortController.current.signal
                );

                if (abortController.current.signal.aborted) {
                    setPriceData({ status: "idle" });
                } else if (result.success === true) {
                    setPriceData({
                        status: "loaded",
                        data: result.value,
                    });
                } else {
                    setPriceData({
                        status: "error",
                        error: result.error,
                    });
                }
            } catch (err) {
                console.error("[ArtworkInfoContex.fetchPriceData", err);
                setPriceData({
                    status: "error",
                    error: "Failed to fetch price data",
                });
            }
        }
    };

    const isExternal = (url) => {
        // return name of the platform
        return url &&
            (url.includes("foundation") ||
                url.includes("rarible") ||
                url.includes("bitski") ||
                url.includes("superrare") ||
                url.includes("hic") ||
                url.includes("niftygateway"))
            ? url.split("://")[1].split(".")[0]
            : false;
    };

    const toExternallink = () => {
        amplitude_logAnalyticsEvent("click_opensea_redirect", {
            exhibitId: exhibit?.id,
            token_id: asset?.token_id,
            user_id: user?.id,
            contract_address: asset?.contract_address,
        });

        logEvent("click_opensea", {
            exhibitId: exhibit?.id,
            ownerId: exhibit?.editors[0],
            userId: exhibit?.editors[0],
            artworkTokenId: asset?.token_id,
            artworkContractAddress: asset?.contract_address,
        });

        let link = asset?.openSeaLink;

        if (isExternal(asset?.external_link)) {
            link = asset?.external_link;

            if (artwork?.addedBy?.split?.("@")[0] == "daviddrebin")
                link = `https://niftygateway.com/collections/daviddrebin`;
            else if (link.includes("niftygateway"))
                link = `https://niftygateway.com/itemdetail/secondary/${asset?.contract_address}/${asset?.token_id}`;
        }

        window.open(
            link?.replace?.("hicetnunc.xyz", "hicetnunc.art"),
            "_blank"
        );
    };
    //#endregion

    const value = {
        ...props,
        asset,
        marketplace,
        sellOrders,
        sellOrder,
        buyOrders,
        priceData,
        assetHistory,
        refreshAssetLoading,
        submitting,
        transactionHash,
        confirming,
        setConfirming,
        confirmingAction,
        buyingSuccess,
        purchase,
        buyArtwork,
        makeOfferOnArtwork,
        orderError,
        retryOrder,
        clearOrderError,
        fetchPriceData,
        toExternallink,
        isRedirect,
        assetType,
    };

    return (
        <ArtworkContext.Provider value={value}>
            {children}
        </ArtworkContext.Provider>
    );
};

export function useArtworkInfo() {
    return useContext(ArtworkContext);
}
