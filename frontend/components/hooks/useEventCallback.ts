import { useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { useIsoLayoutEffect } from "./useIsoLayoutEffect";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 *
 * @description For reference state value on event handler.
 * @see https://reactjs.org/docs/hooks-faq.html#how-to-read-an-often-changing-value-from-usecallback
 * @see https://github.com/facebook/react/issues/14099
 * @todo `unknown` type loos better than `any`. But can't use unknown……Error message "Type 'unknown' is not assignable to type ~" why??
 */
const useEventCallbackBase = <T extends (...args: any[]) => any>(
    useEffectHook: typeof useEffect | typeof useIsoLayoutEffect,
    fn: T,
    deps: ReadonlyArray<any>
) => {
    const ref = useRef<T>(fn);

    useEffectHook(() => {
        ref.current = fn;
    }, [fn, ...deps]);

    return useCallback(
        (...args: any[]) => {
            const callback = ref.current;
            return callback(...args);
        },
        [ref]
    ) as T;
};

export const useEventCallback = <T extends (...args: any[]) => any>(
    fn: T,
    deps: ReadonlyArray<unknown>
) => useEventCallbackBase<T>(useIsoLayoutEffect, fn, deps);

export const useEventCallbackWithUseEffect = useEventCallbackBase.bind(
    null,
    useEffect
);
