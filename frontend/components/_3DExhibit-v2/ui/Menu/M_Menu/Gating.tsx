import { useGatingError } from "@components/context/GatingErrorContext";
import { passwordRefusalMessage } from "@components/_3DExhibit-v2/utils/gating";
import React, { useContext, useState } from "react";
import styled from "styled-components";
import { PasswordPrompt } from "../D_Menu/PasswordPrompt";
import GatingButton from "@ui/components/EntryButton";
import Joystick from "./Joystick";
import { UserContext } from "@components/context/UserContext";

export default function Gating({
    ref,
    exhibit,
    settings,
    isPlaying,
    handlePlay,
    isDisablePlay,
    isChatDisplayed,
    isExtaMenuVisible,
    mobileMoveRef,
    toggleDetails,
    isInteractionVisible,
}) {
    const { user, token } = useContext(UserContext);

    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const { gatingError, isChecking, unlockPassword } = useGatingError();

    const [errorState, setErrorState] = useState<string | null>(null);

    const onGate = () => {
        if (!isDisablePlay) {
            //

            if (!gatingError) {
                //
                handlePlay();
                //
            } else if (gatingError === "password-error") {
                //
                setShowPasswordModal(true);
            }
        }
    };

    const isAnonymous = !user.id || !token;

    return (
        <Container>
            {showPasswordModal && (
                <PasswordPrompt
                    message={
                        exhibit.gating.password.message ||
                        "Enter password to access this world"
                    }
                    error={errorState}
                    isChecking={isChecking}
                    onCancel={() => {
                        //
                        setErrorState(null);
                        setShowPasswordModal(false);
                    }}
                    onSubmit={async (value) => {
                        //
                        try {
                            //
                            setErrorState(null);

                            const err = await unlockPassword(value);

                            if (err == null) {
                                //

                                setErrorState(null);
                                setShowPasswordModal(false);

                                handlePlay();
                            } else {
                                setErrorState(passwordRefusalMessage(err));
                            }
                        } catch (err) {
                            //
                            console.error(err);
                        }
                    }}
                />
            )}

            {!showPasswordModal && (
                <>
                    {!!gatingError && !toggleDetails && (
                        <div onClick={onGate}>
                            <GatingButton
                                epilepsyWarning={
                                    exhibit?.info?.room === "testfud00000"
                                }
                                isMobile={true}
                                gated={true}
                                loading={false}
                                isDark
                                isAnon={
                                    isAnonymous && exhibit?.gating?.noAnonymous
                                }
                            />
                        </div>
                    )}
                </>
            )}

            <Joystick
                settings={settings}
                isPlaying={isPlaying}
                gatingError={!!gatingError}
                mobileMoveRef={mobileMoveRef}
                toggleDetails={toggleDetails}
                isChatDisplayed={isChatDisplayed}
                isExtaMenuVisible={isExtaMenuVisible}
                isInteractionVisible={isInteractionVisible}
            />
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    z-index: 5;
    width: 100%;
    position: absolute;
    bottom: 44px;

    @media (orientation: landscape) {
        bottom: 0px !important;
    }
`;
