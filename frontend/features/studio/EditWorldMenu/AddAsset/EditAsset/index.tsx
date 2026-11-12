import { useEventCallback } from "@components/hooks/useEventCallback";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@3constants";
import { TYPES } from "@components/_3DExhibit-v2/three/factory/artwork/constants";

import { useEditWorld } from "../../context/WorldEditContext";
import {
    EditableMesh,
    getAssetType,
    isArtwork,
    isComponent3D,
    isKitbash,
    isPortal,
} from "../../utils";
import { EditArtwork } from "./EditArtwork";
import { EditAssetLayout } from "./EditAssetLayout";
import { EditPortal } from "./EditPortal";
import { EditText } from "./EditText";
import { EditComponent } from "./EditComponent";

export interface EditAssetProps {
    mesh: EditableMesh;
}

const captions = {
    text: "Edit text",
    portal: "Edit Portal",
    kitbash: "Edit Kitbash",
};

const defaultCaption = "Edit Asset";

export function EditAsset({ mesh, style = {} }) {
    //
    const { setSelectedItems } = useEditWorld();

    const world = useWorld();

    const handleClose = useEventCallback(() => {
        //
        setSelectedItems(null);
    }, []);

    const option = getAssetType(mesh);

    const title = captions[option.value] || defaultCaption;

    let content = null;

    const meshId = mesh.userData.id;

    if (isKitbash(mesh) || isComponent3D(mesh)) {
        //
        return <EditComponent key={meshId} />;
    } else if (isArtwork(mesh)) {
        if (mesh.mediaType === TYPES.CYBER_TEXT) {
            content = <EditText key={meshId} />;
        } else {
            content = <EditArtwork key={meshId} />;
        }
    } else if (isPortal(mesh)) {
        content = <EditPortal key={meshId} />;
    }

    return (
        <EditAssetLayout
            title={title}
            icon={option.icon}
            style={style}
            onClose={handleClose}
            variant={option.value === "text" ? "content" : "inspector"}
        >
            {content}
        </EditAssetLayout>
    );
}
