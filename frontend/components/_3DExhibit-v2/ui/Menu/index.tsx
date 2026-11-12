import D_Menu from "./D_Menu";
import M_Menu from "./M_Menu";
import type { SceneMenuProps } from "./types";

export default (props: SceneMenuProps) => {
    //
    const Components = props?.isMobile ? M_Menu : D_Menu;

    return <Components {...props} />;
};
