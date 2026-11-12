import React, {
    MutableRefObject,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type World from "@3gl/api";
import { useIsoLayoutEffect } from "@components/hooks/useIsoLayoutEffect";
import { WORLD_CREATED } from "../three/constants";

interface WorldContextState {
    ref: React.MutableRefObject<World>;
}

export const WorldContext = React.createContext<WorldContextState>({
    ref: null,
});

export interface WorldProviderProps {
    world?: MutableRefObject<World>;
    children: React.ReactNode;
}

export function WorldProvider({ children }: WorldProviderProps) {
    //

    const [value, setValue] = useState(null);

    const ref = useRef(null);

    useIsoLayoutEffect(() => {
        //
        let cancelled = false;
        WORLD_CREATED.then((val) => {
            if (cancelled) return;
            //
            console.log("World created");

            if (ref.current) return;

            setValue(val);

            ref.current = val;
        });
        return () => { cancelled = true; };
    }, []);

    return (
        <WorldContext.Provider value={{ ref }}>
            {children}
        </WorldContext.Provider>
    );
}
