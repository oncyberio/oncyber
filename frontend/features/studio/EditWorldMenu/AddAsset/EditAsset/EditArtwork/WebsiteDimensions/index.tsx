import { ChangeEvent, useEffect, useState } from "react";

import styled from "styled-components";

import { TYPES } from "@components/_3DExhibit-v2/three/factory/artwork/constants";
import Textarea from "@ui/components/Textarea";
import Input from "@ui/components/Input";

import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { useSyncState } from "@components/hooks/useSyncState";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { Field } from "@features/studio/styles/Field";
import { TextInput } from "@features/studio/styles/Input";
import { Label } from "@features/studio/styles/Label";
import { deepEqual } from "@utils/js";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";

export function WebsiteDimensions() {
    //
    const selectedMesh = useSelectedArtwork();

    const world = useWorld();

    const { handleChangeDimensions } = useEditWorld();

    const [dimensions, setDimensions] = useSyncState<[number, number]>(
        selectedMesh?.userData?.dimensions,
        deepEqual
    );

    const handleSaveDelayed = useDebouncedCallback((payload) => {
        //
        handleChangeDimensions(payload);
    }, 1000);

    const handleChange = useEventCallback(
        async (e: ChangeEvent<HTMLInputElement>, index: 0 | 1) => {
            let s = +e.target.value;

            if (isNaN(s)) {
                return;
            }

            s = Math.max(s, 1);

            let newDims: [number, number] = [...dimensions];

            setDimensions(newDims);

            newDims[index] = s;

            const editorAction = {
                type: EDITION_ACTIONS.EDITOR_CHANGE_DIMENSIONS,
                artworkId: selectedMesh.userData.id,
                dimensions: newDims,
            };

            const result = await world.current.edit(editorAction);

            handleSaveDelayed(result);
        },
        []
    );

    return (
        <Field>
            <Label className="component-label">Dimensions</Label>

            <InputWrapper>
                <TextInput
                    value={dimensions?.[0]}
                    onChange={(e) => {
                        handleChange(e, 0);
                    }}
                    placeholder="Width"
                />

                <TextInput
                    value={dimensions?.[1]}
                    onChange={(e) => {
                        handleChange(e, 1);
                    }}
                    placeholder="Height"
                />
            </InputWrapper>
        </Field>
    );
}

const InputWrapper = styled.div`
    display: flex;
    flex-direction: row;
    gap: 12px;

    & > input {
        color: #ffffff;
        min-width: 0;
    }
`;
