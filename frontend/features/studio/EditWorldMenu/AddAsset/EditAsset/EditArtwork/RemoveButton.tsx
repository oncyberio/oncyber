import { TYPES } from "@3factory/artwork/constants";
import { useContext, useState } from "react";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { selectUserId } from "@utils/assets";
import { UserContext } from "@context/UserContext";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import IconImg from "@ui/components/IconImg";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSelectedItem } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import {
    isArtwork,
    isComponent3D,
    isPortal,
} from "@features/studio/EditWorldMenu/utils";
import { isKitBash } from "@components/_3DExhibit-v2/ui/AssetsMenu/shared/utils";

export function RemoveButton({ className = "", style = {} }) {
    //
    const { handleDeleteSelection } = useEditWorld();

    const selectedMesh = useSelectedItem();

    const [isRemoveLoading, setRemoveLoading] = useState(false);

    const handleDelete = useEventCallback(() => {
        //
        try {
            setRemoveLoading(true);

            handleDeleteSelection({
                source: "asset_edit",
            });

            //
        } finally {
            setRemoveLoading(false);
        }
    }, []);

    return (
        <div
            className={className}
            style={{ cursor: "pointer", ...style }}
            onClick={handleDelete}
        >
            <IconImg name="trash" size={16} style={{ filter: "invert(0.5)" }} />
        </div>
    );
}
