import React from "react";

const filledGlyphs = {
    upload: [
        "M1.22222 10.6944C1.89724 10.6944 2.44444 11.2417 2.44444 11.9167V17.1111C2.44444 18.4611 3.53886 19.5556 4.88889 19.5556H17.1111C18.4611 19.5556 19.5556 18.4611 19.5556 17.1111V11.9167C19.5556 11.2417 20.1028 10.6944 20.7778 10.6944C21.4528 10.6944 22 11.2417 22 11.9167V17.1111C22 19.8112 19.8112 22 17.1111 22H4.88889C2.18883 22 0 19.8112 0 17.1111V11.9167C0 11.2417 0.547207 10.6944 1.22222 10.6944Z",
        "M11 0C11.3241 -4.37098e-07 11.635 0.128769 11.8642 0.35798L17.3642 5.85798C17.8415 6.33529 17.8415 7.10915 17.3642 7.58646C16.8869 8.06377 16.1131 8.06377 15.6358 7.58646L12.2222 4.17292V14.9722C12.2222 15.6472 11.675 16.1944 11 16.1944C10.325 16.1944 9.77776 15.6472 9.77776 14.9722V4.17293L6.36424 7.58646C5.88694 8.06377 5.11307 8.06377 4.63576 7.58646C4.15845 7.10916 4.15845 6.33529 4.63576 5.85798L10.1357 0.357982C10.365 0.12877 10.6758 4.37103e-07 11 0Z",
    ],
    component: [
        "M7.45486 0C5.19789 0 3.36826 1.8435 3.36826 4.11757C3.36826 6.39165 5.19789 8.23515 7.45486 8.23515C9.71183 8.23515 11.5415 6.39165 11.5415 4.11757C11.5415 1.8435 9.71183 0 7.45486 0Z",
        "M12.7286 7.67788C13.5794 6.48731 15.3578 6.5498 16.1242 7.79718L21.6908 16.8576C22.5335 18.2291 21.5544 20 19.9535 20H2.04674C0.414762 20 -0.55865 18.1674 0.346608 16.7992L3.72173 11.6981C4.36203 10.7304 5.67022 10.4888 6.60951 11.1648L8.76832 12.7185C8.89915 12.8127 9.08092 12.7825 9.17487 12.6511L12.7286 7.67788Z",
    ],
};

const glyphs = {
    text: <path d="M5.7 6.6V4.8h12.6v1.8M12 4.8v14.4M8.85 19.2h6.3" />,
    youtube: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="m10 9 5 3-5 3Z" />
        </>
    ),
    iframe: (
        <>
            <circle cx="12" cy="12" r="8.5" />
            <ellipse cx="12" cy="12" rx="3.75" ry="8.5" />
            <path d="M3.5 12h17" />
        </>
    ),
    portal: (
        <>
            <path d="M5 21V9a7 7 0 0 1 14 0v12M3 21h6m8 0h4" />
            <path d="M9 13h6m-3-3 3 3-3 3" />
        </>
    ),
    kitbash: (
        <>
            <path d="m12 3 9 5v8l-9 5-9-5V8Zm0 10 9-5M3 8l9 5v8" />
            <path d="m7.5 5.5 9 5" />
        </>
    ),
    triggerZone: (
        <>
            <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="m10 10 10 4-4 2-2 4Z" />
        </>
    ),
    globalStream: <path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4" />,
    elevator: <path d="M4 3h16v18H4Zm5 6 3-3 3 3m-6 6 3 3 3-3" />,
    placedAssets: (
        <>
            <path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />
        </>
    ),
    more: (
        <g fill="currentColor" stroke="none">
            <circle cx="5" cy="12" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="19" cy="12" r="1.75" />
        </g>
    ),
    less: <path d="m6 14 6-6 6 6" />,
};

export function AssetIcon({
    name,
    size,
}: {
    name: keyof typeof glyphs | keyof typeof filledGlyphs | "avatar" | "nft";
    size?: number;
}) {
    if (name === "avatar") {
        return (
            <img
                src="https://cyber.mypinata.cloud/ipfs/QmckGHe9wkas8fid4weNqL8kpSviW3Q8emeQtwJoVbWFzj?filename=avatar-icon.png"
                aria-hidden="true"
                draggable={false}
                decoding="async"
                alt=""
                width={size ?? 54}
                height={size ?? 54}
                style={{
                    width: size ?? "100%",
                    height: size ?? "100%",
                    objectFit: "cover",
                    borderRadius: "inherit",
                    pointerEvents: "none",
                }}
            />
        );
    }
    if (name === "upload" || name === "component") {
        return (
            <svg
                width={size ?? 22}
                height={(size ?? 22) * (name === "component" ? 20 / 22 : 1)}
                viewBox={`0 0 22 ${name === "component" ? 20 : 22}`}
                fill="currentColor"
                aria-hidden="true"
                focusable="false"
            >
                {filledGlyphs[name].map((d, i) => (
                    <path key={i} d={d} fillRule="evenodd" clipRule="evenodd" />
                ))}
            </svg>
        );
    }
    if (name === "nft") {
        return (
            <span
                aria-hidden="true"
                style={{
                    display: "block",
                    width: size ?? 24,
                    height: size ? size * (25 / 24) : 25,
                    backgroundColor: "currentColor",
                    mask: 'url("/icons/add-nft.svg") center / contain no-repeat',
                    WebkitMask:
                        'url("/icons/add-nft.svg") center / contain no-repeat',
                }}
            />
        );
    }

    return (
        <svg
            width={size ?? 22}
            height={size ?? 22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {glyphs[name]}
        </svg>
    );
}
