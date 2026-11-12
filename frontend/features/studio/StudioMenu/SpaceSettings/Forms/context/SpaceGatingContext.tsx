import { UserContext } from "@components/context/UserContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSnackbar } from "@components/Snackbar";
import { DEFAULT_SNACKBAR_DURATION } from "@components/Snackbar/useSnackbar";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { Experience } from "@uitypes/experience";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { disableExhibitGating, updateExhibitGating } from "@utils/saveToDb";
import React, { useMemo } from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { GatingType } from "../types";
import {
    isGatingRule,
    isGatingRuleEnabled,
    isSpaceGatingEnabled,
} from "../utils";

type GatingData = Partial<Experience["gating"]>;

export type GatingSaveState =
    | { type: "Idle" }
    | { type: "Saving" }
    | { type: "Success" }
    | { type: "Error"; error: string };

export type EditGatingType = "save" | "undo";

interface SpaceGatingContextState {
    gating: GatingData;
    editGating: (g: GatingData, type: EditGatingType) => Promise<void>;
    disableGating: () => Promise<void>;
    saveState: GatingSaveState;
}

const SpaceGatingContext = React.createContext<SpaceGatingContextState>(null);

export function SpaceGatingProvider({ children }) {
    //
    const { exhibit, exhibitStore, baseAnalyticsEvent } = useCurrentExhibit();

    const [gating, setGating] = useState<GatingData>(exhibit.gating || {});

    const [saveState, setSaveState] = useState<GatingSaveState>({
        type: "Idle",
    });

    const disableGating = useEventCallback(async () => {
        //
        amplitude_logAnalyticsEvent("disable_space_gating", baseAnalyticsEvent);

        exhibitStore.updateExhibitGating(null);

        setGating({});
    }, []);

    const editGating = useEventCallback(
        async (data: GatingData, type: EditGatingType) => {
            //
            exhibitStore.updateExhibitGating(data);

            setGating((state) => {
                //
                let newState = { ...state, ...data };

                if (data.whitelist || data.nftOwnership) {
                    //
                    // newState.noAnonymous = true;
                }

                return newState;
            });

            if (!isSpaceGatingEnabled(exhibit.gating)) {
                amplitude_logAnalyticsEvent(
                    "enable_space_gating",
                    baseAnalyticsEvent
                );
            }

            for (const key in data) {
                if (isGatingRule(key)) {
                    const wasRuleEnabled = isGatingRuleEnabled(
                        key,
                        exhibit.gating
                    );

                    const isRuleEnabled = isGatingRuleEnabled(key, data);

                    if (isRuleEnabled && !wasRuleEnabled) {
                        //
                        amplitude_logAnalyticsEvent(
                            "enable_space_gating_rule",
                            {
                                ...baseAnalyticsEvent,
                                rule: key,
                                action: type,
                            }
                        );
                        //
                    } else if (!isRuleEnabled && wasRuleEnabled) {
                        //
                        amplitude_logAnalyticsEvent(
                            "disable_space_gating_rule",
                            {
                                ...baseAnalyticsEvent,
                                rule: key,
                                action: type,
                            }
                        );
                    }
                }
            }
        },
        []
    );

    const state = useMemo(() => {
        return {
            gating,
            editGating,
            disableGating,
            saveState,
        };
    }, [gating, editGating, disableGating, saveState]);

    return (
        <SpaceGatingContext.Provider value={state}>
            {children}
        </SpaceGatingContext.Provider>
    );
}

export function useSpaceGatingEditor() {
    return useContext(SpaceGatingContext);
}
