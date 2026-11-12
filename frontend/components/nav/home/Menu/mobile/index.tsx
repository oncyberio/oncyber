import { useHome } from "@components/context/HomeContext";
import IconImg from "@ui/components/IconImg";
import Cyber from "@ui/components/Icons/Cyber";
import Menu from "@ui/components/Icons/Menu";
import X from "@ui/components/Icons/X";
import Input from "@ui/components/Input";
import { NButton } from "@ui/components/NButton";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
    Container,
    LinksContainer,
    MaxWrapper,
    SubMenuWrapper,
} from "../../shared";
import Search from "../../SubMenu/Search";
import SubMenu from "./SubMenu";

export default function MobileMenu({}) {
    const { handleToggle, toggleAuth, isFilter, openedMenu, hasBorder } =
        useHome();

    const navRef = useRef(null);

    const [hasScrolled, setHasScrolled] = useState(false);

    useEffect(() => {
        // if scroll height is greater than 100 change background
        const handleScroll = () => {
            if (navRef.current) {
                if (window.scrollY > 10) {
                    navRef.current.style.background = "#ffffff";
                    setHasScrolled(true);
                } else {
                    navRef.current.style.background = "transparent";
                    setHasScrolled(false);
                }
            }
        };

        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    return (
        <Container
            ref={navRef}
            style={openedMenu === "menu" ? { background: "#ffffff" } : {}}
            hasBorder={hasBorder}
            className="mobile"
        >
            <MaxWrapper>
                <LinksContainer
                    shouldDarkIcon={openedMenu === "menu" || hasScrolled}
                >
                    {openedMenu !== "search" ? (
                        <Link href="/" legacyBehavior>
                            <Cyber style={{ cursor: "pointer" }} size={42} />
                        </Link>
                    ) : null}
                </LinksContainer>

                <MobileSection>
                    {isFilter ? <Search mode="mobile" /> : null}

                    <Toggler
                        shouldDarkIcon={openedMenu === "menu" || hasScrolled}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleToggle("menu")}
                    >
                        {openedMenu !== "menu" ? (
                            <Menu size={24} />
                        ) : (
                            <X size={24} />
                        )}
                    </Toggler>
                </MobileSection>

                <SubMenu toggle={toggleAuth} />
            </MaxWrapper>
        </Container>
    );
}

const MobileSection = styled.div`
    display: inline-flex;
    gap: 24px;

    @media (min-width: 780px) {
        display: none;
    }
`;

const Toggler = styled.div<{
    shouldDarkIcon?: boolean;
}>`
    path {
        stroke: var(--home_navigation-main-color);
    }

    ${({ shouldDarkIcon }) =>
        shouldDarkIcon &&
        `
        path { stroke: #000000; }
    `};
`;
