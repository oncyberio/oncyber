import { useArtworkInfo } from "./ArtworkContext";
import { Transaction as TransactionModal } from "@components/modals/Transactions/Transaction";

import ReactDOM from "react-dom";

// The overlay also waits on offers, which are not purchases and say so.
const OFFER_HEADING = "Sending your offer…";

export default function Transaction() {
    const {
        asset,
        transactionHash,
        confirming,
        confirmingAction,
        setConfirming,
        buyingSuccess,
    } = useArtworkInfo();

    return (
        <TransactionModal
            asset={asset}
            transactionHash={transactionHash}
            confirming={confirming}
            toggle={setConfirming}
            buyingSuccess={buyingSuccess}
            confirmingHeading={
                confirmingAction === "offer" ? OFFER_HEADING : undefined
            }
        />
    );
}

export function TransactionPortal() {
    return ReactDOM.createPortal(<Transaction />, document.body);
}
