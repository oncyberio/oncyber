import { useEffect, useRef } from "react";

export function useStateRef<T>(state: T) {
    //
    let stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    return stateRef;
}
