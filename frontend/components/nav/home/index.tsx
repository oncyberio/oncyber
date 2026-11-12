import { useHome } from "@components/context/HomeContext";

import dynamic from "next/dynamic";

import styled from "styled-components";

import DesktopMenu from "./Menu/desktop";

import MobileMenu from "./Menu/mobile";

import SearchMenu from "./SubMenu";

const ConnectModal = dynamic(() => import("@ui/components/ConnectWallet"));

export default function HomeNavigation({ hasBorder = true, isLight = false }) {
    const { toggleAuth, isAuthShowing, isFilter } = useHome();

    return (
        <Container hasBorder={hasBorder} isLight={isLight}>
            <ConnectModal
                toggle={toggleAuth}
                open={isAuthShowing}
                style={{ zIndex: 10000000 }}
                noShowClose={false}
                fullScreenMobile={false}
            />
            <DesktopMenu />
            <MobileMenu />
            {/* {isFilter && <SearchMenu />} */}
        </Container>
    );
}

const Container = styled.div<{
    hasBorder?: boolean;
    isLight?: boolean;
}>`
    --home_navigation-main-color: #070707;
    --home_navigation-secondary-color: #9c9c9c;
    --home_navigation-separator-color: #cdcdcd;

    ${({ isLight }) =>
        isLight &&
        `
        --home_navigation-main-color: #ffffff;
        --home_navigation-secondary-color: #d9d2d2;
        --home_navigation-separator-color: #cdcdcd;
    `}

    @media (max-width: 780px) {
        z-index: var(--zIndex_mobile-sticky-nav);
        position: sticky;
        top: 0;
        // background: #fff;
    }
`;
