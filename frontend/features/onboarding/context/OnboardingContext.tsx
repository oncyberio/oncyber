import React, { createContext, useContext, useState } from "react";

type QuizTypes =
    | "PickBuildMore"
    | "PickTemplate"
    | "PickSpace"
    | "PickKit"
    | "";

type TutoTypes =
    | "Composer"
    | "Settings"
    | "AssetsContent"
    | "AddedComponents"
    | "Preview"
    | "";

export type StudioTypes = QuizTypes | TutoTypes;

type OnboardingType = {
    studio?: StudioTypes;
};

type OnboardingContextState = {
    currentBuildTemplate: string;
    showToolbar: boolean;
    onboarding: OnboardingType;
    nextStudioTuto: (value: TutoTypes) => void;
    nextStudioQuiz: (value: QuizTypes) => void;
    setCurrentBuildTemplate: React.Dispatch<React.SetStateAction<string>>;
    setShowToolbar: React.Dispatch<React.SetStateAction<boolean>>;
};

export const OnboardingContext = createContext<OnboardingContextState>(null);

export const OnboardingProvider = ({ children }): React.ReactElement => {
    const [showToolbar, setShowToolbar] = useState(true);

    const [currentBuildTemplate, setCurrentBuildTemplate] = useState("");

    const [onboarding, setOnboarding] = useState<OnboardingType>({
        studio: "",
    });

    const nextOnboarding = (key: string, value: StudioTypes) => {
        const payload = {
            ...onboarding,
            [key]: value,
        };
        setOnboarding(payload);
    };

    const nextStudioQuiz = (value: QuizTypes) =>
        nextOnboarding("studio", value);

    const nextStudioTuto = (value: TutoTypes) => {
        //
        try {
            if (value === "AssetsContent") {
                const hasStudioTuto = JSON.parse(
                    localStorage.getItem("hasStudioTuto")
                );

                if (hasStudioTuto) {
                    return nextOnboarding("studio", "");
                } else {
                    localStorage.setItem("hasStudioTuto", JSON.stringify(true));
                }
            }
        } catch (err) {
            console.error(err);
        }

        nextOnboarding("studio", value);
    };

    return (
        <OnboardingContext.Provider
            value={{
                onboarding,
                showToolbar,
                nextStudioQuiz,
                setShowToolbar,
                nextStudioTuto,
                currentBuildTemplate,
                setCurrentBuildTemplate,
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
};

export const useOnboarding = () => {
    const context = useContext(OnboardingContext);

    if (!context) {
        throw Error(
            "useOnboarding needs to be called within OnboardingContext."
        );
    }

    return context;
};

export default OnboardingProvider;
