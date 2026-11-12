import { DRAG_MIMES } from "@components/_3DExhibit-v2/three/constants";
import { Asset } from "@uitypes/Asset";
import { DragEventHandler, useRef } from "react";
import styled from "styled-components";
import { useAssetsMenuContext } from "../context/useAssetsMenuContext";

export function AssetPreview({
    asset,
    name,
    index,
    draggable = false,
}: {
    asset: Asset;
    name: string;
    index: number;
    draggable?: boolean;
}) {
    const imgRef = useRef<HTMLImageElement>();
    let previewUrl = asset?.image_preview_url || asset?.image_url;

    if (previewUrl && previewUrl.startsWith("ipfs://"))
        previewUrl =
            "https://cyber.mypinata.cloud/ipfs/" +
            previewUrl.split("ipfs://")[1];

    if (previewUrl == null && asset.mime_type?.includes("video")) {
        return (
            <Vid
                className="preview-vid"
                key={index}
                draggable={true}
                src={asset.animation_url}
                muted
            />
        );
    }

    const originalPreview =
        asset.image_original_preview_url != previewUrl
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

    if(asset.mime_type == "cyber/text") previewUrl = "images/text-preview.svg"; 

    return (
        <Img
            className="preview-img"
            ref={imgRef}
            draggable={draggable}
            src={previewUrl}
            alt={name}
            loading="lazy"
            data-index={index}
            onError={originalPreview ? onImgError : null}
        />
    );
}

const Img = styled.img`
    width: 100%;
    cursor: pointer;
    content-visibility: auto;
    object-fit
`;

const Vid = styled.video`
    width: 100%;
    cursor: pointer;
`;
