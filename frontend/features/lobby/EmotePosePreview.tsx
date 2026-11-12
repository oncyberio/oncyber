import React, { memo, useEffect, useState } from "react";
import { SUMMER_EMOTE_PREVIEWS } from "./summerEmoteData";

type Preview =
    (typeof SUMMER_EMOTE_PREVIEWS)[keyof typeof SUMMER_EMOTE_PREVIEWS];

function PoseImage({
    name,
    pose,
    animate,
    className,
}: {
    name: string;
    pose: Preview;
    animate: boolean;
    className?: string;
}) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    return (
        <span
            className={className}
            aria-hidden="true"
            style={{
                position: "relative",
                display: "block",
                width: "100%",
                height: "100%",
                pointerEvents: "none",
            }}
        >
            <img
                src={pose.still}
                width={pose.width}
                height={pose.height}
                alt=""
                draggable={false}
                decoding="async"
                data-emote-preview={name}
                style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    visibility:
                        animate && loaded && !failed ? "hidden" : "visible",
                }}
            />
            {animate && !failed && (
                <img
                    src={pose.motion}
                    width={pose.width}
                    height={pose.height}
                    alt=""
                    draggable={false}
                    decoding="async"
                    data-emote-motion={name}
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        visibility: loaded ? "visible" : "hidden",
                    }}
                />
            )}
        </span>
    );
}

// Summer is posed and rendered offline. The picker downloads only still icons
// until a move is hovered/focused, then lets the browser decode its small WebP.
// No avatar model, animation mixer, WebGL context or per-frame React work.
export default memo(function EmotePosePreview({
    name,
    active = false,
    className,
}: {
    name: string;
    active?: boolean;
    className?: string;
}) {
    const pose = SUMMER_EMOTE_PREVIEWS[name];
    const [motionAllowed, setMotionAllowed] = useState(false);

    useEffect(() => {
        if (!active || !pose) {
            setMotionAllowed(false);
            return;
        }
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () =>
            setMotionAllowed(!media.matches && !document.hidden);
        media.addEventListener("change", update);
        document.addEventListener("visibilitychange", update);
        update();
        return () => {
            media.removeEventListener("change", update);
            document.removeEventListener("visibilitychange", update);
        };
    }, [active, pose]);

    if (!pose) return null;
    const animate = active && motionAllowed;
    return (
        <PoseImage
            key={`${name}:${animate}`}
            name={name}
            pose={pose}
            animate={animate}
            className={className}
        />
    );
});
