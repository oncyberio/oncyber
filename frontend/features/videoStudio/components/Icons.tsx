import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;
const icon = (children: React.ReactNode) =>
    function Icon(props: Props) {
        return (
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                {...props}
            >
                {children}
            </svg>
        );
    };

export const PlayIcon = icon(<path d="m8 5 11 7-11 7V5Z" />);
export const PauseIcon = icon(
    <>
        <path d="M9 5v14" />
        <path d="M15 5v14" />
    </>
);
export const UndoIcon = icon(<path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6" />);
export const RedoIcon = icon(<path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6" />);
export const CameraIcon = icon(
    <>
        <path d="M14.5 6 13 4h-2L9.5 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4.5Z" />
        <circle cx="12" cy="12.5" r="3.5" />
    </>
);
export const PathIcon = icon(
    <>
        <circle cx="5" cy="17" r="2" />
        <circle cx="19" cy="7" r="2" />
        <path d="M7 17c5 0 1-10 10-10" />
    </>
);
export const TargetIcon = icon(
    <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
    </>
);
export const PlusIcon = icon(
    <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
    </>
);
export const SparklesIcon = icon(
    <>
        <path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" />
        <path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
        <path d="m5 13 .8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8L5 13Z" />
    </>
);
export const SendIcon = icon(
    <>
        <path d="m22 2-7 20-4-9-9-4 20-7Z" />
        <path d="M22 2 11 13" />
    </>
);
export const ArrowUpIcon = icon(
    <>
        <path d="M12 19V5" />
        <path d="m6 11 6-6 6 6" />
    </>
);
export const StopIcon = icon(
    <rect
        x="7"
        y="7"
        width="10"
        height="10"
        rx="1.5"
        fill="currentColor"
        stroke="none"
    />
);
export const CopyIcon = icon(
    <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
);
export const ComposeIcon = icon(
    <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
);
export const ChevronDownIcon = icon(<path d="m6 9 6 6 6-6" />);
export const DownloadIcon = icon(
    <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
    </>
);
export const ImageIcon = icon(
    <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m21 15-5-5L5 20" />
    </>
);
export const CloseIcon = icon(
    <>
        <path d="m6 6 12 12" />
        <path d="M18 6 6 18" />
    </>
);
export const CheckIcon = icon(<path d="m5 12 4 4L19 6" />);
export const MoreIcon = icon(
    <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
);
export const LayersIcon = icon(
    <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
    </>
);
export const MapIcon = icon(
    <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
        <path d="M9 3v15M15 6v15" />
    </>
);
export const ChevronIcon = icon(<path d="m9 6 6 6-6 6" />);
export const FilmIcon = icon(
    <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4" />
    </>
);
