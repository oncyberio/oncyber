import { useContext, useState } from "react";
import { useRouter } from "next/router";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
import { AuthServerSidePropsLite } from "@utils/authServerSideProps";
import ProviderButtons from "@components/modals/SignupProvider/ProviderButtons";
import { ProviderButtonsWrapper } from "@components/modals/SignupProvider/ProviderButtonsWrapper";
import CliService from "@api/cli/_api";
import { readCliAuthRequest } from "@features/cli-auth/request";
import { baseTokens } from "@styles/tokens";

/**
 * The browser side of the CLI login flow (world-cli.mjs's `login` command;
 * see pages/api/_v2/cli/{authorize,exchange}.ts for the code-mint/exchange
 * pair this hands off to). Wrangler-shaped: the CLI opens this page with
 * `?state=&callback=`, a signed-in user clicks Authorize, and the browser
 * redirects to the CLI's own localhost callback with a single-use code —
 * no scoped-permissions UI, per the "just direct connect" call.
 *
 * A terminal the browser cannot reach (a coding agent in the cloud) opens
 * it with `?challenge=` instead, and the page shows the code to carry over
 * by hand (features/cli-auth/request.ts).
 */
export default function CliAuth(props) {
    const { token, authenticated, user } = useContext(UserContext);
    const router = useRouter();
    const [authorizing, setAuthorizing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requiresSignup = !(authenticated && user?.id && token);

    const request = readCliAuthRequest(router.query);
    const [code, setCode] = useState("");
    const [copied, setCopied] = useState(false);

    async function handleAuthorize() {
        setError(null);
        setAuthorizing(true);
        try {
            if (request.kind === "code") {
                const answer = await CliService.authorize({
                    challenge: request.challenge,
                });
                setCode(answer.code);
                setAuthorizing(false);
                return;
            }
            if (request.kind !== "callback") return;
            const { code } = await CliService.authorize({});
            const target = new URL(request.callback);
            target.searchParams.set("code", code);
            target.searchParams.set("state", request.state);
            window.location.href = target.toString();
        } catch (err) {
            setError(err?.message ?? "Failed to authorize");
            setAuthorizing(false);
        }
    }

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
        } catch {
            // No clipboard here: the code is on the page to select.
        }
    }

    return (
        <Container>
            <Card>
                {request.kind === "invalid" ? (
                    <>
                        <Title>Invalid request</Title>
                        <Body>
                            This link does not say which terminal is signing in.
                            A sign-in is handed only to a terminal on this
                            machine, or shown here as a code for the terminal
                            that asked.
                        </Body>
                    </>
                ) : code ? (
                    <>
                        <Title>Give this code to your terminal</Title>
                        <Body>
                            Paste it where you started signing in: your
                            terminal, or the coding agent that gave you this
                            link. It works once, in the next five minutes, and
                            only there.
                        </Body>
                        <Code data-cli-code>{code}</Code>
                        <Buttons>
                            <Primary onClick={copyCode}>
                                {copied ? "Copied" : "Copy code"}
                            </Primary>
                        </Buttons>
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
                            access to, and publish games under your account: the
                            same access you have in the browser, nothing more.
                        </Body>
                        {request.kind === "code" && (
                            <Body>
                                This signs in a terminal on another machine. Go
                                on only if you started this yourself: if someone
                                sent you this link, close the page.
                            </Body>
                        )}
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

const Code = styled.code`
    display: block;
    margin: 0 0 20px;
    padding: 12px;
    border: 1px solid ${baseTokens.color.line.default};
    border-radius: ${baseTokens.radius.inset}px;
    font-family: ${baseTokens.font.mono};
    font-size: 14px;
    color: ${baseTokens.color.ink};
    overflow-wrap: anywhere;
    user-select: all;
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
