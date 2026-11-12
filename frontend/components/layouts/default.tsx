import Head from "next/head";
import Navigation from "../nav/main";
import styled from "styled-components";
import { Theme } from "@ui/types";
import HomeNavigation from "@components/nav/home";
import HomeProvider from "@components/context/HomeContext";

export interface DefaultLayoutProps {
    showFooter: boolean;
    overrideTheme?: Theme;
    children: React.ReactNode;
}

function DefaultLayout({ overrideTheme, children }: DefaultLayoutProps) {
    return (
        <Container overrideTheme={overrideTheme}>
            <NavWrap>
                <HomeProvider isFilter={false}>
                    <HomeNavigation />
                </HomeProvider>
                {/* <Navigation overrideTheme={overrideTheme} /> */}
            </NavWrap>

            {children}
        </Container>
    );
}

export default DefaultLayout;

DefaultLayout.defaultProps = {
    showFooter: false,
};

const Container = styled.div<{ overrideTheme: Theme }>`
    height: auto !important;
    min-height: 100vh;
    background: ${({ theme, overrideTheme }) =>
        (overrideTheme ? overrideTheme : theme.type) === "dark"
            ? "#000"
            : "#fff"};

    @media (max-width: 600px) {
        padding: 0px;
    }
`;

const NavWrap = styled.div`
    width: 100%;

    @media (max-width: 650px) {
        position: initial;
    }
`;
