import styled, { css, CSSProperties } from "styled-components";

export interface DividerProps {
    direction: "horizontal" | "vertical";

    color: string;

    width: number;

    style?: CSSProperties;
}

export function Divider(props: DividerProps) {
    return <Container {...props} />;
}

Divider.defaultProps = {
    color: "#ececec",
    direction: "horizontal",
    width: 1,
};

const Container = styled.div<DividerProps>`
    background: ${(props) => props.color};

    ${({ direction, width }) => {
        if (direction === "horizontal") {
            return css`
                height: ${width}px;

                width: 100%;
            `;
        }

        if (direction === "vertical") {
            return css`
                width: ${width}px;

                height: 100%;
            `;
        }
    }}
`;
