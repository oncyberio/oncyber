import { StyledModalProps } from "./styles";
import { noop } from "lodash";
import ModalWrapper from "@components/modals/Modal";
import React, { forwardRef, useEffect, useContext } from "react";
import { useCyberTheme } from "@components/context/ThemeProvider";
import ProviderButtons from "@components/modals/SignupProvider/ProviderButtons";
import styled from "styled-components";
import { ProviderButtonsWrapper } from "@components/modals/SignupProvider/ProviderButtonsWrapper";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { IconButton } from "@ui/components/IconButton";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { useRouter } from "next/router";
import { UserContext } from "@components/context/UserContext";
import { brandFoundation } from "@styles/brand";
import { MoreOptionsWrapper } from "@ui/components/WalletButtons/styles";

export type ConnectWalletProps = React.HTMLAttributes<HTMLDivElement> &
    StyledModalProps & {
        open?: boolean;
        skipAuth?: boolean;
        noShowClose?: boolean;
        onlyEthereum?: boolean;
        callbackAfterAuth?: Function;
        toggle: (b?: boolean) => void;
        skipRedirectToAccount?: boolean;
        setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
        forceOpen?: boolean;
        customModalWrapper?: boolean;
        header?: React.ReactNode;
        fullScreenMobile?: boolean;
    };

function onlyEthButton(item) {
    return item.onlyEthereum;
}

const Modal = forwardRef(
    (props: ConnectWalletProps, ref: React.Ref<HTMLDivElement>) => {
        const {
            open,
            style = {},
            toggle,
            setOpen,
            skipAuth,
            noShowClose,
            onlyEthereum,
            callbackAfterAuth,
            skipRedirectToAccount,
            forceOpen,
            customModalWrapper = false,
            header,
            fullScreenMobile = false,
            ...rest
        } = props;

        const { isAnonymous, isSignedIn } = useContext(UserContext);

        const { isLightTheme } = useCyberTheme();

        // "Skip" exists for adding a second account while already signed in:
        // it keeps the current session and only records the new account. For
        // a visitor who is not signed in yet it would leave them signed out,
        // so it applies only when there is a session to keep.
        const _skipRedirectToAccount = isSignedIn
            ? skipRedirectToAccount
            : false;

        const router = useRouter();

        useEffect(() => {
            if (open) {
                amplitude_logAnalyticsEvent("auth_modal_opened", {
                    source: router.route,
                });
            }
        }, [open]);

        function handleAuthCallback({ token, account, connection, user }) {
            callbackAfterAuth?.(
                token,
                account,
                connection.type === "ethereum" ? connection.eth : null,
                {
                    userData: user,
                    exhibit: user?.exhibit,
                }
            );

            if (isAnonymous) {
                location.reload();
            }

            toggle?.();
        }

        const resetCallback = () => {};

        return customModalWrapper ? (
            <ProviderWrapper>
                <ProviderButtonsWrapper
                    authCallback={handleAuthCallback}
                    skipAuth={skipAuth}
                    skipRedirectToAccount={_skipRedirectToAccount}
                >
                    <ProviderButtons header={header} modalLayout />
                </ProviderButtonsWrapper>
            </ProviderWrapper>
        ) : (
            <ModalWrapper
                isMobileResponsive={false}
                ariaLabel="Sign in to oncyber"
                overrideTheme="light"
                forceOpen={forceOpen}
                size="medium"
                hasBackground
                isShowing={open}
                isBackdrop={false}
                isCloseRight={true}
                toggle={toggle}
                setShow={setOpen}
                overlayStyle={{
                    background: "rgba(10, 10, 10, 0.8)",
                }}
                style={{
                    display: "flex",
                    justifyContent: "center",
                    background: "#f6f6f6",
                    borderRadius: 24,
                    width: "calc(100% - 32px)",
                    maxWidth: 440,
                    maxHeight: "calc(100dvh - 32px)",
                    marginBottom: 0,
                    boxShadow: "0 24px 80px #00000033",
                    ...(IS_MOBILE && fullScreenMobile
                        ? {
                              borderRadius: 0,
                              width: "100%",
                              maxWidth: "100%",
                              maxHeight: "100dvh",
                              minHeight: "100dvh",
                          }
                        : {}),
                    ...style,
                }}
                closeStyle={{
                    top: 12,
                    right: 12,
                    background: "transparent",
                    color: "#707070",
                }}
                noShowClose={false}
                resetCallback={resetCallback}
            >
                {/* {element} */}
                <ProviderWrapper>
                    {/* {IS_MOBILE && (
                        <IconButton
                            name="x"
                            mode="dark"
                            className="close"
                            size={"medium"}
                            onClick={() => toggle?.(false)}
                        />
                    )} */}
                    <ProviderButtonsWrapper
                        authCallback={handleAuthCallback}
                        skipAuth={skipAuth}
                        skipRedirectToAccount={_skipRedirectToAccount}
                    >
                        <ProviderButtons header={header} modalLayout />
                    </ProviderButtonsWrapper>
                </ProviderWrapper>
            </ModalWrapper>
        );
    }
);

Modal.defaultProps = {
    setOpen: noop,
    noShowClose: true,
    onlyEthereum: false,
};

const ProviderWrapper = styled.div`
    ${brandFoundation}
    padding: 44px 40px 32px;
    width: 100%;
    min-width: 0;
    align-self: flex-start;
    flex-shrink: 0;
    color: #121212;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    ${MoreOptionsWrapper} {
        appearance: none;
        width: 100%;
        border: 0;
        padding: 0;
        min-height: 32px;
        background: transparent;
        color: #707070;
        font: inherit;
        font-size: 13px;
        margin: 8px 0 16px;
    }
    @media (max-width: 450px) {
        padding: 40px 24px 24px;
    }

    & > .close {
        margin-bottom: 25px;
        background: transparent;
    }
`;

export default Modal;
