import MobileZoomer from "@components/MobileZoomer";
import { useState } from "react";
import { useArtworkInfo } from "./ArtworkContext";

export function AssetPreview() {
    const { asset } = useArtworkInfo();

    const [zoomIn, setZoomIn] = useState(false);

    const mime = asset?.mime_type || "";

    return (
        <MobileZoomer
            setZoomIn={setZoomIn}
            zoomIn={zoomIn}
            isVideo={asset && mime && mime.includes("video")}
            mime={mime}
            videoSrc={
                asset?.dcompressed_animation_url ||
                asset?.compressed_animation_url ||
                asset?.animation_url ||
                asset?.animation_original_url
            }
            imgSrc={
                mime && mime.includes("model")
                    ? asset?.image_preview_url
                    : asset?.dcompressed_image_url ||
                      asset?.compressed_image_url ||
                      asset?.image_url ||
                      asset?.image_original_url
            }
            title={asset?.name}
            stats={null}
            setStats={null}
        />
    );
}
