import { formatAsset, isSameAsset } from "@utils/formatAssets";
import { mergeArtworkMetadata } from "@utils/artworks/mergeArtworkMetadata";

import { FetchedAsset, Asset } from "@uitypes/Asset";
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
import { noop } from "@utils/js";
import {
    connectTezos,
    ensureEthChainId,
    isEthAbort,
    WalletConnection,
} from "@dapp/connect";
import React, {
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { UserContext } from "./UserContext";
import { useRouter } from "next/router";
import { createModal, showError, showSuccess } from "@components/Dialogs";
import { connectEthereumForPayment } from "@dapp/paymentWallet";
import { Confirming } from "@features/spaces/create/components/DestinationSelector/shared/Transaction/Confirming";
import { TxPending } from "@features/spaces/create/components/DestinationSelector/shared/Transaction/TxPending";
import { Ownership } from "@dapp/types/Ownership";

interface Data<T> {
    data?: T;
    error?: string;
    status: "idle" | "loading" | "loaded" | "error";
}

export interface NftBuyContextState {
    asset: FetchedAsset;
    sellOrders: SellOrder<any>[];
    sellOrder: any;
    buyOrders: BuyOrder[];
    priceData: Data<PriceData>;
    assetHistory: Data<AssetEvent[]>;
    refreshAssetLoading: boolean;
    marketplace?: Marketplace;
    buyArtwork: (type?: string) => Promise<boolean>;
    fetchPriceData: () => Promise<void>;
    makeOfferOnArtwork: (amount: number) => Promise<boolean>;
}

export const NftBuyContext = React.createContext<NftBuyContextState>(null);

export interface NftBuyPrviderProps {
    nft: FetchedAsset;
    onEvent?: (
        event: string,
        data: { asset: Asset; price: number; error?: any }
    ) => void | Promise<void>;
}

export const NftBuyPrvider: React.FC<
    React.PropsWithChildren<NftBuyPrviderProps>
> = ({ nft, onEvent = noop, children }) => {
    //
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

    const [owners, setOwners] = useState<Ownership[]>(null);

    const [refreshAssetLoading, setRefreshAssetLoading] = useState(false);
    const [asset, setAsset] = useState<Asset>(nft as any);

    const abortController = useRef<AbortController>(null);

    const sellOrder = sellOrders?.[0];

    //#endregion

    //#region Effects

    useEffect(() => {
        const controller = new AbortController();
        abortController.current = controller;
        setAssetHistory({ status: "idle" });
        setPriceData({ status: "idle" });
        setBuyOrders(null);
        setSellOrders(null);
        if (nft?.token_id == null) return;

        setAsset(nft as any);
        const _marketplace = selectMarketplace(nft);

        if (_marketplace) {
            fetchAssetData(_marketplace, true, nft as Asset, controller.signal);
        }

        return () => {
            controller.abort("Unmounted");
        };
    }, [
        nft?.token_id,
        nft?.contract_address,
        nft?.blockchain,
        nft?.marketplace,
    ]);

    const getConnection = async (
        marketplace: Marketplace
    ): Promise<WalletConnection> => {
        //
        let connection: WalletConnection = walletConnection;

        if (!connection || !isValidConnection(marketplace, connection)) {
            //
            if (asset.blockchain === "ethereum") {
                // Only wallets that can pay, and never the sign-in sheet:
                // the wallet chosen here is used for this payment and does
                // not change the signed-in account (dApp/paymentWallet).
                connection = await connectEthereumForPayment(user?.id);
                //
            } else if (asset.blockchain === "tezos") {
                // We force a new connection in case the user wants another wallet
                // TODO: should we use the last tezos account ? seems a lot of modals there
                connection = await connectTezos(false);
            }
        }

        if (connection?.type === "ethereum") {
            // For now we limit to metamask.
            // Check behavior of other wallets

            await ensureEthChainId(
                connection.eth,
                asset.marketplace === "matic" || asset.marketplace === "polygon"
                    ? "polygon"
                    : "ethereum"
            );
        }

        return connection;
    };

    async function fetchAssetOrders(asset: Asset, marketplace: Marketplace) {
        if (!marketplace) return;

        const [orders, buyOrders] = await Promise.all([
            marketplace.getSellOrders(asset),
            marketplace.getBuyOrders(asset),
        ]);

        // disable marketplace functionality
        console.log("ArtworkInfo/fetchAssetsOrders", buyOrders, orders);

        return [orders, buyOrders] as const;
    }

    const fetchAssetHistory = async (
        asset: Asset,
        marketplace: Marketplace,
        signal: AbortSignal
    ): Promise<Data<AssetEvent[]>> => {
        if (marketplace.getAssetHistory) {
            const errMsg = "Artwork history is temporarily unavailable.";

            try {
                setAssetHistory({ status: "loading" });

                const result = await marketplace.getAssetHistory(asset, signal);

                if (signal.aborted) {
                    return { status: "idle" };
                } else if (result.success === true) {
                    return {
                        status: "loaded",
                        data: result.value,
                    };
                } else {
                    return {
                        status: "error",
                        error: errMsg,
                    };
                }
            } catch (err) {
                if (signal.aborted) return { status: "idle" };
                console.error("[ArtworkInfoContex.setAssetHistory", err);
                return {
                    status: "error",
                    error: errMsg,
                };
            }
        }
    };

    async function fetchAssetData(
        marketplace: Marketplace,
        needsRefetch = false,
        requestedAsset: Asset = asset,
        signal = abortController.current.signal
    ) {
        setRefreshAssetLoading(true);

        // History must not depend on obsolete order APIs or a metadata refresh.
        const historyRequest = fetchAssetHistory(
            requestedAsset,
            marketplace,
            signal
        ).then((events) => {
            if (!signal.aborted && events) setAssetHistory(events);
        });
        let newAsset = requestedAsset;

        try {
            if (needsRefetch) {
                let result = await fetchAssetById(
                    requestedAsset.owner?.address ||
                        requestedAsset.contract_address,
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

                newAsset = mergeArtworkMetadata(requestedAsset, {
                    ...formatAsset(result.asset),
                    raw_asset: result.asset.raw_asset,
                    ownerships: result.asset.ownerships,
                    supply: result.asset.supply,
                });
            }

            const [sellOrders, buyOrders] = await fetchAssetOrders(
                newAsset,
                marketplace
            );
            if (signal.aborted) return;
            setSellOrders(sellOrders);
            setBuyOrders(buyOrders);

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

    const buyArtwork = async (type = "artwork") => {
        //
        const marketplace = selectMarketplace(asset);
        if (!marketplace) return;

        let connection = await getConnection(marketplace);

        if (!connection || !isValidConnection(marketplace, connection)) return;

        const showBlocking = createModal();

        const price = sellOrder?.currentPrice;

        try {
            showBlocking(<Confirming />);

            onEvent(
                type === "marketplace"
                    ? "trigger_buy_now_marketplace"
                    : "trigger_purchase",
                {
                    asset,
                    price,
                }
            );

            const transaction = await marketplace.fullfillOrder(
                sellOrder,
                connection,
                (hash) => {
                    //
                    showBlocking(
                        <TxPending
                            transactionHash={hash}
                            image={
                                asset.dcompressed_image_url ||
                                asset.image_url ||
                                asset.image_preview_url
                            }
                        />
                    );
                }
            );

            showBlocking(null);

            if (transaction.type == "Success") {
                showSuccess(
                    "Congrats! Your asset will appear in your\nwallet instantly."
                );

                onEvent(
                    type === "marketplace"
                        ? "successful_buy_now_marketplace"
                        : "finalize_purchase",
                    {
                        asset,
                        price,
                    }
                );

                await fetchAssetData(marketplace);
                setSellOrders(null);

                return true;
            }

            return false;
            //
        } catch (error) {
            //
            console.error(error);

            const message =
                error.message || "Error while processing the transaction";

            onEvent(
                type === "marketplace"
                    ? "failed_buy_now_marketplace"
                    : "failed_purchase",
                {
                    asset,
                    price,
                    error: message,
                }
            );

            if (isEthAbort(error)) return;

            showBlocking(null);

            await showError(message);

            return false;
            //
        } finally {
            showBlocking(null);
        }
    };

    const makeOfferOnArtwork = async (startAmount: number) => {
        //
        const marketplace = selectMarketplace(asset);
        if (!marketplace) return;

        let connection = await getConnection(marketplace);

        if (!connection || !isValidConnection(marketplace, connection)) return;

        const showBlocking = createModal();

        try {
            showBlocking(<Confirming />);

            onEvent("make_offer_asset", {
                asset,
                price: startAmount,
            });

            const result = await marketplace.makeOffer(
                asset,
                connection,
                startAmount,
                (hash) =>
                    showBlocking(
                        <TxPending
                            transactionHash={hash}
                            image={
                                asset.dcompressed_image_url ||
                                asset.image_url ||
                                asset.image_preview_url
                            }
                        />
                    )
            );

            showBlocking(null);

            if (result.type === "Success") {
                //
                showSuccess("Your offer was successfully submitted");

                await fetchAssetData(marketplace);

                return true;
                //
            }

            return false;
            //
        } catch (error) {
            //
            console.error(error);

            if (isEthAbort(error)) return;

            const message =
                error.message || "Error while processing the transaction";

            showBlocking(null);

            await showError(message);

            return false;
            //
        } finally {
            showBlocking(null);
        }
    };

    const fetchPriceData = async () => {
        const marketplace = selectMarketplace(asset);
        if (marketplace == null) return;

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
    //#endregion

    const value = {
        marketplace: selectMarketplace(asset),
        asset,
        sellOrders,
        sellOrder,
        buyOrders,
        priceData,
        assetHistory,

        refreshAssetLoading,

        buyArtwork,
        makeOfferOnArtwork,
        fetchPriceData,
    };

    return (
        <NftBuyContext.Provider value={value}>
            {children}
        </NftBuyContext.Provider>
    );
};

export function useNftBuyContext() {
    return useContext(NftBuyContext);
}

export default function useNftOrderInfo() {
    const {
        asset,
        sellOrders,
        buyOrders,
        refreshAssetLoading: loading,

        buyArtwork,
        makeOfferOnArtwork,
    } = useNftBuyContext();

    const listing = sellOrders?.[0];
    const offer = buyOrders?.[0];

    const { user } = useContext(UserContext);

    const isOwner = user?.id != null && user.id === listing?.maker?.address;

    const [makingOffer, setMakingOffer] = useState(false);
    const [startAmount, setStartAmount] = useState<number>(0);
    // Shown beside the amount field; the visitor corrects it, so no Retry.
    const [amountError, setAmountError] = useState("");

    const handleAmountChange = (e) => {
        setStartAmount(e.target.value);
        setAmountError("");
    };

    const handleMakeOffer = useCallback(() => {
        setMakingOffer(true);
    }, [setMakingOffer]);

    const handleConfirmOffer = useCallback(() => {
        let value = +startAmount;
        if (isFinite(value) && value > 0) {
            setMakingOffer(false);
            setStartAmount(0);
            makeOfferOnArtwork(value);
        } else {
            setAmountError("Enter an amount greater than 0.");
        }
    }, [makeOfferOnArtwork, startAmount]);

    const handleCancelOffer = useCallback(() => {
        setMakingOffer(false);
        setStartAmount(0);
        setAmountError("");
    }, [setMakingOffer]);

    return {
        amountError,
        asset,
        listing,
        offer,
        makingOffer,
        handleConfirmOffer,
        handleCancelOffer,
        isOwner,
        handleAmountChange,
        handleMakeOffer,
        loading,
        buyArtwork,
        startAmount,
    };
}
