import styled from "styled-components";

export type StyledCheckboxProps = {
    width?: string;
    height?: string;
    color?: string;
    padding?: string;
    fontSize?: string;
    background?: string;
    borderColor?: string;
    borderRadius?: string;
};

export const StyledCheckbox = styled.input<StyledCheckboxProps>`
    outline: none;
    border-width: 1px;
    position: relative;
    border-color: #999999;
    border-style: solid;
    -webkit-appearance: none;
    width: ${({ width }) => width};
    height: ${({ height }) => height};
    border-radius: ${({ borderRadius }) => borderRadius};

    &:checked {
        background-color: #070707;
        border-color: #070707;
    }

    &:after {
        left: 0;
        top: 0;
        content: "";
        width: 100%;
        height: 100%;
        position: absolute;
        background-repeat: no-repeat;
        background-position: center;
        background-size: ${({ fontSize }) => fontSize};
        background-image: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOSIgaGVpZ2h0PSI3IiB2aWV3Qm94PSIwIDAgOSA3IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMS40MDAwMiA0LjQwMDFMMy4wNDY0NyA2LjA0NjU0QzMuMjQxNzMgNi4yNDE4MSAzLjU1ODMyIDYuMjQxODEgMy43NTM1OCA2LjA0NjU0TDguMjAwMDIgMS42MDAxIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjwvc3ZnPgo=");
    }
`;

StyledCheckbox.defaultProps = {
    width: "19px",
    height: "20px",
    fontSize: "13px",
    borderRadius: "4px",
    borderColor: "#070707",
};
