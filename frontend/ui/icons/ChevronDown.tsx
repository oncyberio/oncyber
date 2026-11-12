import { noop } from "@utils/js";
import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    onClick?: () => void;
    style?: CSSProperties;
};

const ChevronDown = ({
    style = {},
    width = "12",
    height = "8",
    className = "",
    onClick = noop,
    strokeWidth = "1.5",
    strokeColor = "#5D5F65",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        width={width}
        style={style}
        height={height}
        onClick={onClick}
        viewBox="0 0 12 8"
        className={className}
        {...rest}
    >
        <path
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            d="M1 1.5l5 5 5-5"
        ></path>
    </svg>
);

export default ChevronDown;
