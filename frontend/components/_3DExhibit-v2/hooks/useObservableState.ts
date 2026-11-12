import { useState, useEffect, useSyncExternalStore } from "react";

type Callback = (type: string, ...args: any[]) => unknown;

interface EventSource {
    on: (type: string, cb: Callback) => unknown;
    off: (type: string, cb: Callback) => unknown;
}

const subscribe = (source: EventSource, event: string) => (cb: Callback) => {
    //
    source.on(event, cb);

    return () => {
        //
        source.off(event, cb);
    };
};

export function useObservableState<T>(
    getState: () => T,
    source: EventSource | null,
    event: string
) {
    //
    if (source == null) return getState();

    return useSyncExternalStore<T>(
        subscribe(source, event),
        getState,
        () => null
    );
}
