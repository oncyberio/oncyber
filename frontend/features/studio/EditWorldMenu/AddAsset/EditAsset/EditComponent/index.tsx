import { useSelectedComponent } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import ElementGui from "@3globals/elementgui";
import { useEffect } from "react";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEditorService } from "@features/studio/context/ExhibitEditorContext";
import { useStylekit } from "@components/hooks/useStylekit";
import { isComponent3D, isKitbash } from "@features/studio/EditWorldMenu/utils";
import { EditComponentLayout } from "./Layout";
import { RemoveButton } from "../EditArtwork/RemoveButton";
import { CloseButton } from "../EditArtwork/CloseButton";
import { ToggleScriptEditor } from "../EditArtwork/ToggleScriptEditor";
// import { toXYZ } from "@components/_3DExhibit-v2/three/utils/three";

export function EditComponent() {
    //
    const { exhibit } = useEditWorld();

    const editorService = useEditorService();

    const element = useSelectedComponent();

    const stylekitData = useStylekit(exhibit.info.room);

    const kitImgs = stylekitData.data?.kitbashImgs;

    useEffect(() => {
        //
        if (element == null) return;

        function handleUpdate() {
            //
            ElementGui.update();
        }

        function handleCommand(e) {
            //
            editorService.pushCommand(e);
        }

        element.on("ui", handleUpdate);

        element.on("command", handleCommand);

        return () => {
            //
            element.off("ui", handleUpdate);

            element.off("command", handleCommand);
        };
    }, []);

    let title = null;

    let help = null;

    let image = null;

    if (isKitbash(element)) {
        //
        image = kitImgs?.[element.data.type];
        title = element.data.type;
    } else if (isComponent3D(element)) {
        //
        image = element.image;
        title = element.title;
        help = element.help;
    }

    // const info = (
    //     <div style={{ padding: 20, width: "100%" }}>
    //         <ArtworkInfo asset={asset} canDelete={!element.isRequired} />
    //     </div>
    // );

    let removeStyle: React.CSSProperties = {};

    if (element.isRequired) {
        removeStyle = {
            pointerEvents: "none",
            opacity: 0.2,
            cursor: "not-allowed",
        };
    }

    return (
        <EditComponentLayout
            title={title}
            help={help}
            image={image}
            sideAction={
                <>
                    <ToggleScriptEditor />
                    <RemoveButton style={removeStyle} />
                    <CloseButton />
                </>
            }
        >
            {/* <pre>{JSON.stringify(element.data, null, 4)}</pre> */}
            {element &&
                ElementGui.render({
                    source: element,
                    undoManager: editorService,
                    autoUndo: false,
                    title: `Edit ${element.data.type}`,
                    embedded: true,
                    // info,
                })}
            {/* <pre>{JSON.stringify(toXYZ(element.position), null, 4)}</pre> */}
        </EditComponentLayout>
    );
}
