import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    fill?: string;
    strokeColor?: string;
    strokeColor2?: string;
    className?: string;
    style?: CSSProperties;
    onClick?: Function;
};

const Info = ({
    width = "32",
    height = "32",
    fill = "none",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill={fill}
        viewBox="0 0 32 32"
        {...rest}
    >
        <rect
            width="32"
            height="32"
            fill="#000"
            rx="16"
            style={{ mixBlendMode: "color-dodge" }}
        ></rect>
        <rect width="32" height="32" fill="none" rx="16"></rect>
        <path
            fill="#292929"
            d="M13 14c0-.553.415-1 .928-1h1.855c.513 0 .927.447.927 1v7h.928c.513 0 .927.447.927 1 0 .553-.414 1-.927 1h-3.71c-.514 0-.928-.447-.928-1 0-.553.415-1 .928-1h.927v-6h-.928c-.512 0-.927-.447-.927-1zM14.44 9.44a1.5 1.5 0 102.12 2.12 1.5 1.5 0 00-2.12-2.12z"
        ></path>
    </svg>
);

export default Info;
