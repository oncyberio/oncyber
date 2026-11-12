import { useFilter } from "@components/context/FilterContext";
import { useHome } from "@components/context/HomeContext";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import IconImg from "@ui/components/IconImg";
import Input from "@ui/components/Input";
import { useEffect, useRef } from "react";
import styled from "styled-components";
import { MaxWrapper, SubMenuWrapper } from "../../shared";
import SubMenu from "./SubMenu";

export default function Search({ mode }: { mode: "mobile" | "desktop" }) {
    const { handleSearch, search } = useFilter();

    const { openedMenu, handleToggle } = useHome();

    const inputRef = useRef(null);

    const { clickRef } = useOnClickOutside({
        handler: () => {
            if (openedMenu === "search") {
                if (mode === "mobile" && window.innerWidth <= 780) {
                    handleToggle("");
                }

                if (mode === "desktop" && window.innerWidth > 780) {
                    handleToggle("");
                }
            }
        },
    });

    useEffect(() => {
        if (openedMenu === "search") {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }
    }, [openedMenu]);

    return (
        <Container>
            <div onClick={() => handleToggle("search")}>
                <IconImg
                    style={{ cursor: "pointer" }}
                    name="search"
                    size={24}
                />
            </div>
            <Wrapper
                ref={clickRef}
                style={{
                    display: openedMenu === "search" ? "flex" : "none",
                }}
            >
                <MaxWrapper>
                    <SearchBarContainer>
                        <IconImg
                            style={{ cursor: "pointer" }}
                            name="search"
                            size={24}
                        />
                        <Input
                            ref={inputRef}
                            value={search}
                            onChange={(e) => {
                                handleSearch(e.target.value);
                            }}
                            style={{ border: "none", width: "100%" }}
                            placeholder="Search for a world by name, author…"
                        />
                    </SearchBarContainer>
                    <MobileSection>
                        <div
                            onClick={() => {
                                handleSearch("");
                                handleToggle("search");
                            }}
                        >
                            <IconImg
                                style={{ cursor: "pointer" }}
                                name="x"
                                size={24}
                            />
                        </div>
                    </MobileSection>
                </MaxWrapper>
            </Wrapper>

            {/* {openedMenu === "search" ? (
                <SubMenuWrapper>
                    <SubMenu />
                </SubMenuWrapper>
            ) : null} */}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    justify-content: center;
`;

const MobileSection = styled.div`
    display: inline-flex;
    gap: 24px;
`;

const Wrapper = styled.div`
    position: absolute;
    width: 100%;
    left: 0;
    background: #fff;
    z-index: var(--zIndex_nav-search-wrapper);
    top: 0;
    display: flex;
    align-items: center;
    height: 80px;
    padding: 16px 24px;
    border-bottom: 1px solid rgba(7, 7, 7, 0.2);
    justify-content: center;

    @media (min-width: 780px) {
        height: 64px;

        border-bottom: 1px solid rgba(7, 7, 7, 0.2);
    }
`;

const SearchBarContainer = styled.div`
    display: flex;
    align-items: center;
    width: 100%;

    input {
        width: 100%;
    }
`;
