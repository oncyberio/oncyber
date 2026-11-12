import { cloudinaryLoader, othersLoader } from "@utils/images/loader";

import Image, { ImageProps } from "next/image";

import ImageLegacy, { ImageProps as LegacyImageProps } from "next/legacy/image";
// Three-free: `three/constants` would pull the 3D engine into every page.
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "./_3DExhibit-v2/three/shellconstants";

const cloudinary_prefix = "https://res.cloudinary.com";

export function CloudinaryNextImage(props: ImageProps) {
    const fallbackSrc = (event) => {
        const img = event.target as HTMLImageElement;

        // Guard against an infinite error loop if the fallback itself fails.
        if (img.dataset.avatarFallback) return;

        img.dataset.avatarFallback = "1";

        // `event.onerror = null` was a no-op (it set the property on the
        // event, not the element), so a failing fallback could loop.
        img.onerror = null;

        // The actual reason broken avatars stayed broken: callers such as
        // ui/components/Avatar render the image `visibility: hidden` and only
        // reveal it from next/image's onLoadingComplete, which never fires for
        // a src swapped in by hand. The old handler did load the fallback, but
        // it stayed invisible. Reveal it once it has decoded.
        img.onload = () => {
            img.style.visibility = "visible";
        };

        // Assign `src` (and clear `srcset`) to match the two hand-rolled
        // handlers that already worked — Editors/Modal.tsx and
        // SubscribedUsers.tsx.
        img.srcset = "";
        img.src = DEFAULT_PLAYER_AVATAR_PICTURE;
    };

    if (!props.src)
        return (
            <div
                style={{
                    ...props.style,
                    width: props.width || "100%",
                    height: props.height || "100%",
                    background: "#ececec",
                }}
            />
        );

    const isCloudinary = (props.src as string).startsWith(cloudinary_prefix);

    return (
        <Image
            loader={isCloudinary ? cloudinaryLoader : othersLoader}
            {...props}
            {...(isCloudinary ? {} : { unoptimized: true })}
            onError={props?.onError ? props.onError : fallbackSrc}
        />
    );
}

export function LegacyCloudinaryNextImage(props: LegacyImageProps) {
    if (!props.src)
        return (
            <div
                style={{
                    ...props.style,
                    width: props.width || "100%",
                    height: props.height || "100%",
                    background: "#ececec",
                }}
            />
        );
    const isCloudinary = (props.src as string).startsWith(cloudinary_prefix);

    return (
        <ImageLegacy
            loader={isCloudinary ? cloudinaryLoader : othersLoader}
            {...props}
            {...(isCloudinary ? {} : { unoptimized: true })}
        />
    );
}
