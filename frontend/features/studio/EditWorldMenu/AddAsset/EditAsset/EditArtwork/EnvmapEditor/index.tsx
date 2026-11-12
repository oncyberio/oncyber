import React, { useContext } from "react";
import { UserContext } from "@context/UserContext";

import styled from "styled-components";
import { TYPES } from "@3artwork/constants";
import { ENVMAPS } from "@components/_3DExhibit-v2/utils/envmaps";
import { useSyncState } from "@components/hooks/useSyncState";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import Slider from "@features/studio/styles/Slider";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";

export function EnvmapEditor() {
    //
    const selectedMesh = useSelectedArtwork();

    const world = useWorld();

    const { handleChangeEnvmap } = useEditWorld();

    const [envmapIntensity, setEnvmapIntensity] = useSyncState(
        selectedMesh.userData.envmapIntensity
    );

    const handleSaveDelayed = useDebouncedCallback((payload) => {
        //
        handleChangeEnvmap({
            targetMesh: selectedMesh,
            ...payload,
        });
    }, 1000);

    const handleChange = useEventCallback(async (value, isDragging) => {
        //
        let intensity = Math.min(Math.max(value, 0), 100) / 100;

        setEnvmapIntensity(intensity);

        const result = await world.current.edit({
            type: EDITION_ACTIONS.EDITOR_CHANGE_ENVMAP,
            artworkId: selectedMesh.userData.id,
            envmap: "scene",
            envmapIntensity: intensity,
        });

        if (isDragging) return;

        handleSaveDelayed(result);
    }, []);

    if (selectedMesh.mediaType !== TYPES.MODEL) return null;

    return (
        <Field>
            <Label className="component-label">Reflection</Label>
            <Slider
                min={0}
                max={100}
                onChange={handleChange}
                value={envmapIntensity * 100}
                isLimitless={true}
                mode="dark"
            />
        </Field>
    );
}

const Colors = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 5px 0;

    & > div {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-right: 16px;

        p {
            margin: 4px 0;
            font-size: 12px;
            text-transform: uppercase;
            text-align: center;
        }
    }
`;

const ColorCircle = styled.span<{
    url: string;
    isActive: boolean;
}>`
    width: 40px;
    height: 40px;
    background-color: black;
    background: url(${({ url }) => url});
    background-size: cover;
    background-repeat: no-repeat;
    border: ${({ isActive }) =>
        isActive ? "2px solid #ffffff" : "1px solid lightgrey"};
    opacity: ${({ isActive }) => (isActive ? "1" : "0.7")};

    padding: 1px;
    border-radius: 40px;
    margin-right: 2px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    @media (max-width: 600px) {
        width: 24px;
        height: 24px;
    }
`;
