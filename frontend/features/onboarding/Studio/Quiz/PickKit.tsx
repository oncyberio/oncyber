import React, { useContext, useMemo } from "react";
import { UserContext } from "@components/context/UserContext";
import { createEmptySpace } from "@features/spaces/create/utils";
import QuizModal from "@features/onboarding/components/QuizModal";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";
import { useStudioMenu } from "@features/studio/StudioMenu/context/StudioContext";
import { useUserKits } from "@features/studio/EditWorldMenu/hooks/useUserKits";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

export default function PickBuildMore({ onCreateSpace }) {
    const { token, user, isAnonymous } = useContext(UserContext);

    const { onboarding, nextStudioTuto, nextStudioQuiz } = useOnboarding();

    const { changeExhibit } = useStudioMenu();

    const { kits } = useUserKits();

    const handleBuildKit = async (kit) => {
        amplitude_logAnalyticsEvent("path_step_3", {
            choice: kit,
            user_id: isAnonymous ? "anon" : user.id,
        });

        //
        const next = await createEmptySpace(user.id, token, kit);

        amplitude_logAnalyticsEvent("create_gallery", {
            room: kit,
            user_id: isAnonymous ? "anon" : user.id,
            source: "onboarding",
        });

        // @ts-ignore
        await changeExhibit(next, isAnonymous);

        nextStudioTuto("AssetsContent");
    };

    const items = useMemo(() => {
        return kits?.slice(0, 3)?.map((kit) => ({
            id: kit?._id,
            title: kit?.name,
            preview: kit?.thumbnail,
            subTitle: kit?.nbElements ? `${kit.nbElements} Elements` : null,
            next: () => handleBuildKit(kit?.slug),
        }));
    }, [kits]);

    const handleSkip = () => {
        //
        onCreateSpace("", true);

        amplitude_logAnalyticsEvent("path_step_3", {
            choice: "browser_marketplace",
            user_id: isAnonymous ? "anon" : user.id,
        });
    };

    return (
        onboarding?.studio === "PickKit" && (
            <QuizModal
                items={items}
                type="buildMore"
                onBack={() => {
                    nextStudioQuiz("PickBuildMore");
                }}
                title="Which Building Blocks do you want to use?"
                startIndex={Math.floor(items.length / 2)}
                skipTitle="View More Kits"
                skip={handleSkip}
            />
        )
    );
}
