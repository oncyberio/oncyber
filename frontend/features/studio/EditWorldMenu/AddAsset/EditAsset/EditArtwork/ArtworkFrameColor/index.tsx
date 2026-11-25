import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { TYPES } from "@3factory/artwork/constants";
import { galleryLabelText } from "@3factory/border/galleryFrame";
import { ArtworkFramePicker } from "./ArtworkFramePicker";

/** Media that can take the gallery frame (see SpaceArtwork.galleryFrame). */
const GALLERY_TYPES: string[] = [TYPES.IMAGE, TYPES.VIDEO, TYPES.PANORAMA];

export function ArtworkFrameColor() {
    const mesh = useSelectedArtwork();
    const { handleChangeFrame } = useEditWorld();
    const data = mesh?.userData as any;
    const allowGallery =
        !!mesh &&
        GALLERY_TYPES.includes(mesh.mediaType) &&
        (data?.shape || "square") === "square";
    return (
        <ArtworkFramePicker
            key={data?.id}
            value={data?.borderColor}
            frame={data?.frame ?? null}
            disabled={!mesh}
            allowGallery={allowGallery}
            hasLabelText={galleryLabelText(data) != null}
            allowSquare={mesh?.mediaType !== TYPES.PANORAMA}
            onChange={(color) =>
                handleChangeFrame({
                    color,
                    targetMeshes: [mesh],
                    isRemove: color.endsWith("-borderless"),
                })
            }
            onFrameChange={(frame, color) =>
                handleChangeFrame({
                    color,
                    frame,
                    targetMeshes: [mesh],
                })
            }
            onFramePreview={(frame) => mesh?.previewFrame(frame)}
        />
    );
}
