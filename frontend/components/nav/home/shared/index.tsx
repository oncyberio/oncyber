import styled from "styled-components";

export const Container = styled.div<{
    hasBorder?: boolean;
}>`
    height: 80px;
    display: flex;
    align-items: center;
    padding: 16px 24px;
    align-items: center;
    justify-content: space-between;
    justify-content: center;

    ${({ hasBorder }) =>
        hasBorder ? ` border-bottom: 1px solid rgba(7, 7, 7, 0.2);` : ``}

    @media (min-width: 780px) {
        &.mobile {
            display: none;
        }
    }

    @media (max-width: 780px) {
        &.desktop {
            display: none;
        }
    }
`;

export const MaxWrapper = styled.div`
    width: 100%;
    max-width: 1280px;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
`;

export const LinksWrapper = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 56px;

    p {
        font-weight: 400;
        font-size: 16px;
        color: var(--home_navigation-main-color);
        cursor: pointer;
        display: inline-block;
    }
`;

export const LinksContainer = styled.div<{
    shouldDarkIcon?: boolean;
}>`
    display: flex;
    align-items: center;

    path {
        fill: var(--home_navigation-main-color) !important;
    }

    ${({ shouldDarkIcon }) =>
        shouldDarkIcon &&
        `
        path {
            fill: #000000 !important;
        }
    `};
`;

export const SubMenuWrapper = styled.div`
    position: fixed;
    height: calc(var(--100-vh) - 79px);
    width: 100%;
    background: #fff;
    top: 79px;
    left: 0;
    padding: 0 24px;
    overflow-y: auto;
    z-index: var(--zIndex_nav-submenu);

    @media (min-width: 780px) {
        display: none;
    }
`;

export const RoundNum = styled.span`
    position: absolute;
    right: -20px;
    color: #fff;
    background: black;
    border-radius: 50%;
    width: 8px;
    height: 8px;
    min-width: 8px;
    min-height: 8px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    top: -1.5px;
`;
