import { Asset } from "@uitypes/Asset";
import { useRef } from "react";
import styled from "styled-components";
import { getAssetPreview } from "@features/studio/utils";

export interface AssetPreviewProps {
    asset: Asset;
    name: string;
    index: number;
    draggable?: boolean;
}

export function AssetPreview({
    asset,
    name,
    index,
    draggable = false,
}: AssetPreviewProps) {
    //

    const imgRef = useRef<HTMLImageElement>();

    let preview = getAssetPreview(asset);

    if (preview.isVideo && preview.url) {
        return (
            <Vid
                className="preview-vid"
                key={index}
                draggable={true}
                src={preview.url}
                muted
                autoPlay
                loop
            />
        );
    }

    const originalPreview =
        asset.image_original_preview_url != preview.url
            ? asset.image_original_preview_url
            : null;

    // In case the primary preview url didn't work (e.g. objk cdn)
    // swtich to original preview
    // WARNING: don't change this into an arrow function, because we need `this`
    // to point at the `img` element
    function onImgError(event) {
        if (imgRef.current) {
            imgRef.current.onerror = null;
            imgRef.current.src = originalPreview;
        }
    }

    return (
        <Img
            className="preview-img"
            ref={imgRef}
            draggable={draggable}
            src={preview.previewUrl}
            alt={name}
            data-index={index}
            onError={originalPreview ? onImgError : null}
        />
    );
}

const Img = styled.img`
    width: 100%;
    height: 100%;
    cursor: pointer;
    /* content-visibility: auto; */
    object-fit: cover;
`;

const Vid = styled.video`
    width: 100%;
    height: 100%;
    cursor: pointer;
`;
