import React, { FunctionComponent } from "react";
import styled from "styled-components";

let noop = () => {};

interface IconProps {
    name?: string;
    width?: string;
    handleClick?: Function;
    style?: Object;
    fill?: string;
    hasLiked?: Boolean;
    className?: string;
}

const Icon: FunctionComponent<IconProps> = ({
    name,
    width = "22px",
    handleClick = noop,
    style = null,
    fill = "#000",
    hasLiked,
    className
}) => (
    <img
        // @ts-ignore
        onClick={handleClick}
        className={className || name}
        fill={fill}
        stroke={fill}
        width={width}
        style={{
            ...{
                width: width,
                padding: "0 auto",
                border: hasLiked ? "2px solid red" : "none",
            },
            ...style,
        }}
        src={`/images/icons/${name}.svg`}
    />
    // <span />
);

Icon.defaultProps = {
    handleClick: noop,
};

export const IconWrapper = styled.div`
    cursor: pointer;
`;

export default Icon;
