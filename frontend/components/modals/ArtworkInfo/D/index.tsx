import { ArtworkInfoProps } from "../types";
import { ArtworkInfoProvider } from "./ArtworkContext";
import { ArtworkInfoDesktop } from "./Desktop";

export default function D_ArtworkInfo(props: ArtworkInfoProps) {
    //

    if (!props.isShowing || props.artwork == null || props.isTransition) {
        return null;
    }

    return (
        <ArtworkInfoProvider {...props}>
            <ArtworkInfoDesktop {...props} />
        </ArtworkInfoProvider>
    );
}
