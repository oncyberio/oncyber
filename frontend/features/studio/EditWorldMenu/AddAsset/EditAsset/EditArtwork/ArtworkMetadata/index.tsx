import styled from "styled-components";
import { useEffect, useState } from "react";
import { TYPES } from "@components/_3DExhibit-v2/three/factory/artwork/constants";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import { TextArea, TextInput } from "@features/studio/styles/Input";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";

export function AssetMetadata() {
    //
    const { handleUpdateArtworkData } = useEditWorld();

    const selectedMesh = useSelectedArtwork();

    const [titleSaved, setTitleSaved] = useState(false);

    const [loading, setLoading] = useState(false);

    const [name, setName] = useState(selectedMesh?.userData?.name || "");

    const handleSave = useEventCallback(async () => {
        //
        if (name == selectedMesh.userData?.name || titleSaved) {
            return;
        }

        try {
            setLoading(true);

            await handleUpdateArtworkData({ data: { name: name } });

            setTitleSaved(true);
        } finally {
            setLoading(false);
        }
    }, []);

    return (
        <Field>
            <SaveTitle
                isSaved={
                    name != selectedMesh?.userData?.name &&
                    !loading &&
                    !titleSaved
                }
            >
                <Label className="component-label">Title</Label>
                <a onClick={handleSave}>
                    {name != selectedMesh?.userData?.name && !titleSaved
                        ? loading
                            ? "Saving..."
                            : "Save"
                        : "Saved"}
                </a>
            </SaveTitle>
            <TextInput
                value={name}
                onChange={(e) => {
                    setTitleSaved(false);
                    setName(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (!e.repeat && e.key === "Enter") {
                        handleSave();
                    }
                }}
                placeholder="Untitled"
            />
        </Field>
    );
}

const SaveTitle = styled.div<{
    isSaved: boolean;
}>`
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 4px 0;
    margin: 0;
    h3 {
        margin: 0;
    }
    a {
        cursor: pointer;
        // padding: 4px 8px 0 8px;
        font-size: 14px;
        color: ${({ isSaved }) => (!isSaved ? "#bcbcbc" : "#ffffff")};
        /* &:hover {
            color: #1d1d1d;
        } */
        @media (max-width: 600px) {
            font-size: 13px;
        }
    }
`;
