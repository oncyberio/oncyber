import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const Check = ({
    style = {},
    width = "24",
    height = "24",
    className = "",
    strokeWidth = "2",
    strokeColor = "#18191C",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill={"none"}
        width={width}
        height={height}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        style={style}
        {...rest}
    >
        <path
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
        />
    </svg>
);

export default Check;
