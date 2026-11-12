import { useState } from "react";
import IconImg from "@ui/components/IconImg";
import { Tool } from "@features/studio/styles/Toolbar";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { toXYZ } from "@components/_3DExhibit-v2/three/utils/three";

export function Rotate90HorzTool() {
    //
    const { handleChangeTransform, selectedMesh } = useEditWorld();

    const handleClick = useEventCallback(async () => {
        //

        const rotation = toXYZ(selectedMesh.rotation);

        rotation.y = (rotation.y + Math.PI / 2) % (2 * Math.PI);

        handleChangeTransform({
            targetMesh: selectedMesh as any,
            rotation,
            analytics: { edited: ["rotation"], source: "quick-edit" },
        });
    }, []);

    return (
        <Tool className="tool-btn" blink={true} onClick={handleClick}>
            <IconImg className="tool-icon" name="flip-left" size={22} />
        </Tool>
    );
}
