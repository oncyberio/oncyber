import { UserContext } from "@components/context/UserContext";
import { NButton } from "@ui/components/NButton";
import { GradientButton } from "@ui/components/NButton/GradientButton";

import Link from "next/link";
import { useContext } from "react";

import styled from "styled-components";

export default function SubMenu() {
    const { logout, user } = useContext(UserContext);

    return <Container>Search</Container>;
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;

    // @media (min-width: 780px) {
    display: none;
    // }
`;
