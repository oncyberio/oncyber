import { UserContext } from "@components/context/UserContext";

import { useRouter } from "next/router";

import { useContext, useEffect, useState } from "react";

const AccountDashboard = dynamic(() => import("../AccountDashboard"));

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import { showModal } from "@components/Dialogs";
import { IconButton } from "@ui/components/IconButton";

import dynamic from "next/dynamic";
import styled from "styled-components";
import Cyber from "@ui/components/Icons/Cyber";
import { useScreenSize } from "@components/hooks/useScreenSize";
import InlineError from "@ui/components/InlineError";
import { describeSignInResponse } from "@features/auth/signInErrors";

/**
 * Finishes a sign-in from an email link. When it cannot, it says which of
 * the cases it was (already used, opened on another device, expired, …)
 * instead of calling every one of them "expired". There is no Retry: the
 * same link cannot work a second time, so the sentence says what to do.
 */
export function MagicCode(props: { onClose?: () => void }) {
    const [failure, setFailure] = useState("");

    const { authHandler } = useContext(UserContext);

    useEffect(() => {
        authHandler({
            type: "passwordless",
        }).then((resp) => {
            if (resp?.success) {
                location.reload();
            } else {
                setFailure(describeSignInResponse(resp).message);
            }
        });
    }, []);

    return (
        <Container>
            <IconButton
                name="x"
                mode="dark"
                className="close"
                size={"medium"}
                onClick={props.onClose}
            />
            <Cyber size={43} />
            <div className="details">
                <span className="title">
                    {failure ? "Couldn’t sign you in" : "Connecting"}
                </span>
                {!failure ? (
                    <span className="sub-title">Connecting…</span>
                ) : null}
                <InlineError surface="light" message={failure} />
            </div>
        </Container>
    );
}

export default function EmailAuthHandler() {
    const router = useRouter();

    const { width } = useScreenSize();

    const style =
        width > 500
            ? {
                  top: 200,
                  width: "auto",
              }
            : {
                  top: "auto",
                  bottom: 0,
                  width: "100%",
                  maxWidth: "100%",
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  transform: "translate(-50%, 0px)",
              };

    useEffect(() => {
        if (
            router.query?.oobCode &&
            router.query?.mode === "signIn" &&
            router.query?.apiKey
        ) {
            if (router.query?.link) {
                handleOpenAccountSettings();
            } else {
                showModal(<MagicCode />, {
                    style: {
                        borderRadius: 16,
                        ...style,
                    },
                });
            }
        }
    }, []);

    function handleOpenAccountSettings() {
        amplitude_logAnalyticsEvent("account_settings_opened");
        showModal(<AccountDashboard defaultStep="connections" />);
    }

    return null;
}

const Container = styled.div`
    width: 500px;
    display: flex;
    padding: 32px;
    position: relative;
    align-items: center;
    flex-direction: column;
    justify-content: flex-start;
    filter: drop-shadow(0px 12px 28px rgba(0, 0, 0, 0.11))
        drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.15));
    background: #fff;
    gap: 8px;

    @media (max-width: 500px) {
        width: 100%;
        min-width: 100%;
        max-width: 100%;
    }

    & > .close {
        border: none;
        position: absolute;
        right: 20px;
        top: 10px;
        background: transparent;
    }

    & > .details {
        display: flex;
        flex-direction: column;
        gap: 6px;

        & > span.title {
            color: #000;
            text-align: center;
            font-family: Aeonik;
            font-size: 22px;
            font-style: normal;
            font-weight: 500;
            line-height: 100%;
            letter-spacing: -0.44px;
        }

        & > span.sub-title {
            color: #7a7a7a;
            text-align: center;
            font-family: Aeonik;
            font-size: 13px;
            font-style: normal;
            font-weight: 400;
            line-height: 120%;
            letter-spacing: -0.13px;

            &.error {
                color: red;
            }
        }
    }
`;
