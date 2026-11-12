import React, { useMemo, useContext } from "react";
import { getDestination, oldToNew } from "@utils/saveToDb";
import QuizModal from "@features/onboarding/components/QuizModal";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";
import { useRooms } from "@features/spaces/create/components/DestinationSelector/useRooms";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UserContext } from "@components/context/UserContext";

const SPACES = {
    "wolfgang-n2_v2": {
        title: "Wolfgang №2 Dark",
        preview:
            "https://cyber.mypinata.cloud/ipfs/QmQFgHBrjUipxMuVxb4T5Bu5kMmpRPRHwZ4ayZjruUUciw?filename=Wolfgang_2_Dark_by__v64syc.png",
    },
    "white-cube_v2": {
        title: "White Cube",
        preview:
            "https://cyber.mypinata.cloud/ipfs/QmRxHumXpg8RwiTuBArBhSKjHp92ixefwYFYMgnQbhRWHp?filename=whitecube_thumb.png",
    },
    x1: {
        title: "X1 Gallery",
        preview:
            "https://cyber.mypinata.cloud/ipfs/QmdrTjyHj36japoda24jCavm9Qg3kxVFrfW3retQcuNK1o?filename=x1-thumbnail-63c48c9c4e0f07001198d702.jpg",
    },
    oncyberspace_01: {
        title: "Oncyber Studios",
        preview:
            "https://cyber.mypinata.cloud/ipfs/QmPENTv3nhphKiAk8toKBBENYuqVZuZ69ZktPhyupWwsd2?filename=1686573954-oncyberspace_01-thumb.jpg",
    },
    loft: {
        title: "Cyber Loft",
        preview:
            "https://cyber.mypinata.cloud/ipfs/Qmc6YoDSSwxBGGQx1zjQcQJX6wHHCgYxfKjyMjuRPKuGVH?filename=og06_dzcqiz.png",
    },
};

const TEMPLATE_SPACES = {
    "build-gallery": {
        spaces: ["white-cube_v2", "wolfgang-n2_v2", "x1"],
        recommended: "x1",
    },
    meet: {
        spaces: ["x1", "loft", "oncyberspace_01"],
        recommended: "oncyberspace_01",
    },
    hang: {
        spaces: ["x1", "oncyberspace_01", "loft"],
        recommended: "loft",
    },
};

export default function PickBuildMore({ onCreateSpace }) {
    const { rooms, handleCreateSpace } = useRooms();

    const { onboarding, currentBuildTemplate, nextStudioQuiz, nextStudioTuto } =
        useOnboarding();

    const { isAnonymous, user } = useContext(UserContext);

    const handleNext = async (slug: string) => {
        //

        amplitude_logAnalyticsEvent("path_step_3", {
            choice: slug,
            user_id: isAnonymous ? "anon" : user.id,
        });

        slug = oldToNew[slug] || slug;

        let room = rooms.find(
            (it) => it.tag.includes("free") && it.slug === slug
        );

        if (!room) {
            // @ts-ignore
            room = await getDestination(slug);
        }

        if (room) {
            nextStudioQuiz("");

            await handleCreateSpace(room);

            nextStudioTuto("AssetsContent");
        }
    };

    const handleSkip = () => {
        //
        onCreateSpace("");

        amplitude_logAnalyticsEvent("path_step_3", {
            choice: "browser_marketplace",
            user_id: isAnonymous ? "anon" : user.id,
        });
    };

    const items = useMemo(() => {
        const template = TEMPLATE_SPACES[currentBuildTemplate];

        if (!template?.spaces?.length) return [];

        return template.spaces.map((space) => ({
            id: space,
            ...SPACES[space],
            ...(space === template?.recommended && {
                badge: "Recommended",
            }),
            next: () => handleNext(space),
        }));
    }, [rooms, currentBuildTemplate]);

    return (
        onboarding?.studio === "PickSpace" && (
            <QuizModal
                title="Choose a Free Template"
                items={items}
                startIndex={1}
                skip={handleSkip}
                onBack={() => nextStudioQuiz("PickTemplate")}
            />
        )
    );
}
