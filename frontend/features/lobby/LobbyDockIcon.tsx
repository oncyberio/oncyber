import React from "react";
import ExperienceControlIcon from "@ui/components/ExperienceControlIcon";

type DockIconName =
    | "mic"
    | "mic-off"
    | "avatar"
    | "emotes"
    | "flash"
    | "people"
    | "explore";

/** Keep the lobby's existing class hooks while sharing artwork with every visitor dock. */
export default function LobbyDockIcon({ name }: { name: DockIconName }) {
    if (name === "flash")
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <g transform="rotate(-8 12 12)" fill="currentColor">
                    <path
                        fillRule="evenodd"
                        d="M6.4 4C3.4 4 1.8 7.4 1.8 12s1.6 8 4.6 8S11 16.6 11 12 9.4 4 6.4 4Zm-1.6 6c-1.1 0-1.8 1.6-1.8 3.5S3.7 17 4.8 17s1.8-1.6 1.8-3.5S5.9 10 4.8 10Z"
                    />
                    <path
                        fillRule="evenodd"
                        d="M17.6 4c-3 0-4.6 3.4-4.6 8s1.6 8 4.6 8 4.6-3.4 4.6-8-1.6-8-4.6-8ZM16 10c-1.1 0-1.8 1.6-1.8 3.5S14.9 17 16 17s1.8-1.6 1.8-3.5S17.1 10 16 10Z"
                    />
                </g>
            </svg>
        );
    return <ExperienceControlIcon name={name} className="lobby-dock-icon" />;
}
