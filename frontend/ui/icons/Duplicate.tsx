import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const Duplicate = ({
    style = {},
    width = "20",
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
        viewBox="0 0 20 20"
        className={className}
        {...rest}
    >
        <path
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            d="M16.667 7.5h-7.5c-.92 0-1.667.746-1.667 1.667v7.5c0 .92.746 1.666 1.667 1.666h7.5c.92 0 1.666-.746 1.666-1.666v-7.5c0-.92-.746-1.667-1.666-1.667z"
        ></path>
        <path
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            d="M4.166 12.5h-.833a1.667 1.667 0 01-1.667-1.667v-7.5a1.667 1.667 0 011.667-1.666h7.5a1.667 1.667 0 011.666 1.666v.834"
        ></path>
    </svg>
);

export default Duplicate;
