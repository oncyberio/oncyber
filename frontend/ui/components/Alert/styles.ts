import styled from "styled-components";

export type StyledAlertProps = {
    width?: string;
    height?: string;
    color?: string;
    padding?: string;
    fontSize?: string;
    background?: string;
    borderColor?: string;
    borderRadius?: string;
    variant?: "primary" | "success" | "danger" | "info" | "warning";
};

export const StyledAlert = styled.div<StyledAlertProps>`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    outline: none;
    color: #18191c;
    font-weight: 400;
    line-height: 24px;
    font-style: "normal";
    background: #ffefe3;
    width: ${({ width }) => width};
    padding: ${({ padding }) => padding};
    height: ${({ height }) => height};
    font-size: ${({ fontSize }) => fontSize};
    border: 1px solid transparent;
    border-radius: ${({ borderRadius }) => borderRadius};

    ${({ variant }) => {
        switch (variant) {
            case "primary":
                return `
                    color: #084298;
                    background: #cfe2ff;
                    border-color: #b6d4fe;
              `;
            case "success":
                return `
                    color: #0f5132;
                    background: #d1e7dd;
                    border-color: #badbcc;
              `;
            case "danger":
                return `
                    color: #842029;
                    background: #f8d7da;
                    border-color: #f5c2c7;
              `;
            case "info":
                return `
                    color: #055160;
                    background: #cff4fc;
                    border-color: #b6effb;
              `;
            case "warning":
                return `
                    color: #664d03;
                    background: #FFEFE3;
                    border-color: #ffecb5;
              `;
        }
    }}
`;

StyledAlert.defaultProps = {
    width: "436px",
    height: "40px",
    fontSize: "15px",
    padding: "7px 12px",
    borderRadius: "4px",
    variant: "primary",
};
