import {
    ensureEthChainId,
    EthereumConnection,
    isEthAbort,
} from "@dapp/connect";
import React, { useContext, useEffect, useRef } from "react";
import { UserContext } from "@context/UserContext";
import { showError, showSuccess, createModal } from "@components/Dialogs";
import { Destination } from "@uitypes/destinations";
import { ReservoirMarketplace } from "@dapp/ReservoirMarketplace";
import dynamic from "next/dynamic";
import { connectEthereumForPayment } from "@dapp/paymentWallet";
import { TxPending } from "../shared/Transaction/TxPending";
import { Confirming } from "../shared/Transaction/Confirming";
import { delay } from "@utils/js";
import { noop } from "lodash";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

interface Data<T> {
    data?: T;
    error?: string;
    status: "idle" | "loading" | "loaded" | "error";
}

export interface RoomBuyNowState {
    buyRoom: (room: Destination, price: number) => Promise<boolean>;
}

const RoomBuyNowContext = React.createContext<RoomBuyNowState>(null);

export const RoomBuyNowPrvider: React.FC<
    React.PropsWithChildren<{ onEvent?: Function }>
> = ({ onEvent = noop, children }) => {
    //
    const { user, walletConnection } = useContext(UserContext);

    //#region State

    const abortController = useRef<AbortController>(null);

    //#endregion

    useEffect(() => {
        abortController.current = new AbortController();

        return () => {
            abortController.current.abort("Unmounted");
        };
    }, []);

    const ensureWalletConnection = async (room: Destination) => {
        let connection: EthereumConnection;

        if (
            walletConnection?.type === "ethereum" &&
            walletConnection.ethers != null
        ) {
            connection = walletConnection;
        } else {
            // Only wallets that can pay, and never the sign-in sheet: the
            // wallet chosen here is used for this payment and does not
            // change the signed-in account (dApp/paymentWallet).
            connection = await connectEthereumForPayment(user?.id);
        }

        if (connection == null) return null;

        // For now we limit to metamask.
        // Check behavior of other wallets

        await ensureEthChainId(connection.eth, room.blockchain);

        return connection;
    };

    //#region Callbacks

    const buyRoom = async (room: Destination, price = null) => {
        //
        const marketplace = ReservoirMarketplace.getInstance(room.blockchain);
        if (!marketplace) return;

        const showBlocking = createModal();

        const analyticsPayload = {
            ...(room?.author || {}),
            blockchain: room?.blockchain,
            capacity: room?.capacity,
            contractName: room?.contractName,
            contract_address: room?.contract_address,
            endTime: room?.endTime,
            image: room?.image,
            name: room?.name,
            price: room?.price,
            quantity: room?.quantity,
            shareCyber: room?.shareCyber,
            slug: room?.slug,
            startTime: room?.startTime,
            status: room?.status,
            token_id: room?.token_id,
        };

        try {
            const connection = await ensureWalletConnection(room);

            if (connection == null) return;

            showBlocking(<Confirming />);

            onEvent("trigger_buy_now_marketplace", {
                room: analyticsPayload,
                price,
            });

            await marketplace.buyToken(
                room.contract_address,
                room.token_id,
                connection,
                (hash) => {
                    //
                    showBlocking(
                        <TxPending
                            transactionHash={hash}
                            image={room.image || room.thumbnail}
                        />
                    );
                }
            );

            onEvent("successful_buy_now_marketplace", {
                room: analyticsPayload,
                price,
            });

            showBlocking(null);

            await showSuccess(
                "Congrats! Your asset will appear in your\nwallet instantly."
            );

            return true;

            //
        } catch (error) {
            //
            console.error(error);

            if (isEthAbort(error)) return;

            const message =
                error.message || "Error while processing the transaction";

            onEvent("failed_buy_now_marketplace", {
                room: analyticsPayload,
                price,
                error: message,
            });

            showBlocking(null);

            await showError(message);

            return false;
            //
        } finally {
            showBlocking(null);
        }
    };

    //#endregion

    const value = {
        buyRoom,
    };

    return (
        <RoomBuyNowContext.Provider value={value}>
            {children}
        </RoomBuyNowContext.Provider>
    );
};

export function useRoomBuyNowContext() {
    return useContext(RoomBuyNowContext);
}
