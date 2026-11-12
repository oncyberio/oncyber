import XCircle from "@ui/icons/XCircle";
import { Theme } from "@ui/types";
import styled from "styled-components";
import Collab from "./Collab";
import Invite from "./Invite";

export function Collaborate() {
    return (
        <Container data-studio-surface>
            <Collab />
        </Container>
    );
}

const Container = styled.div`
    transition: 0.4s;
    background: var(--panel-bg);
    border: var(--panel-border);
    box-shadow: var(--panel-shadow);
    border-radius: var(--radius-panel);
    padding: 24px;
    color: var(--panel-text-primary);

    @media (max-width: 600px) {
        width: 100% !important;
        overflow-x: scroll;
    }
`;
