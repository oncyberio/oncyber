/**
 * Whether the signed-in account may change this space's scripts and ask the
 * model, read into the store. Asked where the session is, and only for a
 * visitor it could be yes for (./access.ts): the space's owner or one of
 * its editors, or someone whose address asks (`?scripts=1`, for a site
 * admin).
 */
import { useContext, useEffect } from "react";
import { UserContext } from "@components/context/UserContext";
import WorldScriptsApi from "@api/worldScripts/_api";
import { askAccess, shouldAskAccess, type AccessSpace } from "./access";
import { setWorldScripts } from "./store";

export function useScriptAccess(space: AccessSpace | null) {
    const { user, isAnonymous } = useContext(UserContext);
    const userId = isAnonymous ? "" : user?.id || "";
    const spaceId = space?.id || "";
    const ask = shouldAskAccess(
        space,
        userId,
        typeof window === "undefined" ? "" : window.location.search
    );
    useEffect(() => {
        if (!ask) return;
        let cancelled = false;
        void askAccess(spaceId, userId, (input) =>
            WorldScriptsApi.access(input)
        ).then((access) => {
            if (!cancelled && access) setWorldScripts(access);
        });
        return () => {
            cancelled = true;
        };
    }, [userId, spaceId, ask]);
}
