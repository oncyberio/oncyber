import React from "react";
import { motion } from "framer-motion";
import TutoModal from "@features/onboarding/components/TutoModal";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";

const items = [
    {
        img: "/images/build-more-cover.png",
        title: "GPT-powered prompt to world building",
        description:
            "Place all your assets, change base world traits by interacting with the input below.",
    },
];

export default function Composer() {
    const { onboarding, nextStudioTuto } = useOnboarding();

    return (
        onboarding?.studio !== "Composer" && (
            <TutoModal
                items={items}
                pagination={false}
                animate={{ y: 0 }}
                exit={{ y: "-100vh" }}
                initial={{ y: "100vh" }}
                transition={{ duration: 1 }}
                style={{
                    width: "100%",
                    bottom: "60px",
                    borderRadius: "6.70383px",
                }}
                onNext={() => nextStudioTuto("")}
            />
        )
    );
}
