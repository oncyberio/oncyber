import { useContext } from "react";
import { EditAssetsContext, EditAssetsMenuContext } from "./EditAssetsProvider";

export { EditModes } from "./EditAssetsProvider";

export function useAssetsMenuContext() {
    const context = useContext(EditAssetsMenuContext);

    if (context === undefined) {
        throw new Error(
            "useAssetsMenuContext must be used within <AssetsMenuContainer />"
        );
    }

    return context || ({} as EditAssetsContext);
}
