import Spinner from "@ui/components/Spinner";
import styled from "styled-components";
import {
    DARK_DIALOG_CONTENT,
    darkDialogColors,
    dialogCopy,
    dialogTitle,
} from "@components/Dialogs/styles";

export function Confirming() {
    return (
        <Container {...DARK_DIALOG_CONTENT}>
            <h2>Processing the transaction</h2>
            <Spinner
                isLightTheme={false}
                width={48}
                stroke="#9c9c9c"
                style={{ opacity: "0.3" }}
            />
            <p>Check your wallet provider to confirm the purchase.</p>
        </Container>
    );
}

// Dark on every page: the shared dialog surface and its colours.
const Container = styled.div`
    ${darkDialogColors}
    background: var(--bg-color);
    color: var(--title-color);
    width: 400px;
    display: flex;
    min-height: auto;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    padding-bottom: 56px;

    @media (max-width: 550px) {
        width: 90vw;
        padding: 48px 16px;
    }

    & > h2 {
        ${dialogTitle}
    }

    p {
        ${dialogCopy}
    }
`;
