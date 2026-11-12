import React from "react";
import useFallbackImageInSSR from "./hooks/useFallbackImageInSSR";

export default function Img(props) {
    const fallbackImageProps = useFallbackImageInSSR(props?.fallbackImg || "");

    return <img {...props} {...fallbackImageProps} />;
}
