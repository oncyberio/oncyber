import { useEffect } from "react";
import { useWorld } from "./useWorld";

type Callback = (e: any) => unknown;

const callbacksByType: Record<string, Set<Callback>> = {};

export function registerWorldEvent(type, cb, world) {
    //
    let cbs = callbacksByType[type];

    if (cbs == null) {
        //
        cbs = callbacksByType[type] = new Set();

        world.setEventListener(type, (e) => {
            //
            cbs.forEach((cb) => cb(e));
        });
    }

    if (cb == null) {
        //
        cbs.delete(cb);
        //
    } else {
        cbs.add(cb);

        return () => {
            //
            cbs.delete(cb);
        };
    }
}

export function useWorldHandler(type: string, handler: (x: any) => unknown) {
    //

    const world = useWorld();

    useEffect(() => {
        //
        if (world.current == null) return;

        return registerWorldEvent(type, handler, world.current);
        //
    }, [world.current, type, handler]);
}
