import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { ArtworkFramePicker } from "./ArtworkFramePicker";
export function ArtworkFrameColor() {
    const mesh = useSelectedArtwork();
    const { handleChangeFrame } = useEditWorld();
    return (
        <ArtworkFramePicker
            value={mesh?.userData?.borderColor}
            disabled={!mesh}
            onChange={(color) =>
                handleChangeFrame({
                    color,
                    targetMeshes: [mesh],
                    isRemove: color.endsWith("-borderless"),
                })
            }
        />
    );
}
