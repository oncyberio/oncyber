import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    color?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const RecArrowUp = ({
    style = {},
    width = "24",
    height = "20",
    strokeWidth = "1.5",
    strokeColor = "#18191C",
    className = "",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        style={style}
        fill="none"
        viewBox="0 0 24 20"
        className={className}
        {...rest}
    >
        <path
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            d="M10.289 1.86L1.819 16a2 2 0 001.71 3h16.94a2 2 0 001.71-3l-8.47-14.14a2 2 0 00-3.42 0v0z"
        ></path>
    </svg>
);

export default RecArrowUp;
