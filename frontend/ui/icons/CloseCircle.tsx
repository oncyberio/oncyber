import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    fill?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const CloseCircle = ({
    style = {},
    width = "40",
    height = "40",
    strokeWidth = "1.5",
    fill = "#fff",
    strokeColor = "#C2C2C2",
    className = "",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill="none"
        style={style}
        viewBox="0 0 40 40"
        {...rest}
    >
        <rect
            width="39"
            height="39"
            x="0.5"
            y="0.5"
            stroke={strokeColor}
            rx="19.5"
        ></rect>
        <path
            stroke={fill}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M25 15L15 25M15 15l10 10"
        ></path>
    </svg>
);

export default CloseCircle;
