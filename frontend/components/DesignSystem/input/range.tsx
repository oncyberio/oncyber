import { progressWidth } from "@utils/js";
import styled from "styled-components";

type RangeProps = Partial<{
    margin: string;
    background: string;
    progressColor: string;
    height: number;
}>;

export const Range = styled.input<RangeProps>`
    -webkit-appearance: none;
    -moz-appearance: none;
    outline: 0;
    padding: 0px;
    width: ${({ width }) => (width ? width : "100%")};
    margin: ${({ margin }) => (margin ? margin : "0px")};
    height: ${({ height }) => (height ? height : 20)}px;
    border-radius: 5px;
    cursor: pointer;
    background: ${({ background, value, progressColor, min, max }) =>
        `linear-gradient(to right, ${progressColor || "#ff9800"} 0%, ${
            progressColor || "#ff9800"
        } ${progressWidth(value, min, max)}%, ${
            background || "#fff"
        } ${progressWidth(value, min, max)}%, ${background || "#fff"} 100%);`};

    ::-webkit-slider-thumb {
        opacity: 0;
    }

    ::-moz-range-thumb {
        opacity: 0;
    }
`;
