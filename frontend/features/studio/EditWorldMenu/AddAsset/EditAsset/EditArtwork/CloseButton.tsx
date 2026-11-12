import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@3constants";
import { useEventCallback } from "@components/hooks/useEventCallback";
import IconImg from "@ui/components/IconImg";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";

export function CloseButton({ className = "", style = {} }) {
    //
    const { setSelectedItems } = useEditWorld();

    const handleClose = useEventCallback(() => {
        //
        setSelectedItems(null);
        //
    }, []);

    return (
        <div
            className={className}
            style={{ cursor: "pointer", ...style }}
            onClick={handleClose}
        >
            <IconImg name="x" size={16} style={{ filter: "invert(0.5)" }} />
        </div>
    );
}
