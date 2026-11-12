import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSafeContext } from "@components/hooks/useSafeContext";
import { useSnackbar } from "@components/Snackbar";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { APP_STATES, CANVAS, IS_MAP_VIEW } from "@3constants";
import { Experience } from "@uitypes/experience";
import { RoomParameters } from "@uitypes/roomParameters";
import React, { useCallback, useState } from "react";
import { useCinematic } from "./CinematicContext";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { useSpaceSwitch } from "@features/studio/context/SpaceSwitchContext";
import { ExhibitRole } from "@uitypes/user";
import useModal from "@components/modals/useModal";

export interface StudioMenuProps {
    destination: RoomParameters;
    children: React.ReactNode;
}

type WorldMode = "edit" | "display" | "cinematic";

function modeTitle(mode: WorldMode) {
    return mode[0].toUpperCase() + mode.slice(1);
}

type WorldTransition = {
    enter: () => Promise<void>;
    exit: () => Promise<void>;
};

export type WorldModeStatus = "inactive" | "active" | "switching";

export interface StudioMenuState {
    exhibit: Experience;
    userRole: ExhibitRole;
    /** True while a switch to another space is running. */
    switchingExhibit: boolean;
    destination: RoomParameters;
    worldMode: WorldMode;
    isAuthShowing: boolean;
    isAnonLimit: boolean;
    toggleAuth: (b?: boolean, isAnonLimit?: boolean) => void;
    setWorldMode: (mode: WorldMode) => Promise<void>;
    getModeStatus: (mode: WorldMode) => WorldModeStatus;
    baseAnalyticsEvent: object;
    /**
     * Opens another space. Resolves to whether it opened and never rejects;
     * a failure is shown over the intro by `SpaceSwitchNotice`.
     */
    changeExhibit: (
        exhibit: Experience,
        isAnonymous?: boolean
    ) => Promise<boolean>;
}

const StudioMenuContext = React.createContext<StudioMenuState>(null);

export function StudioMenuProvider({ children, destination }: StudioMenuProps) {
    //
    const world = useWorld();

    const { exhibit, userRole, baseAnalyticsEvent } = useCurrentExhibit();

    // The switch itself lives above the studio menus, which unmount as soon
    // as the engine leaves the old space. See SpaceSwitchContext.
    const { state: spaceSwitch, switchTo: changeExhibit } = useSpaceSwitch();

    const [authState, setAuthState] = useState({
        isAuthShowing: false,
        isAnonLimit: false,
    });

    const toggleAuth = useEventCallback((b?: boolean, isAnonLimit = false) => {
        //
        setAuthState({
            isAuthShowing: b ?? !authState.isAuthShowing,
            isAnonLimit,
        });
    }, []);

    const [worldMode, _setWorldMode] = useState<WorldMode>("edit");

    const switchingExhibit = spaceSwitch.status === "switching";

    const [switchingTo, setSwitchingTo] = useState(null);

    const { enterCinematic, exitCinematic } = useCinematic();

    const [openSnackbar, closeSnackbar] = useSnackbar({
        position: "top-right",
    });

    const enterDisplay = useEventCallback(async () => {
        //
        await world.current.setState(APP_STATES.SPACE, {
            switch: "display",
        });

        CANVAS.focus();
        CANVAS.requestPointerLock();
    }, []);

    const exitDisplay = useEventCallback(async () => {
        //
    }, []);

    const enterEdit = useEventCallback(async () => {
        //
        await world.current.setState(APP_STATES.SPACE, {
            switch: "edit",
        });
    }, []);

    const exitEdit = useEventCallback(async () => {
        //
    }, []);

    const states: Record<WorldMode, WorldTransition> = {
        cinematic: {
            enter: enterCinematic,
            exit: exitCinematic,
        },
        display: {
            enter: enterDisplay,
            exit: exitDisplay,
        },
        edit: {
            enter: enterEdit,
            exit: exitEdit,
        },
    } as const;

    const setWorldMode = useEventCallback(async (nextMode: WorldMode) => {
        //
        if (switchingTo || nextMode === worldMode) return;

        const title = modeTitle(nextMode);

        try {
            //
            setSwitchingTo(nextMode);

            await states[worldMode].exit();

            await states[nextMode].enter();

            _setWorldMode(nextMode);

            // openSnackbar(`${title} mode activated`, 3000, null, "info");
            //
        } catch (err) {
            //
            console.error(err);

            openSnackbar(
                `Failed to activate ${title} mode`,
                3000,
                null,
                "error"
            );
            //
        } finally {
            setSwitchingTo(null);
        }
        //
    }, []);

    const getModeStatus = useCallback(
        (mode: WorldMode): WorldModeStatus => {
            //
            if (switchingTo === mode) return "switching";

            if (mode === worldMode) return "active";

            return "inactive";
        },
        [switchingTo, worldMode]
    );

    const value: StudioMenuState = {
        exhibit,
        userRole,
        destination,
        worldMode,
        isAuthShowing: authState.isAuthShowing,
        isAnonLimit: authState.isAnonLimit,
        switchingExhibit,
        setWorldMode,
        getModeStatus,
        toggleAuth,
        baseAnalyticsEvent,
        changeExhibit,
    };

    return (
        <StudioMenuContext.Provider value={value}>
            {children}
        </StudioMenuContext.Provider>
    );
}

export function useStudioMenu() {
    //
    return useSafeContext(StudioMenuContext);
}
