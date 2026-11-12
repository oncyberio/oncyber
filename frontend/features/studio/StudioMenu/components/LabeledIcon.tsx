import IconImg from "@ui/components/IconImg";
import { ToolbarButton, ToolbarButtonLabel } from "./ToolbarButton";

export function LabelledIcon({ name, label = null, toggled, onClick = null }) {
    //
    return (
        <ToolbarButton
            hasLabel={!!label}
            toggled={toggled}
            onClick={onClick}
            aria-label={
                label ||
                {
                    settings: "World settings",
                    "bar-chart-2": "World statistics",
                    video: "Cinematic tools",
                }[name] ||
                name
            }
        >
            {name === "video" ? (
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="m8 6 1.5-2h5L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                    <circle cx="12" cy="13" r="3.25" />
                </svg>
            ) : (
                name && <IconImg name={name} size={20} mode="light" />
            )}
            {label && <ToolbarButtonLabel>{label}</ToolbarButtonLabel>}
        </ToolbarButton>
    );
}
