import { useSafeContext } from "@components/hooks/useSafeContext";
import { createContext, useContext, useRef, useEffect, useState } from "react";

const ActionsContext = createContext(null);

/**
 * Why the last Save in World settings did not go through. It is shown beside
 * the Save button; `retry` is set when saving again unchanged can help
 * (docs/feedback.md).
 */
export interface SaveFailure {
    message: string;
    retry?: () => void;
}

type SaveFailureState = [SaveFailure, (failure: SaveFailure) => void];

const noSaveFailure: SaveFailureState = [null, () => {}];

const SaveFailureContext = createContext<SaveFailureState>(noSaveFailure);

export function ActionsProvider({ children }) {
    //
    const actions = useRef(null);

    const value = actions;

    const saveFailure = useState<SaveFailure>(null);

    return (
        <ActionsContext.Provider value={value}>
            <SaveFailureContext.Provider value={saveFailure}>
                {children}
            </SaveFailureContext.Provider>
        </ActionsContext.Provider>
    );
}

/** `[failure, setFailure]`; pass `null` to clear it. */
export function useSaveFailure() {
    return useContext(SaveFailureContext);
}

export function useFormHandler(onSave, onCancel) {
    //
    const actionsRef = useSafeContext(ActionsContext);

    useEffect(() => {
        //
        actionsRef.current = {
            onSave,
            onCancel,
        };

        return () => {
            actionsRef.current = null;
        };
    }, []);
}

export function useFormActions() {
    //
    return useSafeContext(ActionsContext);
}
