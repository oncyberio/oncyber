import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

/** Independent work owns its own signal, so one completion cannot stop another. */
export function createActivityStore() {
    const pending = new Set<symbol>();
    const listeners = new Set<() => void>();
    // Column progress is shared with the renderers, independently of loading.
    let scrollProgress = 0;
    const scrollListeners = new Set<() => void>();
    return {
        getScrollProgress: () => scrollProgress,
        subscribeScroll(listener: () => void) {
            scrollListeners.add(listener);
            return () => {
                scrollListeners.delete(listener);
            };
        },
        setScrollProgress(progress: number) {
            if (!Number.isFinite(progress) || progress === scrollProgress)
                return;
            scrollProgress = progress;
            scrollListeners.forEach((listener) => listener());
        },
        getSnapshot: () => pending.size > 0,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        set(key: symbol, busy: boolean) {
            const before = pending.size > 0;
            if (busy) pending.add(key);
            else pending.delete(key);
            if (before !== pending.size > 0)
                listeners.forEach((listener) => listener());
        },
    };
}
const ActivityContext =
    createContext<ReturnType<typeof createActivityStore>>(null);
export function LandingActivityProvider({ children }: { children: ReactNode }) {
    const [store] = useState(createActivityStore);
    return (
        <ActivityContext.Provider value={store}>
            {children}
        </ActivityContext.Provider>
    );
}
export function useLandingActivity() {
    return useContext(ActivityContext);
}
export function useActivitySignal() {
    const store = useLandingActivity();
    const signal = useMemo(() => {
        const key = Symbol("landing activity");
        return (busy: boolean) => store?.set(key, busy);
    }, [store]);
    useEffect(() => () => signal(false), [signal]);
    return signal;
}
export function useLandingBusy(busy: boolean) {
    const signal = useActivitySignal();
    useEffect(() => {
        signal(busy);
        return () => signal(false);
    }, [busy, signal]);
}
