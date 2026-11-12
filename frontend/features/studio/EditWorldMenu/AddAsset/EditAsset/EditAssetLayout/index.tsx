import React from "react";
import { InspectorFrame } from "./InspectorFrame";
import { ToggleScriptEditor } from "../EditArtwork/ToggleScriptEditor";
export function EditAssetLayout(props: React.ComponentProps<typeof InspectorFrame>) {
    return <InspectorFrame {...props} actions={<ToggleScriptEditor />} />;
}
