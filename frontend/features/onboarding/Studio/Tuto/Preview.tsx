import React from "react";
import TutoModal from "@features/onboarding/components/TutoModal";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";

const variations = {
    animate: {
        y: 0,
    },
    exit: {
        y: "100vh",
    },
    initial: {
        y: "-100vh",
    },
};

const items = {
    title: "View your World",
    description: "See your world live and experience with others.",
};

export default function Preview() {
    const { onboarding, nextStudioTuto } = useOnboarding();

    return (
        onboarding?.studio === "Preview" && (
            <TutoModal
                items={items}
                exit="exit"
                initial="initial"
                animate="animate"
                variants={variations}
                arrowPosition="top"
                className="preview-tuto"
                transition={{ duration: 1 }}
                onNext={() => nextStudioTuto("")}
            />
        )
    );
}
