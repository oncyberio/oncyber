import { useEventCallback } from "@components/hooks/useEventCallback";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useEditWorld } from "../../../context/WorldEditContext";
import { EditAssetLayout } from "../EditAssetLayout";
import { Tool, Toolbar } from "@features/studio/styles/Toolbar";
import { EditComponentLayout } from "../EditComponent/Layout";
import { RemoveButton } from "../EditArtwork/RemoveButton";
import { CloseButton } from "../EditArtwork/CloseButton";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import IconImg from "@ui/components/IconImg";
import { noop } from "@utils/js";
import { toXYZ } from "@3utils/three";

export function MultiSelect() {
    //
    const {
        selectedItems,
        setSelectedItems,
        handleDuplicate,
        handleChangeTransform,
    } = useEditWorld();

    const handleClose = useEventCallback(() => {
        //
        setSelectedItems(null);
    }, []);

    const title = `Selection (${selectedItems.length} items)`;

    const handleRotate = useEventCallback(() => {
        //
        const payloads: any[] = selectedItems
            .filter((item) => {
                return item.prefTransformControls != null;
                //
            })
            .map((item) => {
                //
                const position = toXYZ(item.position);
                const rotation = toXYZ(item.rotation);

                const newRotation = {
                    x: rotation.x,
                    y: (rotation.y + Math.PI / 2) % (Math.PI * 2),
                    z: rotation.z,
                };

                return {
                    targetMesh: item,
                    coords: { position, rotation: newRotation },
                    undo: { position: { ...position }, rotation },
                };
            });

        handleChangeTransform({
            payloads,
            analytics: {
                edited: ["rotation"],
                source: "quick-edit",
            },
        });
        //
    }, []);

    const handleDuplicateSelection = useEventCallback(() => {
        //
        handleDuplicate({
            targetMeshes: selectedItems,
            source: "quick-edit",
            autoSelect: true,
        });
        //
    }, []);

    return (
        <EditComponentLayout
            title={title}
            sideAction={
                <>
                    <RemoveButton />
                    <CloseButton />
                </>
            }
        >
            <Field>
                <Label className="component-label">Quick Edit Controls</Label>
                <Toolbar className="quick-edit-toolbar">
                    <QuickTool icon="rotate-left-90" onClick={handleRotate} />
                    <QuickTool icon="flip-left" disabled />
                    <QuickTool icon="flip-down" disabled />
                    <QuickTool icon="copy" onClick={handleDuplicateSelection} />
                </Toolbar>
            </Field>
        </EditComponentLayout>
    );
}

function QuickTool({ icon, disabled = false, onClick = noop }) {
    //
    return (
        <Tool className="tool-btn" onClick={onClick} disabled={disabled}>
            <IconImg className="tool-icon" name={icon} size={22} />
        </Tool>
    );
}
