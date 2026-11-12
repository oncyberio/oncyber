import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const RecArrowDown = ({
    style = {},
    width = "24",
    height = "20",
    className = "",
    strokeWidth = "1.5",
    strokeColor = "#18191C",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill="none"
        style={style}
        viewBox="0 0 24 20"
        className={className}
        {...rest}
    >
        <path
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            d="M13.711 18.14L22.181 4a2 2 0 00-1.71-3H3.531a2 2 0 00-1.71 3l8.47 14.14a2.001 2.001 0 003.42 0v0z"
        ></path>
    </svg>
);

export default RecArrowDown;
