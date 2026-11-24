import { useContext, useEffect, useState } from "react";
import { UPDATE_USER_DATA, UserContext } from "@components/context/UserContext";
import { rememberTravelAvatar } from "@utils/travelAvatar";
import { worldDocument } from "./worldDocument";
import { visitorUserData, type WorldVisitor } from "./worldVisitor";

/**
 * In a framed world, the visitor is whoever the page around it presents.
 * This waits for the page to say, then gives the world's own account state
 * that name, portrait and avatar, so everything below reads them as it
 * does on the site. True once the world may start.
 *
 * `framed` comes from the server (the page's role), so the first render
 * agrees with it and the world never starts as a guest and restarts.
 */
export function useWorldVisitor(framed: boolean): boolean {
    const { dispatch, userData, isAnonInitialized } = useContext(UserContext);
    const [visitor, setVisitor] = useState<WorldVisitor | null | undefined>(
        framed ? undefined : null
    );

    useEffect(() => {
        if (!framed) return;
        let cancelled = false;
        const said = worldDocument()?.visitor() ?? Promise.resolve(null);
        void said.then((next) => {
            if (cancelled) return;
            // The avatar a visitor arrives with, where the world looks for
            // one (utils/travelAvatar): a guest's lobby pick counts too.
            if (next) rememberTravelAvatar(visitorUserData(next), next.avatar);
            setVisitor(next);
        });
        return () => {
            cancelled = true;
        };
    }, [framed]);

    const data = visitorUserData(visitor ?? null);
    const applied =
        !data ||
        (userData?.username === data.username &&
            userData?.avatar === data.avatar);

    // After the account state has settled for this route, and again if a
    // later route settles it back to the signed-out visitor.
    useEffect(() => {
        if (data && !applied && isAnonInitialized)
            dispatch({ type: UPDATE_USER_DATA, payload: data });
    }, [data?.username, data?.avatar, applied, isAnonInitialized]);

    return visitor !== undefined && applied;
}
