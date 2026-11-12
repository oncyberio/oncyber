//
import Events from "@3events";
import type { SpaceComponent } from "@3factory/abstract/spacecomponent";
import { useWorldStore } from "./useWorldStore";
import { WorldStore } from "./WorldStore";
import { useWorld } from "./useWorld";
import { EDITION_ACTIONS } from "../three/constants";

const worldSelectedMeshesStore = new WorldStore<SpaceComponent[]>(
    [],
    [
        {
            event: Events.SELECTED_ARTWORK_CHANGED,
            update(opts, _) {
                //
                return opts.selectedItems;
            },
        },
    ]
);

export function useWorldSelection() {
    //
    const world = useWorld();

    const selectedItems = useWorldStore(worldSelectedMeshesStore);

    const selectedMesh = selectedItems.length === 1 ? selectedItems[0] : null;

    if (process.env.NODE_ENV === "development") {
        window["$$selection"] = selectedMesh;
        window["$$selections"] = selectedItems;
    }

    const setSelectedItems = (items: (SpaceComponent | string)[]) => {
        //
        world.current.edit({
            type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
            items,
        });
    };

    return { selectedItems, selectedMesh, setSelectedItems };
}
