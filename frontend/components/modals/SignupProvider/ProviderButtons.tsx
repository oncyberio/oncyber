import styled, { css } from "styled-components";

import React, { FunctionComponent } from "react";

import { WalletButtons } from "@ui/components/WalletButtons";

import IconImg from "@ui/components/IconImg";

import { useCyberTranslation } from "@components/context/I18nContext";

import Link from "next/link";

import { ProviderButtonsReturnProps } from "./ProviderButtonsWrapper";
import { NewStyledWalletProvider } from "@ui/components/WalletButtons/styles";
import { CloudinaryNextImage } from "@components/CloudinaryNextImage";

import Gmail from "@ui/icons/Gmail";
import Outlook from "@ui/icons/Outlook";
import { blueAction } from "@styles/brand";
import { baseTokens, landingTokens } from "@styles/tokens";
import InlineError from "@ui/components/InlineError";
import CyberloopMark from "@features/landing-carousel/components/CyberloopMark";

/** The email step reads the same in every layout of these buttons. */
export const emailStepCopy = {
    hint: "We’ll email you a link for a password-free sign in.",
    back: "Back",
    send: "Send sign-in link",
    sending: "Sending your link…",
    sentTitle: "Check your inbox",
    sent: (email: string) => `We sent a sign-in link to ${email}.`,
};

/** Sign-in buttons that are not a wallet; any other source is a wallet key. */
const NOT_A_WALLET = ["", "twitter", "google", "email", "passwordless"];

const ProviderButtons: FunctionComponent<
    Partial<ProviderButtonsReturnProps> & {
        isDarkTheme?: boolean;
        hideHeader?: boolean;
        header?: React.ReactNode;
        hideLogo?: boolean;
        modalLayout?: boolean;
    }
> = ({
    error,
    signInFailure,
    retrySignIn,
    shouldDisableButtons,
    isConnecting,
    email,
    setEmail,
    handleSendEmailLink,
    sendingEmailLink,
    resetEmailLink,

    emailSuccess,
    onConnectClick,
    web2Loading,
    authWeb2AfterConnect,
    isDarkTheme,
    hideHeader,
    header,
    hideLogo,
    modalLayout,
    isEmailInputShowing,
    setShowEmailInput,
}) => {
    const { t } = useCyberTranslation();

    // What did not work, shown beside the button that was used
    // (docs/feedback.md). A caller that only sets the plain `error` text
    // gets it above the buttons, where it has always been.
    const failure =
        signInFailure ||
        (error
            ? { message: error, source: "", cancelled: false, canRetry: false }
            : null);

    const failedAt = !failure
        ? ""
        : isEmailInputShowing
        ? "email"
        : failure.source === "twitter" || failure.source === "google"
        ? failure.source
        : NOT_A_WALLET.includes(failure.source)
        ? "top"
        : "wallet";

    const notice = (place: string) =>
        failedAt !== place ? null : (
            <SignInNotice $dark={isDarkTheme} data-beside={place}>
                {failure.cancelled ? (
                    // Closing a request is a choice: said, but not as an error.
                    <p role="status">{failure.message}</p>
                ) : (
                    <InlineError
                        surface={isDarkTheme ? "dark" : "light"}
                        message={failure.message}
                        onRetry={failure.canRetry ? retrySignIn : undefined}
                    />
                )}
            </SignInNotice>
        );

    const connectButtons = (
        <Web3ButtonsWrapper>
            {/* <div>
                <Title>
                    {loading ? t`CONNECTING` : t`LOG_IN`}
                </Title>

                <p
                    style={{
                        textAlign: "center",
                        color: "#6f6f6f",
                        fontSize: 15,
                        marginBottom: 28,
                    }}
                >
                    We only detect your wallet address to fetch your assets. We
                    do not access or perform any on-chain operation with it.
                </p>
            </div> */}
            <WalletButtons
                isDarkTheme={isDarkTheme}
                shouldDisableButtons={shouldDisableButtons || !!web2Loading}
                isConnecting={isConnecting}
                onConnectClick={onConnectClick}
            />
        </Web3ButtonsWrapper>
    );

    // if (isEmailInputShowing) {}

    return (
        <Content
            className="provider-buttons_content"
            isDarkTheme={isDarkTheme}
            $modalLayout={modalLayout}
        >
            <Main className="provider-buttons_main">
                {!hideHeader ? (
                    modalLayout ? (
                        <ModalHeading>
                            {!hideLogo && <CyberloopMark continuous />}
                            <h2>
                                {emailSuccess
                                    ? emailStepCopy.sentTitle
                                    : sendingEmailLink
                                    ? emailStepCopy.sending
                                    : header ?? "Sign in to oncyber"}
                            </h2>
                            <p>
                                {emailSuccess
                                    ? emailStepCopy.sent(email)
                                    : isEmailInputShowing
                                    ? emailStepCopy.hint
                                    : "Sign in to explore, create and share your worlds."}
                            </p>
                        </ModalHeading>
                    ) : (
                        <>
                            {!hideLogo ? (
                                <Link href={"/"}>
                                    <IconImg size={42} name="cyber" />
                                </Link>
                            ) : null}
                            <Title>
                                {emailSuccess
                                    ? emailStepCopy.sentTitle
                                    : sendingEmailLink
                                    ? emailStepCopy.sending
                                    : header ?? "Login to oncyber"}
                            </Title>

                            <Subtitle
                                isSendingEmail={
                                    isEmailInputShowing || sendingEmailLink
                                }
                            >
                                {emailSuccess
                                    ? emailStepCopy.sent(email)
                                    : isEmailInputShowing
                                    ? emailStepCopy.hint
                                    : "Connect with Socials or Web3"}
                            </Subtitle>
                        </>
                    )
                ) : null}

                {notice("top")}

                {/* Where the header is hidden, the same words stand here. */}
                {emailSuccess && !modalLayout && hideHeader ? (
                    <EmailSuccess>
                        {emailStepCopy.sentTitle}. {emailStepCopy.sent(email)}
                    </EmailSuccess>
                ) : null}

                {!isEmailInputShowing ? (
                    <Web2Wrapper>
                        {/* {web2Loading !== "password" ? (
                        <ButtonsWrapper style={{ marginBottom: 24 }}>
                            <ClickButton
                                onClick={() => {
                                    authWeb2AfterConnect("password", {
                                        email,
                                        password,
                                        isRegister: false,
                                    });
                                }}
                            >
                                Sign in
                            </ClickButton>
                            <ClickButton
                                onClick={() => {
                                    authWeb2AfterConnect("password", {
                                        email,
                                        password,
                                        isRegister: true,
                                    });
                                }}
                            >
                                Register
                            </ClickButton>
                        </ButtonsWrapper>
                    ) : (
                        <Spinner width={20} stroke={ isDarkTheme ? "#fff" : "#000"} />
                    )} */}
                        {connectButtons}

                        {notice("wallet")}

                        <NewStyledWalletProvider
                            as="button"
                            type="button"
                            disabled={shouldDisableButtons || !!web2Loading}
                            onClick={() => authWeb2AfterConnect("twitter")}
                        >
                            <CloudinaryNextImage
                                alt="twitter logo"
                                src={
                                    "https://cyber.mypinata.cloud/ipfs/QmednRC2JE2umUooNfsffF42kV2Mpm7xkaRzfpCMatdaFa?filename=twitter-transparent-icon_sxvu8g.png"
                                }
                                width={20}
                                height={20}
                                style={{
                                    objectFit: "cover",
                                    marginRight: "auto",
                                }}
                            />

                            <span>
                                {web2Loading === "twitter"
                                    ? t`LOADING` + "…"
                                    : "Twitter"}
                            </span>
                        </NewStyledWalletProvider>

                        {notice("twitter")}

                        <NewStyledWalletProvider
                            as="button"
                            type="button"
                            disabled={shouldDisableButtons || !!web2Loading}
                            onClick={() => authWeb2AfterConnect("google")}
                        >
                            <CloudinaryNextImage
                                alt="google logo"
                                src={
                                    "https://cyber.mypinata.cloud/ipfs/QmSdnj2cz2qZRSqpcY7jykTZp2z1S7xHH28U7t2NCNAnZj?filename=google-transparent-icon_bebqwl.png"
                                }
                                width={24}
                                height={24}
                                style={{
                                    objectFit: "cover",
                                    marginRight: "auto",
                                }}
                            />
                            <span>
                                {web2Loading === "google"
                                    ? t`LOADING` + "…"
                                    : "Google"}
                            </span>
                        </NewStyledWalletProvider>

                        {notice("google")}

                        <NewStyledWalletProvider
                            as="button"
                            type="button"
                            disabled={shouldDisableButtons || !!web2Loading}
                            onClick={() => setShowEmailInput(true)}
                        >
                            <IconImg
                                style={{ marginRight: "auto" }}
                                mode={isDarkTheme ? "light" : "dark"}
                                size={20}
                                name="mail"
                            />
                            <span>
                                {web2Loading === "passwordless"
                                    ? t`LOADING` + "…"
                                    : "Email"}
                            </span>
                        </NewStyledWalletProvider>
                    </Web2Wrapper>
                ) : (
                    <>
                        {emailSuccess ? (
                            <SendingEmail>
                                <div className="share">
                                    <button
                                        type="button"
                                        className="social"
                                        onClick={() =>
                                            window.open(
                                                "https://mail.google.com/",
                                                "_blank"
                                            )
                                        }
                                    >
                                        <Gmail />
                                        <span>Open Gmail</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="social"
                                        onClick={() =>
                                            window.open(
                                                "https://outlook.live.com/",
                                                "_blank"
                                            )
                                        }
                                    >
                                        <Outlook />
                                        <span>Open Outlook</span>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="retry-email"
                                    onClick={resetEmailLink}
                                >
                                    Try again or use another email
                                </button>
                            </SendingEmail>
                        ) : (
                            <EmailWrapper>
                                <Input
                                    value={email}
                                    disabled={sendingEmailLink}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    aria-label="Email address"
                                    autoComplete="email"
                                    placeholder="your@email.com"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleSendEmailLink();
                                        }
                                    }}
                                />

                                {notice("email")}

                                {/* <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" />  */}

                                <ButtonsWrapper style={{ marginBottom: 24 }}>
                                    <ClickButton
                                        disabled={sendingEmailLink}
                                        onClick={() => {
                                            setEmail("");
                                            setShowEmailInput(false);
                                        }}
                                    >
                                        {emailStepCopy.back}
                                    </ClickButton>
                                    <ClickButton
                                        className={
                                            modalLayout
                                                ? "primary-action"
                                                : undefined
                                        }
                                        disabled={sendingEmailLink}
                                        onClick={() => {
                                            handleSendEmailLink();
                                        }}
                                        style={
                                            modalLayout
                                                ? undefined
                                                : {
                                                      border: "none",
                                                      color: "#fff",
                                                      background: "#070707",
                                                  }
                                        }
                                    >
                                        {sendingEmailLink
                                            ? "Sending…"
                                            : emailStepCopy.send}
                                    </ClickButton>
                                </ButtonsWrapper>
                            </EmailWrapper>
                        )}
                    </>
                )}

                <Web3Wrapper>
                    {/* <ClickButton>
                        <IconImg name="blockchain" />
                        <p>WALLET CONNECT</p>
                    </ClickButton> */}
                </Web3Wrapper>
            </Main>
        </Content>
    );
};

const Content = styled.div<{
    isDarkTheme: boolean;
    $modalLayout?: boolean;
}>`
    width: 100%;
    height: 100%;

    --provider-buttons-font-color: #070707;
    --provider-buttons-border-color: #c2c2c2;
    --provider-buttons-font-hover-color: #070707;
    --provider-buttons-social-round-hover-background: rgb(247, 247, 247);

    ${(props) =>
        props.isDarkTheme
            ? `
                --provider-buttons-font-color: #ffffff;
                --provider-buttons-border-color: #c2c2c2;
                --provider-buttons-social-round-hover-background: #414141;
                --provider-icon-color: #ffffff;
            `
            : ``}

    button {
        cursor: pointer;
    }

    ${(props) =>
        props.$modalLayout &&
        css`
            height: auto;
            color: #121212;
            --provider-buttons-font-color: #121212;
            --provider-buttons-border-color: #cecece;
            --provider-buttons-font-hover-color: #121212;

            ${NewStyledWalletProvider} {
                min-height: 48px;
                border-radius: 12px;
                padding: 6px 18px;
                font-family: inherit;
                span {
                    font-size: 16px;
                    font-weight: 400;
                    text-transform: none;
                }
                &:hover:enabled {
                    background: #ececec;
                }
            }
            input,
            button {
                font-family: inherit;
            }
            input {
                border-radius: 12px;
            }
            button:focus-visible,
            input:focus-visible {
                outline: 2px solid #2567ff;
                outline-offset: 3px;
            }
            button:disabled {
                opacity: 0.45;
                cursor: not-allowed;
            }
            .primary-action {
                ${blueAction}
            }
        `}
`;

const ModalHeading = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    text-align: center;
    h2 {
        margin: 0;
        color: #121212;
        font-size: 28px;
        font-weight: 400;
        line-height: 1.15;
    }
    .cyberloop-mark {
        width: 32px;
        height: 32px;
        filter: brightness(0);
    }
    p {
        max-width: 280px;
        overflow-wrap: anywhere;
        margin: 0;
        color: #707070;
        font-size: 16px;
        line-height: 1.3;
    }
    @media (max-width: 450px) {
        gap: 20px;
        h2 {
            font-size: 26px;
        }
    }
`;

const Title = styled.h3`
    margin-bottom: 6px;
    margin-top: 16px;
    text-align: center;

    color: #000;
    font-size: 22px;
    font-weight: 500;
`;

const Web3Wrapper = styled.div`
    width: 100%;
`;

const Subtitle = styled.div<{ isSendingEmail: boolean }>`
    color: #7a7a7a;
    font-size: 13px;
    text-align: center;
    font-weight: 400;
    line-height: 120%;
    letter-spacing: -0.13px;

    ${(props) =>
        props.isSendingEmail &&
        css`
            width: 193px;
            color: #7a7a7a;
            overflow-wrap: anywhere;
        `}
`;

// A sign-in that did not finish, directly under the button that was used.
const SignInNotice = styled.div<{ $dark?: boolean }>`
    width: 100%;
    margin: 4px 0 12px;

    p {
        margin: 0;
        color: ${(props) =>
            props.$dark
                ? baseTokens.color.muted
                : landingTokens.color.paperMuted};
        font-size: ${baseTokens.font.size.md}px;
        line-height: 1.35;
        text-align: center;
    }
`;

// TODO: INPUT
// TODO: ROUND BUTTON

const EmailSuccess = styled.p`
    text-align: center;
    font-size: 12px;
    margin: 24px 0;
    color: #44c3c3;
`;

const Main = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`;

const Divider = styled.span`
    width: 100%;
    height: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #d9d9d9;
`;

const SendingEmail = styled.div`
    position: relative;
    width: 100%;
    font-family: inherit;
    .retry-email {
        display: block;
        margin: 18px auto 0;
        border: 0;
        padding: 8px;
        background: transparent;
        color: #707070;
        font: inherit;
        font-size: 13px;
        text-decoration: underline;
        text-underline-offset: 3px;
    }

    & > .share {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 40px;
        margin-top: 15px;
        cursor: pointer;

        @media (max-width: 500px) {
            flex-direction: column;
            gap: 10px;
        }

        & > .social {
            border: 0;
            padding: 0;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;

            & > span {
                color: #070707;
                font-family: inherit;
                font-size: 14px;
                font-style: normal;
                font-weight: 500;
                line-height: 36px;
            }
        }
    }
`;

const ClickButton = styled.button`
    display: flex;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    position: relative;
    border: 1px solid var(--provider-buttons-border-color);
    color: var(--provider-buttons-font-color);
    transition: 0.3s all ease;
    width: 100%;
    padding: 14px;

    p {
        margin: 0;
    }

    .icon-img {
        position: absolute;
        left: 21px;
        top: 50%;
        transform: translateY(-50%);
    }

    &:hover {
        color: var(--provider-buttons-font-hover-color);
        background: #f7f7f7;
    }
`;

const Input = styled.input`
    background: none;
    border: 1px solid var(--provider-buttons-border-color);
    border-radius: 900px;
    padding: 16px;
    text-align: center;
    width: 100%;
    margin-bottom: 18px;
    outline: none;
    color: var(--provider-buttons-font-color);

    &:focus {
        border: 1px solid var(--provider-buttons-border-color);
    }
`;

const Button = styled.button``;

const ButtonsWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
`;

const ButtonIcon = styled.div`
    border: 1px solid #c0c0c6;
    padding: 12px;
    border-radius: 50%;
    cursor: pointer;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 21px;

    transition: 0.2s;

    &:hover {
        background: var(--provider-buttons-social-round-hover-background);
    }
`;

const Web2Wrapper = styled.div`
    width: 100%;
    margin-top: 32px;
`;

const Web3ButtonsWrapper = styled.div`
    text-align: center;
`;

const EmailWrapper = styled.div`
    width: 100%;
    margin-top: 32px;
`;

export default ProviderButtons;
