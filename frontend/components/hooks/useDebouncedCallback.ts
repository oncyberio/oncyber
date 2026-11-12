import debounce from "lodash/debounce";
import { useMemo } from "react";
import { useEventCallback } from "./useEventCallback";

export const useDebouncedCallback = <T extends (...args: any[]) => unknown>(
    fn: T,
    delay: number,
    opts?: { leading?: boolean }
) => {
    const cb = useEventCallback<T>(fn, []);

    return useMemo(() => {
        return debounce(cb, delay, opts || {});
    }, []);
};
