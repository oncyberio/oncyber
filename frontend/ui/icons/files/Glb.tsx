import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const Glb = ({
    style = {},
    width = "46",
    height = "56",
    className = "",
    strokeWidth = "2",
    strokeColor = "#E0E0E0",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        width={width}
        height={height}
        viewBox="0 0 46 56"
        {...style}
        {...rest}
    >
        <path
            fill={strokeColor}
            d="M17.165 47c1.08 0 1.823-.46 2.227-1.011l.164.944h1.146v-4.371h-3.417v1.337h1.9V44c-.153 1.101-1.037 1.573-1.91 1.573-1.311 0-2.075-1.056-2.075-2.573s.797-2.573 2.074-2.573c.94 0 1.55.573 1.747 1.438h1.638C20.462 40.168 19.163 39 17.318 39c-2.348 0-3.789 1.584-3.789 4s1.452 4 3.636 4zM26.686 46.933v-1.45H23.65v-6.416h-1.638v7.866h4.673z"
        ></path>
        <path
            fill={strokeColor}
            fillRule="evenodd"
            d="M30.603 46.933h-3.046v-7.866h2.904c1.77 0 2.795.764 2.795 2.08 0 .988-.567 1.55-1.44 1.74 1.015.136 1.713.686 1.713 1.81 0 1.37-1.048 2.236-2.926 2.236zm1.016-5.585c0-.584-.404-.955-1.114-.955h-1.31v1.91h1.31c.699 0 1.114-.37 1.114-.955zm.229 3.27c0-.64-.459-1.011-1.234-1.011h-1.42v1.989h1.42c.786 0 1.234-.371 1.234-.978z"
            clipRule="evenodd"
        ></path>
        <path
            fill={strokeColor}
            fillRule="evenodd"
            d="M24.541 0l.027.018L46 14.152V44c0 6.627-5.373 12-12 12H12C5.373 56 0 50.627 0 44V12C0 5.373 5.373 0 12 0h12.541zM12 2h11.94L44 15.229V44c0 5.523-4.477 10-10 10H12C6.477 54 2 49.523 2 44V12C2 6.477 6.477 2 12 2z"
            clipRule="evenodd"
        ></path>
    </svg>
);

export default Glb;
