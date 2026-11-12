import { useContext, useState } from "react";
import { useRouter } from "next/router";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
import { AuthServerSidePropsLite } from "@utils/authServerSideProps";
import ProviderButtons from "@components/modals/SignupProvider/ProviderButtons";
import { ProviderButtonsWrapper } from "@components/modals/SignupProvider/ProviderButtonsWrapper";
import CliService from "@api/cli/_api";

/**
 * The browser side of the CLI login flow (world-cli.mjs's `login` command;
 * see pages/api/_v2/cli/{authorize,exchange}.ts for the code-mint/exchange
 * pair this hands off to). Wrangler-shaped: the CLI opens this page with
 * `?state=&callback=`, a signed-in user clicks Authorize, and the browser
 * redirects to the CLI's own localhost callback with a single-use code —
 * no scoped-permissions UI, per the "just direct connect" call.
 */
function isLoopbackCallback(raw: string): boolean {
    try {
        const url = new URL(raw);
        return (
            (url.protocol === "http:" || url.protocol === "https:") &&
            ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
        );
    } catch {
        return false;
    }
}

export default function CliAuth(props) {
    const { token, authenticated, user } = useContext(UserContext);
    const router = useRouter();
    const [authorizing, setAuthorizing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requiresSignup = !(authenticated && user?.id && token);

    const state =
        typeof router.query.state === "string" ? router.query.state : "";
    const callback =
        typeof router.query.callback === "string" ? router.query.callback : "";
    const callbackValid = callback.length > 0 && isLoopbackCallback(callback);

    async function handleAuthorize() {
        setError(null);
        setAuthorizing(true);
        try {
            const { code } = await CliService.authorize({});
            const target = new URL(callback);
            target.searchParams.set("code", code);
            target.searchParams.set("state", state);
            window.location.href = target.toString();
        } catch (err) {
            setError(err?.message ?? "Failed to authorize");
            setAuthorizing(false);
        }
    }

    return (
        <Container>
            <Card>
                {!callbackValid ? (
                    <>
                        <Title>Invalid request</Title>
                        <Body>
                            This link is missing a valid localhost callback —
                            refusing to redirect anywhere else with an
                            authorization code.
                        </Body>
                    </>
                ) : requiresSignup ? (
                    <>
                        <Title>Sign in to continue</Title>
                        <Body>
                            Sign in, then you'll be asked to authorize the
                            Oncyber CLI.
                        </Body>
                        <ProviderButtonsWrapper
                            onConnect={async () => router.reload()}
                        >
                            <ProviderButtons isDarkTheme hideHeader />
                        </ProviderButtonsWrapper>
                    </>
                ) : (
                    <>
                        <Title>Oncyber CLI wants to access your account</Title>
                        <Body>
                            Signed in as <strong>{user?.id}</strong>. This lets
                            your terminal read and edit worlds you already have
                            access to — the same access you have in the browser,
                            nothing more.
                        </Body>
                        {error && <ErrorText>{error}</ErrorText>}
                        <Buttons>
                            <Primary
                                onClick={handleAuthorize}
                                disabled={authorizing}
                            >
                                {authorizing ? "Authorizing…" : "Authorize"}
                            </Primary>
                            <Secondary
                                onClick={() => window.close()}
                                disabled={authorizing}
                            >
                                Cancel
                            </Secondary>
                        </Buttons>
                    </>
                )}
            </Card>
        </Container>
    );
}

export const getServerSideProps = AuthServerSidePropsLite();

const Container = styled.div`
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #070707;
    color: #ffffff;
`;

const Card = styled.div`
    max-width: 420px;
    padding: 32px;
    border-radius: 12px;
    background: #1e1e1e;
`;

const Title = styled.h1`
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 12px;
`;

const Body = styled.p`
    font-size: 14px;
    line-height: 1.5;
    color: #a7a7a7;
    margin: 0 0 20px;
`;

const ErrorText = styled.p`
    font-size: 13px;
    color: #ff8080;
    margin: 0 0 16px;
`;

const Buttons = styled.div`
    display: flex;
    gap: 12px;
`;

const Primary = styled.button`
    flex: 1;
    padding: 10px 16px;
    border-radius: 999px;
    border: none;
    background: #ffffff;
    color: #070707;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const Secondary = styled.button`
    padding: 10px 16px;
    border-radius: 999px;
    border: 1px solid #3d3d3d;
    background: none;
    color: #ffffff;
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;
