import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
    onClick?: any;
};

const Trash = ({
    style = {},
    width = "16",
    height = "16",
    strokeWidth = "1.5",
    strokeColor = "#fff",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill="none"
        viewBox="0 0 16 16"
        style={style}
        {...rest}
    >
        <path
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            d="M5.334 4V2.667a1.333 1.333 0 011.333-1.334h2.667a1.333 1.333 0 011.333 1.334V4m2 0v9.333a1.334 1.334 0 01-1.333 1.334H4.667a1.334 1.334 0 01-1.333-1.334V4h9.333zM6.666 7.333v4M9.334 7.333v4"
        ></path>
    </svg>
);

export default Trash;
