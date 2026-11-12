import React from "react";
import { CollapsiblePrompt } from "../../../shared/CollapsiblePrompt";
import { ArtworkPlacement } from "../../../shared/ArtworkPlacement";
import { TYPES } from "@components/_3DExhibit-v2/three/factory/artwork/constants";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { isArtwork } from "@features/studio/EditWorldMenu/utils";

export function ArtworkCoordinates({ isYOnly }) {
    //
    const {
        selectedMesh: mesh,
        transformMode,
        toggleTransformMode,
    } = useEditWorld();

    if (mesh == null) return null;

    if (isArtwork(mesh) && mesh.mediaType === TYPES.MODEL) {
        //
        return <ArtworkPlacement mesh={mesh} />;
    }

    const hideAdvanced = transformMode !== "3d";

    const promptMsg = `${
        hideAdvanced ? "Enable" : "Disable"
    } advanced placement controls (x, y, z)`;

    if ((mesh as any).mediaType === TYPES.TRIGGER_ZONE) {
        return <ArtworkPlacement isYOnly={isYOnly} mesh={mesh as any} />;
    }

    return (
        <CollapsiblePrompt
            isCollapsed={hideAdvanced}
            onCollapseChange={toggleTransformMode}
            text={promptMsg}
        >
            <ArtworkPlacement isYOnly={isYOnly} mesh={mesh as any} />
        </CollapsiblePrompt>
    );
}
