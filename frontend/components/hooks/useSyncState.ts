import { useState } from "react";
import { sameRef } from "@utils/js";

export function useSyncState<T>(
    newValue: T,
    eq: (t1: T, t2: T) => boolean = sameRef
) {
    const [state, setState] = useState<T>(newValue);

    let currentValue = state;

    if (!eq(newValue, currentValue)) {
        currentValue = newValue;
        setState(newValue);
    }

    return [currentValue, setState] as const;
}
