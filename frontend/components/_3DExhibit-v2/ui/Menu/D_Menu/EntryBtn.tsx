import { useGatingError } from "@components/context/GatingErrorContext";
import { passwordRefusalMessage } from "@components/_3DExhibit-v2/utils/gating";
import { UserContext } from "@components/context/UserContext";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { isStandaloneVR } from "@components/_3DExhibit-v2/three/utils/platform";
import EntryButton from "@ui/components/EntryButton";
import { useContext, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { PasswordPrompt } from "./PasswordPrompt";
import { useEventCallback } from "@components/hooks/useEventCallback";

export default function EntryBtn({
    containerRef,
    worldState,
    playSpace,
    isDisablePlay,
    exhibit,
    isMobile,
    entryBtn,
    setEntryBtn,
}) {
    const btnRef = useRef<HTMLDivElement>(null);

    const { user, token } = useContext(UserContext);

    const { gatingError, isChecking, unlockPassword } = useGatingError();

    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const [errorState, setErrorState] = useState<string | null>(null);

    const isLoaded =
        worldState.type === "SPACE_IDLE" || worldState.type === "SPACE_PLAYING";

    useEffect(() => {
        const bbox = containerRef.current.getBoundingClientRect();

        function handleMouseMove(e) {
            if (btnRef.current) {
                // For this to work any other element needs to have a higher z index than the container
                if (!containerRef.current.contains(e.target)) {
                    btnRef.current.style.display = "none";
                } else {
                    btnRef.current.style.display = "block";
                }

                if (!entryBtn && isLoaded) {
                    setEntryBtn(true);
                }

                btnRef.current.style.top =
                    e.clientY - btnRef.current.offsetHeight / 2 + "px";

                if (
                    window.innerWidth >
                    e.clientX + btnRef.current.clientWidth / 2
                ) {
                    btnRef.current.style.left = e.clientX - 10 + "px";
                }
            }
        }

        window.addEventListener("mousemove", handleMouseMove);

        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [isLoaded]);

    const handlePlay = useEventCallback(() => {
        //
        if (isLoaded && !isDisablePlay) {
            const enterVR = isStandaloneVR();

            playSpace(enterVR);
        }
    }, []);

    const isAnonymous = !user.id || !token;

    return (
        <>
            {showPasswordModal && (
                <PasswordPrompt
                    message={
                        exhibit?.gating?.password?.message ||
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
                <BtnContainer
                    onClick={async () => {
                        if (isLoaded && !isDisablePlay) {
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
                    }}
                    isMobile={IS_MOBILE}
                    ref={btnRef}
                >
                    {entryBtn && (
                        <EntryButton
                            epilepsyWarning={
                                exhibit?.info?.room === "testfud00000"
                            }
                            isMobile={isMobile}
                            gated={!!gatingError}
                            loading={!isLoaded}
                            isDark
                            isAnon={isAnonymous && exhibit?.gating?.noAnonymous}
                        />
                    )}
                </BtnContainer>
            )}
        </>
    );
}

const BtnContainer = styled.div<{
    isMobile?: boolean;
}>`
    position: fixed;

    ${({ isMobile }) => {
        return isMobile
            ? css`
                  display: block;
                  position: relative;
                  top: auto;
                  left: auto;
                  position: fixed;
                  top: 72%;
                  transform: translate(-50%, -50%);
                  left: 50%;
              `
            : css`
                  display: flex;
                  align-items: center;
                  padding-left: 30px;
                  justify-content: center;
              `;
    }}
`;
