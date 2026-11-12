import styled from "styled-components";
export const StudioSceneFrame = styled.div`
    position: fixed;
    top: 64px;
    left: 6px;
    right: 6px;
    bottom: 6px;
    border-radius: 14px;
    overflow: hidden;
    background: var(--studio-bg, #141416);

    @media (max-width: 600px) {
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 0;
    }
`;
