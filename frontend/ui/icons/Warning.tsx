import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const Warning = ({
    style = {},
    width = "20",
    height = "20",
    className = "",
    strokeWidth = "1.5",
    strokeColor = "#fff",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill="none"
        viewBox="0 0 20 20"
        {...rest}
    >
        <g
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            clipPath="url(#clip0_1202_6082)"
        >
            <path d="M10 18.333a8.333 8.333 0 100-16.666 8.333 8.333 0 000 16.666zM10 13.333V10M10 6.667h.008"></path>
        </g>
        <defs>
            <clipPath id="clip0_1202_6082">
                <path fill="#fff" d="M0 0H20V20H0z"></path>
            </clipPath>
        </defs>
    </svg>
);

export default Warning;
