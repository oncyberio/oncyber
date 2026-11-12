import React, { useState } from "react";
import styled from "styled-components";
import { CYBER_TEXT_UPDATE_TYPES } from "@3gl/factory/artwork/meshes/text/constants";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useEventCallback } from "@components/hooks/useEventCallback";
import Slider from "@features/studio/styles/Slider";
import { useSyncState } from "@components/hooks/useSyncState";

export function TextHeight() {
    //
    const selectedMesh = useSelectedArtwork();

    const { handleChangeText } = useEditWorld();

    const world = useWorld();

    const [height, setHeight] = useSyncState(
        selectedMesh?.userData?.lineHeight || 60
    );

    const handleSaveDelayed = useDebouncedCallback(async (update) => {
        //
        handleChangeText({ update });
    }, 1000);

    const handleChange = useEventCallback(
        async (lineHeight: number, isDragging: boolean) => {
            //
            lineHeight = Math.max(lineHeight, 1);

            setHeight(lineHeight);

            const update = {
                lineHeight,
            };

            const data = await world.current.edit({
                type: EDITION_ACTIONS.UPDATE_CYBER_TEXT,
                meshId: selectedMesh.userData.id,
                ...update,
            });

            if (isDragging) return;

            handleSaveDelayed(update);
        },
        []
    );

    return (
        <Field>
            <Label>Line Height</Label>
            <Slider
                min={0}
                max={120}
                isLimitless={true}
                onChange={handleChange}
                value={height}
                mode="dark"
            />
        </Field>
    );
}

const Container = styled.div`
    display: flex;
    margin-top: 20px;
    margin-bottom: 24px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
`;
