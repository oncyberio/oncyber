import React, { useRef } from "react";
import { ArtworkInfoProps } from "../types";
import { ArtworkInfo_Data } from "./ArtworkInfo_Data";
import { useArtworkInfo } from "./components/ArtworkContext";
import { ArtworkDialog } from "./ArtworkDialog";

export const ArtworkInfo_3D: React.FC<ArtworkInfoProps> = ({ toggle }) => {
    const assetInfoRef = useRef<HTMLDivElement>(null);
    const { asset } = useArtworkInfo();
    const mime = asset?.mime_type || "";
    const isVideo = mime.includes("video");
    const preview = isVideo ? (
        <video
            className="wrapper-media"
            src={
                asset?.dcompressed_animation_url ||
                asset?.compressed_animation_url ||
                asset?.animation_url ||
                asset?.animation_original_url
            }
            playsInline
            muted
            autoPlay
            loop
            aria-label={asset?.name || "Artwork preview"}
        />
    ) : (
        <img
            src={
                mime.includes("model")
                    ? asset?.image_preview_url
                    : asset?.dcompressed_image_url ||
                      asset?.compressed_image_url ||
                      asset?.image_url ||
                      asset?.image_original_url
            }
            alt={asset?.name || "Artwork preview"}
        />
    );
    return (
        <ArtworkDialog preview={preview} onClose={() => toggle(false)}>
            <ArtworkInfo_Data themeDark assetInfoRef={assetInfoRef} />
        </ArtworkDialog>
    );
};
