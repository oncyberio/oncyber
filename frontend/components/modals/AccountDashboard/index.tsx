import {
    Multiform,
    MultiformStep,
} from "@features/studio/components/Multiform";
import { NButton } from "@ui/components/NButton";
import styled from "styled-components";
import Profile from "./Profile";
import LinkAccount from "./LinkAccount";
import { stepIcon } from "@features/studio/StudioMenu/SpaceSettings";
import {
    DARK_DIALOG_CONTENT,
    darkDialogColors,
} from "@components/Dialogs/styles";
import { baseTokens as base, landingTokens as landing } from "@styles/tokens";

const steps: [MultiformStep, ...MultiformStep[]] = [
    {
        value: "account",
        title: "My account",
        description: "Change your pfp and username",
        icon: stepIcon("user"),
        form: <Profile />,
    },
    {
        value: "connections",
        title: "Connections",
        description: "Link other accounts",
        icon: stepIcon("wallet"),
        form: <LinkAccount />,
    },
];

export default function AccountDashboard({
    close,
    defaultStep,
}: {
    close?: () => void;
    defaultStep?: "account" | "connections";
}) {
    const actions = (
        <Actions>
            <NButton
                size="small"
                overrideTheme="dark"
                outline
                onClick={() => {
                    close();
                }}
            >
                Cancel
            </NButton>
        </Actions>
    );

    return (
        <Container {...DARK_DIALOG_CONTENT}>
            <Multiform
                defaultStep={defaultStep}
                className="account-dashboard"
                title="Account dashboard"
                steps={steps}
                actions={actions}
            />
        </Container>
    );
}

// Dark on every page, like the shared dialog. The studio panel variables
// that Multiform reads are set from the dialog surface.
const Container = styled.div`
    ${darkDialogColors}
    --panel-bg: var(--bg-color);
    --panel-text-primary: var(--title-color);
    --panel-text-secondary: var(--content-color);
    --panel-border: none;
    --panel-shadow: none;
    --radius-panel: 0;
    --studio-line: ${base.color.line.default};
    --studio-inset: ${landing.color.canvas};
    --studio-hover: ${landing.color.hover};
    /* The studio switch (Connections) reads these too. */
    --studio-ink: var(--title-color);
    --studio-panel: var(--bg-color);
    --studio-line-strong: ${base.color.line.hover};
    width: 100%;
    height: 100%;
    color: var(--title-color);

    .account-dashboard {
        min-height: 600px;

        .main {
            width: 450px;
        }
    }

    @media (max-width: 625px) {
        .account-dashboard {
            .main {
                width: 90vw;
                min-height: 525px;
            }
        }
    }
`;

const Actions = styled.div``;
