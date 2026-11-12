import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    fill?: string;
    style?: CSSProperties;
};

const Duplicate = ({
    style = {},
    width = "20",
    height = "20",
    className = "",
    strokeWidth = "1.5",
    fill = "#fff",
    strokeColor = "#999",
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
            clipPath="url(#clip0_1616_15321)"
        >
            <path d="M4.166 7.5l-2.5 2.5 2.5 2.5M7.5 4.167l2.5-2.5 2.5 2.5M12.5 15.833l-2.5 2.5-2.5-2.5M15.834 7.5l2.5 2.5-2.5 2.5M1.666 10h16.667M10 1.667v16.666"></path>
        </g>
        <defs>
            <clipPath id="clip0_1616_15321">
                <path fill={fill} d="M0 0H20V20H0z"></path>
            </clipPath>
        </defs>
    </svg>
);

export default Duplicate;
