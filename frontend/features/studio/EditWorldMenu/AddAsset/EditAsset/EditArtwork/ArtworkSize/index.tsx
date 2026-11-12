import React, { ChangeEvent, useRef } from "react";

import type { SpaceArtwork } from "@3artwork/abstract";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useSyncState } from "@components/hooks/useSyncState";
import {
    ACTION_FAIL_MESSAGES,
    SNACKBAR_DURATION,
} from "@features/studio/utils/constants";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { useEventCallback } from "@components/hooks/useEventCallback";
import Slider from "@features/studio/styles/Slider";
import { Label } from "@features/studio/styles/Label";
import { Field } from "@features/studio/styles/Field";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";

function scaleToUISize(mesh: SpaceArtwork, scale = mesh.scale.x) {
    if (mesh.isArtwork && !mesh.isPlaceholder) {
        return Math.round(Math.round(mesh.scaleToUISize(scale) * 100) / 100);
    }
    return Math.round(mesh?.scale?.x) || 0;
}

export function ArtworkSize() {
    //

    const mesh = useSelectedArtwork();

    const world = useWorld();

    const { handleChangeTransform } = useEditWorld();

    const [artworkSize, setArtworkSize] = useSyncState(scaleToUISize(mesh));

    const handleSaveDelayed = useDebouncedCallback((payload, uiSize) => {
        //
        handleChangeTransform({
            targetMesh: mesh as any,
            ...payload,
            analytics: { edited: ["size"], source: "slider" },
        });
    }, 1000);

    const handleChange = useEventCallback(async (uiSize, isDragging) => {
        //
        uiSize = Math.max(uiSize, 1);

        setArtworkSize(uiSize);

        const s = mesh.uiSizeToScale(uiSize);

        const update = {
            id: mesh.userData.id,
            scale: {
                x: s,
                y: s,
                z: s,
            },
        };

        const result = await world.current.edit({
            type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM,
            artworkId: mesh.userData.id,
            updates: [update],
        });

        if (isDragging) return;

        handleSaveDelayed(result[0], uiSize);
    }, []);

    return (
        <Field>
            <Label className="component-label">Edit Size</Label>
            <Slider
                min={0}
                max={600}
                onChange={handleChange}
                value={artworkSize}
                isLimitless={true}
                mode="dark"
            />
        </Field>
    );
}
