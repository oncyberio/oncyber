import styled from "styled-components";
import { color } from "./tokens";

export const Overlay = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${color.black};
    opacity: 0.3;
    z-index: 1000000;

    display: flex;
    align-items: center;
    justify-content: center;
    color: ${color.white};
    font-size: 24px;
`;
