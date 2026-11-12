import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    className?: string;
    color?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const CheckCircle = ({
    style = {},
    width = "60",
    height = "60",
    className = "",
    strokeWidth = "1.5",
    color = "#18191C",
    ...rest
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill="none"
        className={className}
        viewBox="0 0 60 60"
        {...rest}
    >
        <path
            fill={color}
            fillRule="evenodd"
            d="M30 59c16.016 0 29-12.984 29-29S46.016 1 30 1 1 13.984 1 30s12.984 29 29 29zm0 1c16.569 0 30-13.431 30-30C60 13.431 46.569 0 30 0 13.431 0 0 13.431 0 30c0 16.569 13.431 30 30 30zm-8.707-29.657a1 1 0 011.414 0l4.268 4.268 10.318-10.318a1 1 0 011.414 1.414l-11 11a.997.997 0 01-.734.293.997.997 0 01-.73-.293l-4.95-4.95a1 1 0 010-1.414z"
            clipRule="evenodd"
        ></path>
    </svg>
);

export default CheckCircle;
