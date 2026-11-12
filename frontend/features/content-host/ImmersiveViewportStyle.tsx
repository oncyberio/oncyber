import { createGlobalStyle } from "styled-components";

/** Keep wheel/touch overscroll on the world instead of exposing the document. */
const ImmersiveViewportStyle = createGlobalStyle`
    html,
    body {
        overflow: hidden;
        overscroll-behavior: none;
        background-color: #050607;
    }
`;

export default ImmersiveViewportStyle;
