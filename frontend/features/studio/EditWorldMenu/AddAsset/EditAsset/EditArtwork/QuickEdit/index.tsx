import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import IconImg from "@ui/components/IconImg";
import { Tool, Toolbar } from "@features/studio/styles/Toolbar";
import { TYPES } from "@3artwork/constants";
import { VideoOptsTool } from "./VideoOptsTool";
import { AudioOptsTool } from "./AudioOptsTool";
import { Rotate90Tool } from "./Rotate90Tool";
import { ImageHDTool } from "./HDImageTool";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { isArtwork } from "@features/studio/EditWorldMenu/utils";
import { Rotate90HorzTool } from "./Rotate90HorzTool";

export function QuickEdit() {
    //

    const artwork = useSelectedArtwork();

    const isModel = artwork.mediaType === TYPES.MODEL;

    return (
        <Field>
            <Label className="component-label">Quick Edit Controls</Label>
            <Toolbar className="quick-edit-toolbar">
                <Rotate90Tool />

                {isModel && <Rotate90HorzTool />}

                <AudioOptsTool />

                <VideoOptsTool />

                <ImageHDTool />
            </Toolbar>
        </Field>
    );
}
