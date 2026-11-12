import { useEffect, useState } from "react";
import _Confetti from "react-confetti";

const isBrowser = typeof window != undefined;

export function Confetti({
    run,
    recycle,
    gravity = 0.15,
    numberOfPieces = 400,
}) {
    const [screenDimensions, _] = useState({
        w: isBrowser ? screen.width : 200,
        h: isBrowser ? screen.height : 200,
    });

    return (
        <_Confetti
            run={run}
            recycle={recycle}
            gravity={gravity}
            numberOfPieces={numberOfPieces}
            width={screenDimensions?.w}
            height={screenDimensions?.h}
            style={{ position: "fixed", left: 0, top: 0, overflow: "hidden" }}
        />
    );
}
