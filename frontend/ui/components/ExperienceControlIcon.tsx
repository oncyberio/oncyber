import React from "react";
import styled from "styled-components";

export const experienceControlIcons = [
    "mic",
    "mic-off",
    "avatar",
    "emotes",
    "people",
    "explore",
    "more",
    "permissions",
    "reload",
    "info",
] as const;
export type ExperienceControlIconName = (typeof experienceControlIcons)[number];

const assets: Record<ExperienceControlIconName, string> = {
    mic: "/lobby/icons/generated-v3/mic.png",
    "mic-off": "/lobby/icons/generated-v3/mic-off.png",
    avatar: "/lobby/icons/generated-v4/avatar.png",
    emotes: "/lobby/icons/generated-v3/emotes.png",
    people: "/lobby/icons/generated-v4/people.png",
    explore: "/lobby/icons/generated-v3/explore.png",
    more: "/icons/generated-v2/more.png",
    permissions: "/icons/generated-v2/permissions.png",
    reload: "/icons/generated-v2/reload.png",
    info: "/icons/generated-v2/info.png",
};
// Generated canvases have different padding; keep the visible artwork near 20px
// inside the shared 22px icon box in both the lobby and native experience.
const opticalSizes: Record<string, string> = {
    [assets.mic]: "118%",
    [assets["mic-off"]]: "119%",
    [assets.avatar]: "109%",
    [assets.emotes]: "115%",
    [assets.people]: "124%",
    [assets.explore]: "132%",
};
const aliases: Record<string, ExperienceControlIconName> = {
    user: "avatar",
    smile: "emotes",
    users: "people",
    grid: "explore",
    dashboard: "more",
    lock: "permissions",
    "refresh-cw": "reload",
};

/** Accept established runtime action names while keeping artwork local and bounded. */
export function experienceControlIconAsset(name: string): string | undefined {
    const canonical = Object.prototype.hasOwnProperty.call(aliases, name)
        ? aliases[name]
        : name;
    return Object.prototype.hasOwnProperty.call(assets, canonical)
        ? assets[canonical]
        : undefined;
}

/** Shared image-generated dock artwork; the enclosing button owns its accessible name and state. */
export default function ExperienceControlIcon({
    name,
    size = 22,
    className,
}: {
    name: string;
    size?: number;
    className?: string;
}) {
    const asset = experienceControlIconAsset(name);
    if (!asset) return null;
    const image = `url("${asset}")`;
    const maskSize = opticalSizes[asset] ?? "contain";
    return (
        <Mask
            className={["experience-control-icon", className]
                .filter(Boolean)
                .join(" ")}
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                WebkitMaskImage: image,
                maskImage: image,
                WebkitMaskSize: maskSize,
                maskSize,
            }}
        />
    );
}

const Mask = styled.span`
    display: block;
    flex-shrink: 0;
    background: currentColor;
    mask-size: contain;
    mask-position: center;
    mask-repeat: no-repeat;
    mask-mode: alpha;
    -webkit-mask-size: contain;
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;
    opacity: 0.9;
    transition: opacity 180ms ease;
    button:hover:not(:disabled) &,
    button:focus-visible &,
    button[aria-pressed="true"] &,
    button[aria-expanded="true"] & {
        opacity: 1;
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;
