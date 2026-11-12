import React, { CSSProperties } from "react";
import styled from "styled-components";

type IconProps = React.HTMLAttributes<SVGElement> & {
    width?: string;
    height?: string;
    fill?: string;
    className?: string;
    strokeColor?: string;
    strokeWidth?: string;
    style?: CSSProperties;
};

const ArrowTabRight = ({
    width = "13",
    height = "13",
    fill = "#070707",
    className = "",
    strokeColor = "#17181A",
    strokeWidth = ".8",
    style = {},
    ...rest
}: IconProps) => {
    return (
        <SVG
            className={className}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            height={height}
            viewBox="0 0 13 13"
            style={style}
            {...rest}
        >
            <path
                d="m9.948 2.204-8.834 8.834.847.848 8.835-8.834.114 6.825 1.309-.02-.194-8.85L3.143.78l-.02 1.308 6.825.115Z"
                fill={fill}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
            />
        </SVG>
    );
};

const SVG = styled.svg``;

export default ArrowTabRight;
