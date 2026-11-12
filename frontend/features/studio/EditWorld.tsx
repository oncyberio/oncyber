import { useRouter } from "next/router";
import { StudioSceneFrame as SceneFrame } from "./components/StudioSceneFrame";
import { useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { useWorldState } from "@components/_3DExhibit-v2/hooks/useWorldState";
import {
    APP_STATES,
    IS_MOBILE,
} from "@components/_3DExhibit-v2/three/constants";
import { useCurrentExhibit } from "./context/ExhibitContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UserContext } from "@components/context/UserContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import OrientationAlert from "./components/OrientationAlert";
import { SpaceSwitchNotice } from "./components/SpaceSwitchNotice";
import { StudioTheme } from "./styles/StudioTheme";

import { loadStudioScene, loadStudioTools, loadStudioMenu } from "./loadStudio";

const EditModeSceneV2 = dynamic(loadStudioScene, { ssr: false });
const EditWorldMenu = dynamic(loadStudioTools, { ssr: false });
const StudioMenu = dynamic(loadStudioMenu, { ssr: false });

const ErrorScreen = dynamic(() => import("@components/Error"));

// A null role means the exhibit SSR handed us doesn't list us in `editors`.
// That is usually a race the server resolves on the next request (we were just
// invited, or just kicked), so one route-data refresh is worth trying — but it must be
// bounded: when the server keeps returning the same answer an unconditional
// refresh never converges, which is how a stale exhibit-view cache turned collab
// invite links into an endless tunnel/reload loop.
const roleRetryKey = (exhibitId: string) => `studio:role-retry:${exhibitId}`;

function readRoleRetry(exhibitId: string) {
    try {
        return sessionStorage.getItem(roleRetryKey(exhibitId)) != null;
    } catch (err) {
        // Storage can be unavailable (private mode, blocked cookies). Without
        // it we can't bound the retry, so don't refresh at all.
        return true;
    }
}

function writeRoleRetry(exhibitId: string) {
    try {
        sessionStorage.setItem(roleRetryKey(exhibitId), "1");
        return true;
    } catch (err) {
        return false;
    }
}

function clearRoleRetry(exhibitId: string) {
    try {
        sessionStorage.removeItem(roleRetryKey(exhibitId));
    } catch (err) {
        // ignore
    }
}

export function EditWorld({ exhibit, destination }) {
    const router = useRouter();
    //
    const { user } = useContext(UserContext);

    const worldState = useWorldState();

    const world = useWorld();

    const hasWorld = world.current != null;

    const {
        userRole,
        baseAnalyticsEvent,
        exhibit: currentExhibit,
    } = useCurrentExhibit();

    const exhibitId = currentExhibit?.id;

    const [noAccess, setNoAccess] = useState(false);
    const currentRole = useRef(userRole);
    currentRole.current = userRole;

    useEffect(() => {
        //
        if (userRole != null) {
            //
            clearRoleRetry(exhibitId);

            setNoAccess(false);

            return;
        }

        if (readRoleRetry(exhibitId) || !writeRoleRetry(exhibitId)) {
            // Already retried once for this space (or we can't remember that we
            // did) — show the user why they're stuck instead of reloading again.
            setNoAccess(true);

            return;
        }

        void router.replace(router.asPath).then((completed) => {
            if (!completed || currentRole.current == null) setNoAccess(true);
        }).catch(() => setNoAccess(true));
        //
    }, [userRole, exhibitId]);

    const canShowEditMenu =
        worldState.hasSpace &&
        worldState.state === APP_STATES.SPACE &&
        worldState.mode === "edit";

    const canShowStudioMenu = worldState.hasSpace;

    useEffect(() => {
        // console.log("worldState", worldState);

        if (worldState.hasSpace) {
            //
            amplitude_logAnalyticsEvent(
                "start_edit_exhibit",
                baseAnalyticsEvent
            );
        }
    }, [worldState]);

    //

    if (noAccess) {
        return (
            <ErrorScreen
                statusCode={403}
                forbidError="You don't have edit access to this space."
            />
        );
    }

    return (
        <>
            {hasWorld && canShowEditMenu && (
                <div style={{ display: canShowEditMenu ? "block" : "none" }}>
                    <EditWorldMenu key={"edit-menu"} />
                </div>
            )}

            {hasWorld && canShowStudioMenu && (
                <div style={{ display: canShowStudioMenu ? "block" : "none" }}>
                    <StudioMenu key={"studio-menu"} />
                </div>
            )}

            <SceneFrame>
                <EditModeSceneV2 exhibit={exhibit} destination={destination} />
            </SceneFrame>

            <SpaceSwitchNotice />

            {IS_MOBILE && hasWorld && canShowStudioMenu && <OrientationAlert />}
            <StudioTheme />
        </>
    );
}
