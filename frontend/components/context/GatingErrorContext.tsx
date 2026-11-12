import { checkGating } from "@dapp/checkGating";
import { Experience } from "@uitypes/experience";
import { GatingCheckResult, GatingErrorType } from "@utils/checkGatingRules";
import { getJSON, noop, serialize } from "@utils/js";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { UserContext } from "./UserContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { IS_MULTIPLAYER_ENABLED } from "@components/_3DExhibit-v2/three/shellconstants";
import { soloDefaultSpaces } from "@components/_3DExhibit-v2/utils/constants";

interface GatingState {
    userId: string;
    spaceId: string;
    isChecking: boolean;
    gatingResult?: GatingCheckResult;
}

interface GatingErrorContextState {
    unlockPassword: (pwd: string) => Promise<GatingErrorType>;
    gatingError?: GatingErrorType;
    isChecking: boolean;
    callbackAfterSuccess: React.MutableRefObject<(mode: string) => void>;
}

interface GatingErrorContextProps {
    gatingResult?: GatingCheckResult;
    exhibit?: Experience;
    children: React.ReactNode;
}

const GatingErrorContext = React.createContext<GatingErrorContextState>({
    unlockPassword: null,
    gatingError: null,
    isChecking: false,
    callbackAfterSuccess: null,
});

function getGatingError(gatingResult) {
    //
    return gatingResult == null || gatingResult.type === "success"
        ? null
        : gatingResult.type;
}

export function GatingErrorProvider(props: GatingErrorContextProps) {
    //
    const { user, userData } = useContext(UserContext);

    // temporary hack to change mode: inited in DisplayScene
    const callbackAfterSuccess = useRef(noop);

    const [gatingState, setGatingState] = useState<GatingState>({
        userId: user?.id,
        spaceId: props.exhibit?.id,
        isChecking: false,
        gatingResult: props.gatingResult,
    });

    const unlockPassword = useEventCallback(async (password: string) => {
        //
        const gatingResult = await updateGatingState(password);

        return getGatingError(gatingResult);
        //
    }, []);

    async function updateGatingState(password?: string) {
        //
        let experience = props.exhibit;

        if (
            gatingState.userId !== user.id ||
            gatingState.spaceId !== experience?.id ||
            password !== null
        ) {
            let uid = ++effId.current;

            setGatingState((s) => ({
                ...s,
                userId: user?.id,
                spaceId: experience?.id,
                isChecking: true,
            }));

            if (uid !== effId.current) {
                return gatingState.gatingResult;
            }

            //
            const gatingResult = await checkGating(
                props.exhibit,
                userData,
                password
            );

            if (
                gatingResult.type === "success" &&
                IS_MULTIPLAYER_ENABLED(props.exhibit)
            ) {
                if (!soloDefaultSpaces.includes(props.exhibit.info.room)) {
                    callbackAfterSuccess.current("multiplayer");
                }
                // changeMode("multiplayer");
            }

            setGatingState((s) => {
                return {
                    ...s,
                    isChecking: false,
                    gatingResult,
                };
            });

            return gatingResult;
        } else {
            return gatingState.gatingResult;
        }
    }

    const effId = useRef(0);

    useEffect(() => {
        //

        updateGatingState();
        //
    }, [user.id, props.exhibit]);

    const value = useMemo(() => {
        //
        return {
            gatingError: getGatingError(gatingState.gatingResult),
            isChecking: gatingState.isChecking,
            unlockPassword,
            callbackAfterSuccess,
        };
    }, [gatingState.gatingResult]);

    return (
        <GatingErrorContext.Provider value={value}>
            {props.children}
        </GatingErrorContext.Provider>
    );
}

export function useGatingError() {
    return useContext(GatingErrorContext);
}
