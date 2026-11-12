import { forwardRef } from "react";
import styled from "styled-components";

interface GradientButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    size?: "large" | "medium" | "small";
    outline?: boolean;
    variant?: string;
    ref?: any;
    gradient?: boolean;
    spanStyle?: any;
}

export const GradientButton = forwardRef((props: GradientButtonProps, ref) => {
    return (
        <Container {...props} ref={ref}>
            <span style={props?.spanStyle || {}}>{props.children}</span>
        </Container>
    );
});

const Container = styled.button<GradientButtonProps>`
    background: url("/images/btnHalo.png");
    filter: brightness(1.15);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    border-radius: 200px;
    padding: 3px;

    font-weight: 500;
    font-size: 15px;
    display: flex;
    align-items: center;
    text-align: center;
    border: none;
    cursor: pointer;
    color: #000000;

    position: relative;

    span {
        display: inline-block;
        // position: absolute;
        width: 100%;
        height: 100%;
        background: #fff;
        border-radius: 200px;
        padding: 10px 24px;
    }
`;
