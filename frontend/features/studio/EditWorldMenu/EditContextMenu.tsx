import { CANVAS } from "@3gl/constants";
import { CMOption, CMSeparator, ContextMenu } from "../components/ContextMenu";
import { useEditableMesh, useSelectedItem } from "./hooks/worldHooks";
import { useEditWorld } from "./context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useMemo } from "react";
import { NftOpt, TextOpt } from "./AddAsset/shared/AssetTypes";
import {
    getAssetType,
    isArtwork,
    isComponent3D,
    isKitbash,
    isPortal,
    isStaticPortal,
} from "./utils";
import { isPlaceholder } from "@components/_3DExhibit-v2/ui/AssetsMenu/shared/utils";

const deleteOpt = {
    value: "delete",
    title: "Delete",
    icon: "trash-2",
};

const replaceOpt = {
    value: "replace",
    title: "Replace",
};

const duplicateOpt = {
    value: "duplicate",
    title: "Duplicate",
    icon: "copy",
};

const lockOpt = {
    value: "lock",
    title: "Lock",
    icon: "lock",
};

const unlockOpt = {
    value: "unlock",
    title: "Unlock",
    icon: "unlock",
};

function opt(o, disabled) {
    return {
        ...o,
        disabled,
    };
}

export function EditContextMenu() {
    //
    const {
        selectedItems,
        handleDeleteSelection,
        handleChangeLock,
        handleDuplicate,
        canEditLock,
        uiDispatch,
    } = useEditWorld();

    const selectedMesh = useEditableMesh();

    const canChangeLock = canEditLock(selectedMesh, { transform: true });

    const opts = useMemo(() => {
        //
        if (selectedItems.length === 0) return null;

        if (
            selectedItems.some(
                (it) =>
                    isPlaceholder(it) ||
                    isStaticPortal(it) ||
                    (isComponent3D(it) && !isKitbash(it))
            )
        ) {
            return null;
        }

        let opts = [
            opt(
                duplicateOpt,
                selectedItems.some((it) => !(isKitbash(it) || isArtwork(it)))
            ),
            deleteOpt,
            opt(
                replaceOpt,
                selectedItems.length > 1 || isKitbash(selectedMesh)
            ),
        ];

        if (selectedItems.length === 1) {
            opts.push(
                selectedMesh.isTransformLocked
                    ? opt(unlockOpt, !canChangeLock)
                    : opt(lockOpt, !canChangeLock)
            );
        }

        return opts;

        //
    }, [selectedMesh, selectedMesh?.isTransformLocked, canChangeLock]);

    const onAction = useEventCallback((action) => {
        //
        if (action === "duplicate") {
            //
            handleDuplicate({
                targetMeshes: selectedItems,
                source: "context",
                autoSelect: true,
            });
        }
        if (action === "delete") {
            //

            handleDeleteSelection({
                source: "context-menu",
            });
        } else if (action === "lock") {
            //
            handleChangeLock({ lock: { transform: true } });
        } else if (action === "unlock") {
            //
            handleChangeLock({ lock: { transform: false } });
        } else if (action === "replace") {
            //
            let option = getAssetType(selectedMesh);

            if (option === TextOpt) {
                option = NftOpt;
            }

            uiDispatch({ type: "opt-on", option });
        }
    }, []);

    return <ContextMenu target={CANVAS} options={opts} onAction={onAction} />;
}
