import React from "react";
import styled from "styled-components";

import { CYBER_TEXT_UPDATE_TYPES } from "@3gl/factory/artwork/meshes/text/constants";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { useSyncState } from "@components/hooks/useSyncState";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import Slider from "@features/studio/styles/Slider";
import { useEventCallback } from "@components/hooks/useEventCallback";

export function TextWidth() {
    //
    const selectedMesh = useSelectedArtwork();

    const { handleChangeText } = useEditWorld();

    const world = useWorld();

    const [width, setWidth] = useSyncState(
        selectedMesh?.userData?.width || 500
    );

    const handleSaveDelayed = useDebouncedCallback(async (update) => {
        //
        handleChangeText({ update });
    }, 1000);

    const handleChangeWidth = useEventCallback(
        async (value: number, isDragging: boolean) => {
            //
            const width = Math.max(value, 1);

            setWidth(width);

            const update = {
                width,
            };

            const data = await world.current.edit({
                type: EDITION_ACTIONS.UPDATE_CYBER_TEXT,
                meshId: selectedMesh.userData.id,
                ...update,
            });

            handleSaveDelayed(update);
            //
        },
        []
    );

    return (
        <Field>
            <Label>Container Width</Label>
            <Slider
                min={300}
                max={4000}
                isLimitless={true}
                onChange={handleChangeWidth}
                value={width}
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

const Name = styled.label`
    font-weight: 500;
    font-size: 14px;
    line-height: 24px;
    color: #27282c;
    margin-right: 40px;
`;
