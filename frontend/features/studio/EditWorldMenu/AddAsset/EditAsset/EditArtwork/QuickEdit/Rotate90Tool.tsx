import { useState } from "react";
import IconImg from "@ui/components/IconImg";
import { Tool } from "@features/studio/styles/Toolbar";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { toXYZ } from "@components/_3DExhibit-v2/three/utils/three";
import { TYPES } from "@3artwork/constants";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";

export function Rotate90Tool() {
    //
    const { handleChangeTransform, selectedMesh } = useEditWorld();

    const artwork = useSelectedArtwork();

    const disabled = artwork.mediaType === TYPES.GLOBAL_STREAM;

    const handleClick = useEventCallback(async () => {
        //

        const rotation = toXYZ(selectedMesh.rotation);

        rotation.z = (rotation.z + Math.PI / 2) % (2 * Math.PI);

        handleChangeTransform({
            targetMesh: selectedMesh as any,
            rotation,
            analytics: { edited: ["rotation"], source: "quick-edit" },
        });
    }, []);

    return (
        <Tool
            className="tool-btn"
            blink={true}
            disabled={disabled}
            onClick={handleClick}
        >
            <IconImg className="tool-icon" name="rotate-left-90" size={22} />
        </Tool>
    );
}
