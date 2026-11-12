import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const Pending = ({
    style = {},
    width = "60",
    height = "60",
    className = "",
    strokeColor = "#5C5C5C",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill="none"
        viewBox="0 0 60 60"
        className={className}
        style={style}
        {...rest}
    >
        <path
            fill="#18191C"
            fillRule="evenodd"
            d="M30 59c16.016 0 29-12.984 29-29S46.016 1 30 1 1 13.984 1 30s12.984 29 29 29zm0 1c16.569 0 30-13.431 30-30C60 13.431 46.569 0 30 0 13.431 0 0 13.431 0 30c0 16.569 13.431 30 30 30z"
            clipRule="evenodd"
        ></path>
        <path
            fill="#C2C2C2"
            fillRule="evenodd"
            d="M30 59c16.016 0 29-12.984 29-29S46.016 1 30 1 1 13.984 1 30s12.984 29 29 29zm0 1c16.569 0 30-13.431 30-30C60 13.431 46.569 0 30 0 13.431 0 0 13.431 0 30c0 16.569 13.431 30 30 30z"
            clipRule="evenodd"
        ></path>
        <path
            fill="#070707"
            fillRule="evenodd"
            d="M31 1.017C44.862 1.487 56.257 11.685 58.57 25h1.015C57.258 11.13 45.415.488 31 .016v1z"
            clipRule="evenodd"
        ></path>
    </svg>
);

export default Pending;
