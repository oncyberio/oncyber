import React, { useState, useContext } from "react";
import styled from "styled-components";

import Events from "@3events";

import { WorldEditorOpt } from "../shared/AssetTypes";

import { AddAssetLayout } from "../AddAssetLayout";
import { isEditableMesh } from "@features/studio/EditWorldMenu/utils";
import { useEditWorld } from "../../context/WorldEditContext";
import {
    useCoordsChangeHandler,
    useSelectedMeshEvents,
} from "../../hooks/worldHooks";
import { useHotkey } from "@components/hooks/useHotkey";
import { useUndoManager } from "../../hooks/useUndoManager";
import { UserContext } from "@components/context/UserContext";
import { WorldEditor } from "../WorldEditor";
import { WorldListView } from "../WorldEditor/WorldListView";
import { FloatBtn } from "../shared/FloatBtn";
import { useWorldHandler } from "@components/_3DExhibit-v2/hooks/useWorldHandler";
import { DELETE_KEY } from "@components/_3DExhibit-v2/three/constants";

export function AddAsset_UploaderMode() {
    //

    useContext(UserContext);

    const {
        destination,
        handleDeleteSelection,
        selectedMesh,
        selectedItems,
        transformMode,
        toggleTransformMode,
    } = useEditWorld();

    const editableMesh = isEditableMesh(selectedMesh) ? selectedMesh : null;

    const isFuture = destination.isFuture;

    useSelectedMeshEvents(isFuture);

    useCoordsChangeHandler();

    useUndoManager();

    const [isCollapsed, setIsCollapsed] = useState(false);

    useHotkey((e: KeyboardEvent) => {
        //

        if (e.repeat || e.metaKey || e.ctrlKey || e.shiftKey) return;

        e.preventDefault();

        if (e.key === DELETE_KEY) {
            //
            if (editableMesh != null) {
                //
                handleDeleteSelection({
                    source: "shortcut",
                });
            }
        } else if (e.key === "t" || e.key === "T") {
            //
            if (transformMode !== "snap") {
                //
                toggleTransformMode();
            }
        }
    });

    let content = null;

    if (isCollapsed) {
        //
        content = (
            <FloatBtn
                className="content"
                icon="world-build"
                onClick={() => setIsCollapsed(false)}
            />
        );
    } else {
        content = (
            <div className="content add-layout">
                <AddAssetLayout
                    option={WorldEditorOpt}
                    onClose={() => setIsCollapsed(true)}
                >
                    <WorldEditor />
                </AddAssetLayout>
            </div>
        );
    }

    return (
        <Container>
            <WorldListView />
            {content}
        </Container>
    );
}

const Container = styled.div`
    //
    --float-bg-color: #1e1e1e;
    --edit-asset-top: 0;
    --edit-asset-left: 0;

    & > .content {
        position: absolute;
        top: 90px;
        left: 25px;
        z-index: 1;
    }

    & > .add-layout {
        background: var(--float-bg-color);
        align-items: flex-start;
        padding-bottom: 8px;
    }
`;
