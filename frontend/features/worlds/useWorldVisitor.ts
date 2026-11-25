import { useContext, useEffect, useState } from "react";
import { USER_LOGIN, UserContext } from "@components/context/UserContext";
import { rememberTravelAvatar } from "@utils/travelAvatar";
import { PAGE_SESSION } from "./accountRelay";
import { relayWorldAccount } from "./worldAccount";
import { worldDocument } from "./worldDocument";
import { visitorUserData, type WorldVisitor } from "./worldVisitor";

/**
 * In a framed world, the visitor is whoever the page around it presents.
 * This waits for the page to say, then gives the world's own account state
 * that visitor (name, portrait, avatar and, signed in, who they are and
 * their settings), so everything below reads them as it does on the site.
 * What needs the session is asked of the page (./accountRelay): the world
 * holds a stand-in where the token would be, never the token.
 *
 * `framed` comes from the server (the page's role), so the first render
 * agrees with it and the world never starts as a guest and restarts.
 */
export function useWorldVisitor(framed: boolean): {
    /** True once the world may start. */
    ready: boolean;
    /** Whether the visitor is let in, as the page worked it out. */
    gate?: { type: string };
} {
    const { dispatch, userData, user, isAnonInitialized } =
        useContext(UserContext);
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
            relayWorldAccount(!!next?.account);
            setVisitor(next);
        });
        return () => {
            cancelled = true;
        };
    }, [framed]);

    const data = visitorUserData(visitor ?? null);
    const id = visitor?.account?.id ?? "";
    const applied =
        !data ||
        (userData?.username === data.username &&
            userData?.avatar === data.avatar &&
            (user?.id ?? "") === id);

    // After the account state has settled for this route, and again if a
    // later route settles it back to the signed-out visitor.
    useEffect(() => {
        if (!data || applied || !isAnonInitialized) return;
        dispatch({
            type: USER_LOGIN,
            payload: {
                userData: data,
                ...(id
                    ? {
                          authenticated: true,
                          user: { id },
                          currentAccount: id,
                          token: PAGE_SESSION,
                      }
                    : {}),
            },
        });
    }, [data?.username, data?.avatar, id, applied, isAnonInitialized]);

    return {
        ready: visitor !== undefined && applied,
        gate: visitor?.gate,
    };
}
