import React, { ChangeEvent, useEffect, useRef } from "react";
import styled from "styled-components";

import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useSyncState } from "@components/hooks/useSyncState";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import { TextArea } from "@features/studio/styles/Input";
import IconImg from "@ui/components/IconImg";
import { studioAction } from "@features/studio/styles/primitives";

export function TextInput() {
    //
    const selectedMesh = useSelectedArtwork();

    const { handleChangeText, handleDeleteSelection, exhibit } = useEditWorld();

    const isNew = exhibit.artworks[selectedMesh.userData.id] == null;

    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        //
        if (isNew) {
            //
            inputRef.current.select();
        }
        //
    }, []);

    const world = useWorld();

    const [text, setText] = useSyncState(selectedMesh?.userData?.text || "");

    const handleSaveDelayed = useDebouncedCallback(
        //
        async (update) => {
            //
            handleChangeText({ targetMesh: selectedMesh, update });
        },
        1000,
        { leading: true }
    );

    const handleTextChange = async (e: ChangeEvent<HTMLTextAreaElement>) => {
        //
        const text = e.target?.value;

        setText(text);

        const update = {
            type: EDITION_ACTIONS.UPDATE_CYBER_TEXT,
            text,
            meshId: selectedMesh?.userData?.id,
        };

        const data = await world.current.edit(update);

        handleSaveDelayed(update);
    };

    return (
        <Field>
            <Head>
                <Label as="label" htmlFor="edit-world-text">
                    Text
                </Label>
                <DeleteButton
                    type="button"
                    aria-label="Delete text"
                    title="Delete text"
                    onClick={() =>
                        handleDeleteSelection({ source: "asset_edit" })
                    }
                >
                    <IconImg name="trash" size={16} mode="light" />
                </DeleteButton>
            </Head>
            <TextArea
                id="edit-world-text"
                ref={inputRef}
                autoFocus={true}
                rows={3}
                value={text}
                onChange={handleTextChange}
                placeholder="Enter text here"
            />
        </Field>
    );
}

const Head = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const DeleteButton = styled.button`
    ${studioAction}
    width: 28px;
    height: 28px;
    min-height: 28px;
    padding: 0;
    opacity: 0.6;

    &:hover:not(:disabled) {
        opacity: 1;
        background: #d9676726;
    }

    @media (max-width: 600px) {
        width: 44px;
        height: 44px;
    }
`;
