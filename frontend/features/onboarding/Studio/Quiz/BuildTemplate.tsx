import React, { useMemo, useContext } from "react";
import { useEventCallback } from "@components/hooks/useEventCallback";

import QuizModal from "@features/onboarding/components/QuizModal";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";
import { useRooms } from "@features/spaces/create/components/DestinationSelector/useRooms";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UserContext } from "@components/context/UserContext";
import { RoundButton } from "@components/DesignSystem/buttons";

import styled from "styled-components";
import { blueAction } from "@styles/brand";
import { useStudioMenu } from "@features/studio/StudioMenu/context/StudioContext";

export default function PickBuildMore({ setSkipCommitAnonExhibit }) {
    const { rooms } = useRooms();

    const { isAnonymous, user } = useContext(UserContext);
    const { exhibit, isAuthShowing, toggleAuth } = useStudioMenu();


    const { onboarding, nextStudioQuiz, setCurrentBuildTemplate } =
        useOnboarding();

    const handleNext = async (slug: string) => {
        amplitude_logAnalyticsEvent("path_step_2", {
            choice: slug,
            user_id: isAnonymous ? "anon" : user.id,
        });

        nextStudioQuiz("PickSpace");
        setCurrentBuildTemplate(slug);
    };

    const items = useMemo(() => {
        return [
            {
                id: "host-meeetings",
                title: "Host\nMeetings",
                preview: "/images/host-meetings.png",
                next: () => handleNext("meet"),
            },
            {
                id: "hang-out",
                title: "Hang Out",
                preview: "/images/hangout.png",
                next: () => handleNext("hang"),
            },
            {
                id: "showcase-art",
                title: "Showcase Art",
                preview: "/images/showcase-art.png",
                next: () => handleNext("build-gallery"),
            },
        ];
    }, [rooms]);

    const handleLogin = useEventCallback(() => {
        toggleAuth(true);
        setSkipCommitAnonExhibit(true);
    }, []);

    return (
        onboarding?.studio === "PickTemplate" && (
            <QuizModal
                title="What do you want to do in your 3D world?"
                items={items}
                startIndex={1}
                onBack={() => nextStudioQuiz("PickBuildMore")}
            >
                {isAnonymous && (
                    <LoginWrapper>
                        <span>Existing user?</span>
                        <RoundButton
                            className="login-cta"
                            onClick={handleLogin}
                        >
                            Login
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
