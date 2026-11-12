import React from "react";
import PickKit from "@features/onboarding/Studio/Quiz/PickKit";
import PickSpace from "@features/onboarding/Studio/Quiz/PickSpace";
import PickBuildMore from "@features/onboarding/Studio/Quiz/PickBuildMore";
import PickBuildTemplate from "@features/onboarding/Studio/Quiz/BuildTemplate";

export default function Quiz({ handleCreateSpace, setSkipCommitAnonExhibit }) {
    return (
        <>
            <PickSpace onCreateSpace={handleCreateSpace} />

            <PickBuildMore
                setSkipCommitAnonExhibit={setSkipCommitAnonExhibit}
            />

            <PickBuildTemplate
                setSkipCommitAnonExhibit={setSkipCommitAnonExhibit} />

            <PickKit onCreateSpace={handleCreateSpace} />
        </>
    );
}
