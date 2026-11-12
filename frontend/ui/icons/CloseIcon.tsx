import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    color?: string;
    className?: string;
    style?: CSSProperties;
};

const CloseIcon = ({
    style = {},
    width = "18",
    height = "18",
    color = "#fff",
    className = "",
    ...rest
}: IconProps) => (
    <svg
        fill="none"
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 18 18"
        className={className}
        style={style}
        {...rest}
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M17.198.804a.698.698 0 0 1 0 .992l-15.4 15.4a.701.701 0 0 1-.991-.992l15.4-15.4a.7.7 0 0 1 .991 0Z"
            fill={color}
        />
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M.807.804a.7.7 0 0 0 0 .992l15.4 15.4a.701.701 0 0 0 .991-.992L1.798.804a.7.7 0 0 0-.99 0Z"
            fill={color}
        />
    </svg>
);

export default CloseIcon;
