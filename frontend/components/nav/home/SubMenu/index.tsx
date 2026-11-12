import styled from "styled-components";
import { MaxWrapper } from "../shared";

import Filter from "./Filter";
import MobileFilter from "./Filter/Mobile";

import Search from "./Search";

export default function SearchMenu() {
    return (
        <div>
            <MobileFilter />
            <DesktopContainer>
                <MaxWrapper>
                    <Filter />
                    <Search mode="desktop" />
                </MaxWrapper>
            </DesktopContainer>
        </div>
    );
}

const DesktopContainer = styled.div`
    justify-content: center;

    padding: 0 24px;

    position: relative;

    height: 64px;

    border-bottom: 1px solid rgba(7, 7, 7, 0.2);

    display: flex;

    align-items: center;

    width: 100%;

    @media (max-width: 780px) {
        display: none;
    }
`;
