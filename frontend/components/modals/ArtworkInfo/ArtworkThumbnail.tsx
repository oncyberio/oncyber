import React, { useState } from "react";

const DEFAULT_IMAGE = "/images/opensea-black.png";

type Props = {
    sources: string[];
    alt: string;
    className?: string;
};

/** Try each source once; changing artwork/metadata starts a fresh image chain. */
export function ArtworkThumbnail({ sources, ...props }: Props) {
    const candidates = [
        ...new Set([...sources, DEFAULT_IMAGE].filter(Boolean)),
    ];
    return (
        <ThumbnailSources
            key={JSON.stringify(candidates)}
            sources={candidates}
            {...props}
        />
    );
}

function ThumbnailSources({ sources, alt, className }: Props) {
    const [failed, setFailed] = useState<string[]>([]);
    const src = sources.find((source) => !failed.includes(source));

    // Even a missing local placeholder must not leave a broken-image icon.
    if (!src) {
        return (
            <span
                className={className}
                role="img"
                aria-label={alt}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#262626",
                    color: "#fff",
                    flexShrink: 0,
                }}
            >
                {Array.from(alt?.trim() || "?")[0].toUpperCase()}
            </span>
        );
    }

    return (
        <img
            key={src}
            className={className}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() =>
                setFailed((previous) =>
                    previous.includes(src) ? previous : [...previous, src]
                )
            }
        />
    );
}
