import React, { useMemo } from "react";
import { useScreenSize } from "@components/hooks/useScreenSize";
import TutoModal from "@features/onboarding/components/TutoModal";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";

const items = {
    title: "Customize your World",
    description: "Add Images, Videos, Websites & more.",
    href: "https://docs.oncyber.io/world-builders-guide/getting-started/adding-assets",
};

export default function AssetsContent() {
    const { onboarding, nextStudioTuto } = useOnboarding();

    const screenSize = useScreenSize();

    const isMobile = screenSize.width <= 600;

    const variants = useMemo(() => {
        return !isMobile
            ? {
                  visible: { x: 0, opacity: 1 },
                  hidden: { x: "-100vh", opacity: 0 },
              }
            : {
                  visible: { y: "0vh", opacity: 1 },
                  hidden: { y: "100vh", opacity: 0 },
              };
    }, [isMobile]);

    return (
        onboarding?.studio === "AssetsContent" && (
            <TutoModal
                items={items}
                exit="hidden"
                initial="hidden"
                animate="visible"
                variants={variants}
                className="assets-content"
                transition={{ duration: 1 }}
                onNext={() => nextStudioTuto("Preview")}
                arrowPosition={isMobile ? "bottom" : "left"}
            />
        )
    );
}
