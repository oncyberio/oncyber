import { LockTransformControl } from "./LockTransformControl";
import { useEditWorld } from "../../context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSelectedArtwork, useSelectedItem } from "../../hooks/worldHooks";
import { useContext, useState } from "react";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { UserContext } from "@components/context/UserContext";
import { canChangeLock } from "../../utils";
import { useSyncState } from "@components/hooks/useSyncState";

export function LockTransform() {
    //
    const { user } = useContext(UserContext);

    const { roles } = useCurrentExhibit();

    const { handleChangeLock } = useEditWorld();

    const selectedMesh = useSelectedItem();

    const canChange = canChangeLock(
        selectedMesh.userData.lock,
        { transform: true },
        user.id,
        roles
    );

    const [isLocked, setLocked] = useSyncState(selectedMesh.isTransformLocked);

    const handleLockChange = useEventCallback(() => {
        //
        setLocked(!isLocked);

        handleChangeLock({ lock: { transform: !isLocked } });
        //
    }, []);

    return (
        <LockTransformControl
            locked={isLocked}
            disabled={!canChange}
            onChange={handleLockChange}
        />
    );
}
