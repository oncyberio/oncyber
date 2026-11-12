import React, { useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "@components/context/UserContext";
import { createEmptySpace } from "@features/spaces/create/utils";
import QuizModal from "@features/onboarding/components/QuizModal";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";
import { useStudioMenu } from "@features/studio/StudioMenu/context/StudioContext";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import { useUserKits } from "@features/studio/EditWorldMenu/hooks/useUserKits";
import { useStateRef } from "@components/hooks/useStateRef";
import { RoundButton } from "@components/DesignSystem/buttons";
import styled from "styled-components";
import { blueAction } from "@styles/brand";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

export default function PickBuildMore({ setSkipCommitAnonExhibit }) {
    const { token, user, isAnonymous } = useContext(UserContext);

    const { onboarding, nextStudioTuto, nextStudioQuiz } = useOnboarding();

    const { exhibit, isAuthShowing, toggleAuth } = useStudioMenu();

    const [visible, setVisible] = useState(!(isAnonymous || exhibit?.mock));

    useEffect(() => {
        setVisible(!(isAnonymous || exhibit?.mock));
    }, [isAnonymous, exhibit?.mock]);

    useEffect(() => {
        if (visible) return;

        const timer = setTimeout(() => {
            setVisible(true);
        }, 1200);

        return () => clearTimeout(timer);
    }, []);

    const { changeExhibit } = useStudioMenu();

    const { kits, loadPromise } = useUserKits();

    const kitsRef = useStateRef(kits);

    useEffect(() => {
        if (visible && onboarding?.studio === "PickBuildMore") {
            amplitude_logAnalyticsEvent("view_path_selector", {
                source: isAnonymous ? "anon" : "create_gallery",
                user_id: isAnonymous ? "anon" : user.id,
            });
        }
    }, [visible, onboarding?.studio]);

    const handleBuildKit = async () => {
        //
        let kitsLength = 0;

        let kit = null;

        amplitude_logAnalyticsEvent("path_step_1", {
            choice: "kitbash",
            user_id: isAnonymous ? "anon" : user.id,
        });

        await loadPromise
            .then(() => {
                //
                const userKits = kitsRef.current;

                kit = userKits[0].slug;

                if (kit) {
                    //
                    kitsLength = userKits.length;
                }
            })
            .catch((err) => {
                //
                console.error(err);
            });

        if (kit === null || kitsLength === 0) {
            const next = await createEmptySpace(user.id, token, kit);

            await changeExhibit(next, isAnonymous);

            nextStudioTuto("AssetsContent");
        } else {
            nextStudioQuiz("PickKit");
        }
    };

    const handleBuildTemplate = () => {
        amplitude_logAnalyticsEvent("path_step_1", {
            choice: "template",
            user_id: isAnonymous ? "anon" : user.id,
        });

        nextStudioQuiz("PickTemplate");
    };

    const items = useMemo(() => {
        return [
            {
                id: "build-width-a-template",
                title: "Build With A Template",
                preview: "/images/build-template.png",
                next: handleBuildTemplate,
            },
            {
                id: "build-from-scratch",
                title: "Build From Scratch",
                preview: "/images/build-kit.png",
                badge: "Beta",
                next: handleBuildKit,
            },
        ];
    }, []);

    const { clickRef } = useOnClickOutside({
        handler: () => {
            if (!isAnonymous) {
                nextStudioQuiz("");
            }
        },
    });

    const handleSkip = () => {
        nextStudioQuiz("");
    };

    const handleLogin = useEventCallback(() => {
        toggleAuth(true);
        setSkipCommitAnonExhibit(true);
    }, []);

    return (
        onboarding?.studio === "PickBuildMore" &&
        visible && (
            <QuizModal
                items={items}
                type="buildMore"
                clickRef={clickRef}
                onBack={isAnonymous ? null : handleSkip}
                title="Start building your 3D World"
            >
                {isAnonymous && (
                    <LoginWrapper>
                        <span>Existing user?</span>
                        <RoundButton
                            className="login-cta"
                            onClick={handleLogin}
                        >
                            Sign In
                        </RoundButton>
                    </LoginWrapper>
                )}
            </QuizModal>
        )
    );
}

const LoginWrapper = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;

    & > span {
        color: #fff;
        font-family: Aeonik;
        font-size: 18px;
        font-style: normal;
        font-weight: 500;
        line-height: 100%;
        letter-spacing: -0.36px;
    }

    /* Signing in is the important action: the shared blue button. */
    .login-cta {
        ${blueAction}
        border-color: transparent;
        &:hover:not(:disabled) {
            opacity: 1;
        }
    }
`;
