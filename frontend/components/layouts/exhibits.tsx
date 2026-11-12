import Head from "next/head";
import styled from "styled-components";
import Footer from "../Footer";
// import Navigation from "../Navigation";
import Navigation from "../nav/main";

export default function ExhibitsLayout({
    isActive,
    children,
    setLightMode,
    isLight,
}) {
    return (
        <Container isLight={isLight}>
            <NavWrap isLight={isLight}>
                <Navigation />
            </NavWrap>

            {children}
            <Footer isLight={isLight} />
        </Container>
    );
}

const Container = styled.div<{ isLight: boolean }>`
    // background: #FEFEFE;
    background: ${({ isLight }) => (isLight ? "#fff" : "#000")};
`;

const NavWrap = styled.div<{ isLight: boolean }>`
    width: 100%;
    z-index: 20000;
    position: fixed;
    background: ${({ isLight }) => (isLight ? "#fff" : "#000")};

    @media (max-width: 900px) {
        padding: 8px 4px;
    }
`;
