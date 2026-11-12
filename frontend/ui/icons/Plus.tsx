import { noop } from "@utils/js";
import React, { CSSProperties } from "react";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    color?: string;
    className?: string;
    style?: CSSProperties;
    onClick?: Function;
};

const Plus = ({
    style = {},
    width = "20",
    height = "20",
    className = "",
    color = "#777980",
    onClick = noop,
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
        onClick={onClick}
        {...rest}
    >
        <path
            fill={color}
            d="M9.732 9.12H.996v.912h8.736v9.12h.96v-9.12h8.784V9.12h-8.784V0h-.96v9.12z"
        ></path>
    </svg>
);

export default Plus;
