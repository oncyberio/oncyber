import React, { useEffect, useRef, useState } from "react";
import { Placement3D, Placement3DChange, Placement3DMode } from "./Placement3D";
import { useSyncState } from "@components/hooks/useSyncState";
import { toDegreeXYZ, toNumXYZ, toRadianXYZ, xyzEquals } from "./mathUtils";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { EditableMesh } from "../../utils";
import { useEditWorld } from "../../context/WorldEditContext";
import { Euler, Quaternion } from "three";
import { useSelectedArtwork, useSelectedItem } from "../../hooks/worldHooks";
import { LockTransform } from "./LockTransform";
import { toXYZ } from "@components/_3DExhibit-v2/three/utils/three";
import { XYZ } from "@gltypes";

const euler = new Euler(0, 0, 0);

const quaternion = new Quaternion();

function toRot(q: Quaternion, order: "XYZ" | "YXZ"): XYZ {
    //
    return toXYZ(euler.setFromQuaternion(q, order));
}

function toXYZRot(yxz: XYZ) {
    //
    quaternion.setFromEuler(euler.set(yxz.x, yxz.y, yxz.z, "YXZ"));

    return toRot(quaternion, "XYZ");
}

export function ArtworkPlacement({
    mesh,
    isYOnly,
}: {
    mesh: EditableMesh;
    isYOnly?: boolean;
}) {
    //
    const { handleChangeTransform: handleEditCoords } = useEditWorld();

    const selectedMesh = useSelectedItem();

    const world = useWorld();

    const [artworkPosition, setArtworkPosition] = useSyncState(
        toNumXYZ(mesh.position),
        xyzEquals
    );

    const [artworkRotation, setArtworkRotation] = useSyncState(
        toDegreeXYZ(toRot(mesh.quaternion, "YXZ")),
        xyzEquals
    );

    const [cursorMode, setCursorMode] = useState<Placement3DMode>("position");

    useEffect(() => {
        setCursorMode("position");
        world.current.edit({
            type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM_MODE,
            mode: "position",
        });
    }, [mesh]);

    const lastTimeSaved = useRef(0);

    const handleChangeArtworkPlacement = async (
        mode: any,
        e: Placement3DChange
    ) => {
        //
        let payload;

        if (mode === "position") {
            //
            payload = { ...artworkPosition, ...e };

            setArtworkPosition(payload);
            //
        } else if (mode === "rotation") {
            //
            payload = { ...artworkRotation, ...e };

            setArtworkRotation(payload);

            payload = toXYZRot(toRadianXYZ(payload));
        }

        const editorAction = {
            type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM,
            updates: [
                {
                    id: mesh.userData.id,
                    [mode]: payload,
                },
            ],
        };

        const data = await world.current.edit(editorAction);

        const now = Date.now();

        if (now - lastTimeSaved.current > 1000) {
            //
            lastTimeSaved.current = now;

            handleEditCoords({
                targetMesh: mesh,
                [mode]: payload,
                analytics: { edited: [mode], source: "asset_edit" },
            });
        }
    };

    return (
        <Placement3D
            mode={cursorMode}
            position={artworkPosition}
            rotation={artworkRotation}
            isYOnly={isYOnly}
            locked={selectedMesh.isTransformLocked}
            locker={<LockTransform />}
            onToggleMode={(mode) => {
                setCursorMode(mode);
                world.current.edit({
                    type: EDITION_ACTIONS.EDITOR_CHANGE_TRANSFORM_MODE,
                    mode,
                });
            }}
            onChange={handleChangeArtworkPlacement}
        />
    );
}
