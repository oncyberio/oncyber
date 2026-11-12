import { GUIWrapper } from "@gui/GUI/GuiWrapper";
import FutureGui from "@3globals/futuregui.js";
import EditWorldMenu from "@features/studio/EditWorldMenu";
import ReactDOM from "react-dom";

interface KitbashGUIProps {
    submitAction: any;
    handleSubmit: any;
    handleCancel: any;
}

export function KitbashGUI({
    submitAction,
    handleSubmit,
    handleCancel,
}: KitbashGUIProps) {
    //

    // const updateKitbash = useEventCallback((data: KitBashData) => {
    //     setKitbash((state) => {
    //         return {
    //             ...state,
    //             [data.id]: data,
    //         };
    //     });
    // }, []);

    // const removeKitbash = useEventCallback((data: KitBashData) => {
    //     //

    //     setKitbash((state) => {
    //         const newState = {
    //             ...state,
    //         };

    //         delete newState[data.id];

    //         return newState;
    //     });
    // }, []);

    // useWorldHandler(Events.KITBASH_ADD, updateKitbash);

    // useWorldHandler(Events.KITBASH_UPDATE, updateKitbash);

    // useWorldHandler(Events.KITBASH_REMOVE, removeKitbash);

    // return FutureGui.render({
    //     submitAction,
    //     onSubmit: handleSubmit,
    //     onCancel: handleCancel,
    // });
    return ReactDOM.createPortal(
        <div style={{ position: "relative", zIndex: 10000 }}>
            <EditWorldMenu scope="uploader" />
        </div>,
        document.body
    );
}
