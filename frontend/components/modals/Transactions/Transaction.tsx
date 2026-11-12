import Confirm from "./Confirm";
import Confirming from "./Confirming";
import { Confetti } from "./Confetti";
import { useState } from "react";

export interface TransactionProps {
    asset: any;
    transactionHash: any;
    confirming: boolean;
    toggle: (b: boolean) => void;
    buyingSuccess: boolean;
    /** Heading while confirming. Leave unset for a purchase. */
    confirmingHeading?: string;
}

export function Transaction({
    asset,
    transactionHash,
    confirming,
    toggle,
    buyingSuccess,
    confirmingHeading,
}: TransactionProps) {
    //
    const [stopAnimation, setStopAnimation] = useState(false);

    return (
        <>
            <Confirming
                asset={asset}
                transactionHash={transactionHash}
                toggle={toggle}
                isShowing={confirming}
                heading={confirmingHeading}
            />
            <Confirm
                toggle={() => setStopAnimation(true)}
                isShowing={buyingSuccess && !stopAnimation}
                artwork={asset}
            />
            <Confetti run={buyingSuccess} recycle={!stopAnimation} />
        </>
    );
}
