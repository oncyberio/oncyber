import { SVGProps } from "react";

type Name =
    | "people"
    | "wallet"
    | "signout"
    | "search"
    | "user"
    | "arrow"
    | "down"
    | "up"
    | "filter"
    | "grid"
    | "cylinder"
    | "close"
    | "shuffle"
    | "globe"
    | "chevron"
    | "check"
    | "back"
    | "forward"
    | "play"
    | "plus"
    | "portal"
    | "gallery"
    | "scan"
    | "game"
    | "folder"
    | "book"
    | "help"
    | "signin"
    | "pin";
const paths: Record<Name, JSX.Element> = {
    people: (
        <>
            <circle cx="9" cy="8" r="3" />
            <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2" />
        </>
    ),
    wallet: (
        <>
            <path d="M20 8V5H6a3 3 0 0 0 0 6h14v9H6a3 3 0 0 1-3-3V8M20 11h-5v5h5" />
            <circle cx="16.5" cy="13.5" r=".5" />
        </>
    ),
    signout: (
        <>
            <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M10 12h11m-4-4 4 4-4 4" />
        </>
    ),
    user: (
        <>
            <circle cx="12" cy="7" r="3.5" />
            <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </>
    ),
    search: (
        <>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
        </>
    ),
    arrow: (
        <>
            <path d="M5 19 19 5M5 5h14v14" />
        </>
    ),
    down: <path d="M12 4v16m-6-6 6 6 6-6" />,
    up: <path d="M12 20V4m-6 6 6-6 6 6" />,
    filter: (
        <>
            <path d="M4 7h7m4 0h5M4 17h3m4 0h9" />
            <circle cx="13" cy="7" r="2" />
            <circle cx="9" cy="17" r="2" />
        </>
    ),
    grid: (
        <>
            <rect x="4" y="4" width="6" height="6" rx="1" />
            <rect x="14" y="4" width="6" height="6" rx="1" />
            <rect x="4" y="14" width="6" height="6" rx="1" />
            <rect x="14" y="14" width="6" height="6" rx="1" />
        </>
    ),
    cylinder: (
        <>
            <ellipse cx="12" cy="5" rx="8" ry="3" />
            <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0M12 8v14" />
        </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    shuffle: (
        <>
            <path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4" />
        </>
    ),
    globe: (
        <>
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <path d="M3 12h18" />
        </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    portal: (
        <>
            <ellipse cx="12" cy="12" rx="6" ry="9" />
            <path d="M12 3c-2 3-2 15 0 18" />
        </>
    ),
    gallery: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 16 5-5 4 4 3-3 6 6" />
        </>
    ),
    scan: (
        <>
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    game: (
        <>
            <rect x="3" y="7" width="18" height="11" rx="4" />
            <path d="M8 10.5v4M6 12.5h4" />
            <circle cx="15.5" cy="12" r=".6" />
            <circle cx="17.5" cy="14" r=".6" />
        </>
    ),
    folder: (
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    ),
    book: (
        <>
            <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z" />
            <path d="M5 17a3 3 0 0 1 3-3h11" />
        </>
    ),
    help: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
            <circle cx="12" cy="17" r=".6" />
        </>
    ),
    signin: (
        <>
            <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
            <path d="M3 12h11m-4-4 4 4-4 4" />
        </>
    ),
    pin: (
        <>
            <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" />
            <circle cx="12" cy="10" r="2" />
        </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    forward: <path d="M4 12h16m-6-6 6 6-6 6" />,
    play: <path d="m7 4 13 8-13 8Z" />,
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
};
export default function Icon({
    name,
    size = 18,
    ...props
}: SVGProps<SVGSVGElement> & { name: Name; size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            {paths[name]}
        </svg>
    );
}
