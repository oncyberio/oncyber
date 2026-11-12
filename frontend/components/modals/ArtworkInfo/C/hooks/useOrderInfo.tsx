import { UserContext } from "@components/context/UserContext";
import { useCallback, useContext, useEffect, useState } from "react";
import { useArtworkInfo } from "../components/ArtworkContext";

export default function useOrderInfo() {
    const {
        asset,
        sellOrders,
        buyOrders,
        refreshAssetLoading: loading,
        submitting,
        buyArtwork,
        toggle,
        setIsAnimateArtworkInfoBulle,
        makeOfferOnArtwork,
        orderError,
        retryOrder,
        clearOrderError,
    } = useArtworkInfo();

    const listing = sellOrders?.[0];
    const offer = buyOrders?.[0];

    const { user } = useContext(UserContext);

    const isOwner = user?.id != null && user.id === asset.owner?.address;

    const [makingOffer, setMakingOffer] = useState(false);
    const [startAmount, setStartAmount] = useState<number>(0);
    // Shown beside the amount field; the visitor corrects it, so no Retry.
    const [amountError, setAmountError] = useState("");

    useEffect(() => {
        document.body.style.overflow = "hidden";
    }, []);

    const handleAmountChange = (e) => {
        setStartAmount(e.target.value);
        setAmountError("");
    };

    const handleMakeOffer = useCallback(() => {
        clearOrderError?.();
        setMakingOffer(true);
    }, [setMakingOffer]);

    const debounceClose = useCallback(() => {
        if (window.orientation === 90 || window.orientation === -90) {
            toggle();
        } else {
            setIsAnimateArtworkInfoBulle(true);
            setTimeout(() => {
                toggle();
                setIsAnimateArtworkInfoBulle(false);
            }, 200);
        }
    }, []);

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
        orderError,
        retryOrder,
        amountError,
        listing,
        offer,
        makingOffer,
        handleConfirmOffer,
        handleCancelOffer,
        isOwner,
        handleAmountChange,
        handleMakeOffer,
        debounceClose,
        loading,
        submitting,
        buyArtwork,
        startAmount,
    };
}
