import { useContext } from "react";
import {
    isArtwork,
    isComponent3D,
    isEditableMesh,
    isEmptyPlacholder,
    isPortal,
} from "../utils";
import { useEditWorld } from "../context/WorldEditContext";
import { useWorldHandler } from "@components/_3DExhibit-v2/hooks/useWorldHandler";
import Events from "@3events";
import { toXYZ } from "@components/_3DExhibit-v2/three/utils/three";
import { Rotation } from "@uitypes/experience";
import { UserContext } from "@components/context/UserContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { shouldDisplayNFTs } from "@features/studio/utils";

export function useSelectedMeshEvents(isFuture) {
    //
    const { isDraggingAsset, uiDispatch } = useEditWorld();

    const { userData, isAnonymous } = useContext(UserContext);

    useWorldHandler(Events.SELECTED_ARTWORK_CHANGED, (opts) => {
        //
        const selectedItems = opts.selectedItems;

        const mesh = selectedItems.length === 1 ? selectedItems[0] : null;

        if (selectedItems.length !== 1 || (isEditableMesh(mesh) && !isFuture)) {
            //
            // uiDispatch({ type: "opt-off" });
            //
        } else if (isEmptyPlacholder(mesh) && !isDraggingAsset) {
            //
            uiDispatch({
                type: "placeholder",
                mesh,
                isNFTDisabled: !shouldDisplayNFTs(userData) || isAnonymous,
            });
        }

        //
    });
}

export function useSelectedItem() {
    //
    const { selectedMesh } = useEditWorld();

    return selectedMesh;
}

export function useEditableMesh() {
    //
    const { selectedMesh } = useEditWorld();

    return isEditableMesh(selectedMesh) ? selectedMesh : null;
}

export function useSelectedArtwork() {
    //
    const { selectedMesh } = useEditWorld();

    if (isArtwork(selectedMesh)) return selectedMesh;

    return null;
}

export function useSelectedPortal() {
    //
    const { selectedMesh } = useEditWorld();

    if (isPortal(selectedMesh)) return selectedMesh;

    return null;
}

export function useSelectedComponent() {
    //
    const { selectedMesh } = useEditWorld();

    if (isComponent3D(selectedMesh)) return selectedMesh;

    return null;
}

export function useCoordsChangeHandler() {
    //
    const { handleChangeTransform } = useEditWorld();

    useWorldHandler(Events.ARTWORK_COORDS_CHANGED, (opts) => {
        //
        let payloads = opts.payloads ?? [opts.payload];
        handleChangeTransform({
            payloads,
            analytics: {
                edited: ["position", "rotation", "scale"],
                source: opts.source,
            },
        });
    });
}

export function useWorldCompenentManager() {
    //
    const world = useWorld();

    return world.current?.getFutureWrapper();
}
