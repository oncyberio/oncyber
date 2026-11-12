import styled from "styled-components";
import { ButtonsWrapper, Container, WalletProviderButton } from "./styles";
import Input from "@ui/components/Input";

export default function EmailForm({
    setIsEmailLogin,
    email,
    setEmail,
    emailSuccess,
    handleSendEmailLink,
    sendingEmailLink,
}) {
    return (
        <Container>
            {emailSuccess ? (
                <div>
                    <EmailSuccess style={{ marginBottom: 12 }}>
                        Email sent successfully!
                    </EmailSuccess>
                    <WalletProviderButton
                        onClick={() => setIsEmailLogin(false)}
                    >
                        Return
                    </WalletProviderButton>
                </div>
            ) : (
                <div>
                    <Input
                        overrideTheme="dark"
                        borderColor="var(--field-border-color)"
                        color="var(--title-color)"
                        background="var(--field-bg-color)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="your@email.com"
                    />

                    {/* <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" /> */}

                    <ButtonsWrapper style={{ marginBottom: 24 }}>
                        <WalletProviderButton
                            onClick={() => setIsEmailLogin(false)}
                        >
                            Cancel
                        </WalletProviderButton>

                        <WalletProviderButton
                            disabled={sendingEmailLink}
                            onClick={() => {
                                handleSendEmailLink();
                            }}
                        >
                            {sendingEmailLink
                                ? "Sending…"
                                : "Send magic link"}
                        </WalletProviderButton>
                    </ButtonsWrapper>
                </div>
            )}
        </Container>
    );
}

const EmailSuccess = styled.p`
    text-align: center;
    margin: 24px 0;
    color: #44c3c3;
    margin-bottom: 24px;
`;
