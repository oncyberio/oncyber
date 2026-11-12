import { noop } from "@utils/js";
import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    onClick: Function;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const XCircle = ({
    style = {},
    width = "36",
    height = "36",
    className = "",
    strokeWidth = "1.5",
    strokeColor = "#070707",
    onClick = noop,
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill="none"
        style={style}
        viewBox="0 0 36 36"
        className={className}
        onClick={onClick}
        {...rest}
    >
        <path
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            d="M24 12L12 24M12 12l12 12"
        ></path>
        <rect
            width="35"
            height="35"
            x="0.5"
            y="0.5"
            stroke={strokeColor}
            rx="17.5"
        ></rect>
    </svg>
);

export default XCircle;
