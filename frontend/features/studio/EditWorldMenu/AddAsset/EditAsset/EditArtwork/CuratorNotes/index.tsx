import styled from "styled-components";
import { useEffect, useState } from "react";
import { TYPES } from "@components/_3DExhibit-v2/three/factory/artwork/constants";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import { TextArea } from "@features/studio/styles/Input";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";

export function CuratorNotes() {
    //
    const { handleUpdateCuratorNotes } = useEditWorld();

    const selectedMesh = useSelectedArtwork();

    const [notesSaved, setNotesSaved] = useState(false);

    const [loading, setLoading] = useState(false);

    const [curatorNotes, setCuratorNotes] = useState(
        selectedMesh?.userData?.curatorNotes || ""
    );

    const handleSave = useEventCallback(async () => {
        //
        if (curatorNotes == selectedMesh.userData?.curatorNotes || notesSaved) {
            return;
        }

        try {
            setLoading(true);

            await handleUpdateCuratorNotes({ curatorNotes });

            setNotesSaved(true);
        } finally {
            setLoading(false);
        }
    }, []);

    return (
        <Field>
            <SaveTitle
                isSaved={
                    curatorNotes != selectedMesh?.userData?.curatorNotes &&
                    !loading &&
                    !notesSaved
                }
            >
                <Label className="component-label">Curator Notes</Label>
                <a onClick={handleSave}>
                    {curatorNotes != selectedMesh?.userData?.curatorNotes &&
                    !notesSaved
                        ? loading
                            ? "Saving..."
                            : "Save"
                        : "Saved"}
                </a>
            </SaveTitle>
            <TextArea
                value={curatorNotes}
                onChange={(e) => {
                    setNotesSaved(false);
                    setCuratorNotes(e.target.value);
                }}
                placeholder="Additional notes about the artwork"
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
