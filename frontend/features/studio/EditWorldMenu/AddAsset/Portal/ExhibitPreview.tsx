import { DRAG_MIMES } from "@components/_3DExhibit-v2/three/constants";
import { Experience } from "@uitypes/experience";
import { useRef } from "react";
import styled from "styled-components";
import { useEditWorld } from "../../context/WorldEditContext";

const defaultPreviewUrl = "/images/sq_image_placeholder.png";

export function ExhibitPreview({
    exhibit,
    name,
    index,
    draggable,
    style = {},
    isSubmitting = false,
    isLocked = false,
}: {
    exhibit: Experience;
    name: string;
    index: number;
    draggable?: boolean;
    style?: React.CSSProperties;
    isSubmitting?: boolean;
    isLocked?: boolean;
}) {
    //
    const { handleDragStart } = useEditWorld();

    const imgRef = useRef<HTMLImageElement>();
    let previewUrl = (
        exhibit.info?.heroImg ||
        exhibit.info?.cHeroImg ||
        defaultPreviewUrl
    )
        .replace("h_600", "h_300")
        .replace("w_600", "w_300");

    // in case was compressed the old way (firebase)
    previewUrl = previewUrl.split("hero")[1]
        ? previewUrl.split("hero")[0] +
          "hero_800x600" +
          previewUrl.split("hero")[1]
        : previewUrl;

    const originalPreview = exhibit.info?.cHeroImg
        ? exhibit.info?.heroImg
            ? defaultPreviewUrl
            : null
        : null;

    function onImgError(event) {
        if (imgRef.current) {
            imgRef.current.onerror = null;

            if (originalPreview != previewUrl) {
                imgRef.current.src = originalPreview;
            }
        }
    }

    return (
        <Img
            style={style}
            isLocked={isSubmitting || isLocked}
            className="preview-img"
            ref={imgRef}
            draggable={draggable}
            src={previewUrl}
            alt={name}
            width={136}
            height={72}
            loading="lazy"
            data-index={index}
            onError={originalPreview ? onImgError : null}
            onDragStart={(e) => {
                if (isSubmitting || isLocked) {
                    e.preventDefault();
                    return;
                }
                handleDragStart(e as any, DRAG_MIMES.PORTAL, {
                    previewUrl,
                    asset: exhibit,
                    mime: DRAG_MIMES.PORTAL,
                });
            }}
        />
    );
}

const Img = styled.img<{ isLocked?: boolean }>`
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    cursor: ${(props) => (props.isLocked ? "not-allowed" : "pointer")};
    content-visibility: auto;
    object-fit: cover;
`;
