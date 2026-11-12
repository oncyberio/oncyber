import React, { createContext, useContext, useRef, useState } from "react";
import { useRouter } from "next/router";
import { APP_STATES } from "@components/_3DExhibit-v2/three/constants";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { UserContext } from "@components/context/UserContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSafeContext } from "@components/hooks/useSafeContext";
import { Experience } from "@uitypes/experience";
import { getExhibitById } from "@utils/csr";
import { getCinematic, getDestination, updateUser } from "@utils/saveToDb";
import { useCurrentExhibit } from "./ExhibitContext";
import {
    IDLE_SPACE_SWITCH,
    SpaceSwitchEvent,
    SpaceSwitchState,
    spaceSwitchBackTarget,
    spaceSwitchTransition,
} from "./spaceSwitchMachine";

export interface SpaceSwitchContextState {
    state: SpaceSwitchState;
    /**
     * Opens another space in the studio. Resolves to whether it opened and
     * never rejects: a failure is kept in `state` and shown by
     * `SpaceSwitchNotice`. A call made while a switch is running is ignored.
     */
    switchTo: (target: Experience, isAnon?: boolean) => Promise<boolean>;
    /** Runs the switch that failed again. */
    retry: () => Promise<boolean>;
    /** Reopens the space the failed switch left. */
    goBack: () => Promise<boolean>;
}

const SpaceSwitchContext = createContext<SpaceSwitchContextState>(null);

/**
 * Owns the switch from one space to another inside the studio.
 *
 * It sits above the studio's menus on purpose: the engine reports "no space"
 * as soon as it leaves the old one, which unmounts the toolbar that started
 * the switch. Whatever has to survive until the new space is open, or be
 * shown when it does not open, lives here. The states and their legal moves
 * are in `spaceSwitchMachine.ts`.
 */
export function SpaceSwitchProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    //
    const world = useWorld();

    const router = useRouter();

    const { token, user } = useContext(UserContext);

    const { exhibit, setExhibit, setDestination } = useCurrentExhibit();

    const [state, setState] = useState<SpaceSwitchState>(IDLE_SPACE_SWITCH);

    // The callbacks below outlive the render that created them.
    const current = useRef(state);

    function apply(event: SpaceSwitchEvent) {
        //
        const next = spaceSwitchTransition(current.current, event);

        if (next === current.current) return false;

        current.current = next;

        setState(next);

        return true;
    }

    async function openSpace(next: Experience, isAnon: boolean) {
        //
        await world.current.setState(APP_STATES.EXIT, {});

        await world.current.setState(APP_STATES.INTRO, {});

        const [fetched, destination, cinematicResp] = await Promise.all([
            isAnon ? null : getExhibitById(next.id),
            getDestination(next.info.room),
            getCinematic(next.id, next.info.room),
        ]);

        next = isAnon ? next : fetched;

        // Both requests answer with nothing when they fail. Stop before the
        // exhibit context is pointed at a space that cannot be shown.
        if (!next || !destination) {
            throw new Error("The space or its destination did not load");
        }

        setExhibit(next);

        setDestination(destination);

        const wExhibit = structuredClone(next);

        const wDestination = structuredClone(destination);

        const space = await world.current.loadSpace({
            roomParameters: wDestination,
            exhibit: wExhibit,
        });

        await world.current.setState(APP_STATES.SPACE, {
            roomParameters: wDestination,
            exhibit: wExhibit,
            space,
            cinematic: cinematicResp?.success ? cinematicResp.cinematic : null,
        });
    }

    const switchTo = useEventCallback(
        async (target: Experience, isAnon = false) => {
            //
            if (!apply({ type: "start", target, isAnon, from: exhibit })) {
                return false;
            }

            try {
                await openSpace(target, isAnon);

                apply({ type: "succeed" });

                return true;
            } catch (err) {
                console.error(err);

                apply({ type: "fail" });

                return false;
            }
        },
        []
    );

    const retry = useEventCallback(async () => {
        //
        const failed = current.current;

        if (failed.status !== "failed") return false;

        return switchTo(failed.target, failed.isAnon);
    }, []);

    const goBack = useEventCallback(async () => {
        //
        const back = spaceSwitchBackTarget(current.current);

        if (!back) return false;

        const opened = await switchTo(back, false);

        // /studio opens the account's current space, and the space menu had
        // already pointed that at the space that failed. Point it back once
        // the visitor is really there, so a reload opens what they see.
        if (opened && router.pathname === "/studio" && user?.id) {
            try {
                const result = await updateUser(
                    token,
                    { currentExhibitId: back.id },
                    user.id
                );

                if (!result?.success) throw new Error(result?.message);
            } catch (err) {
                console.error("Failed to restore the current space", err);
            }
        }

        return opened;
    }, []);

    const value: SpaceSwitchContextState = { state, switchTo, retry, goBack };

    return (
        <SpaceSwitchContext.Provider value={value}>
            {children}
        </SpaceSwitchContext.Provider>
    );
}

export function useSpaceSwitch() {
    //
    return useSafeContext(SpaceSwitchContext);
}
