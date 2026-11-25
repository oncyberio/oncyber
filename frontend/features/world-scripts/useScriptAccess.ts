/**
 * Whether the signed-in account may change this space's scripts and ask the
 * model, read once into the store. Asked where the session is.
 */
import { useContext, useEffect } from "react";
import { UserContext } from "@components/context/UserContext";
import WorldScriptsApi from "@api/worldScripts/_api";
import { setWorldScripts } from "./store";

export function useScriptAccess(experienceId: string) {
    const { user, isAnonymous } = useContext(UserContext);
    useEffect(() => {
        if (!experienceId || !user?.id || isAnonymous) return;
        let cancelled = false;
        WorldScriptsApi.access({ experienceId })
            .then((access: any) => {
                if (cancelled) return;
                setWorldScripts({
                    canEdit: !!access?.canEdit,
                    canAsk: !!access?.allowed,
                    earlyAccess: !!access?.earlyAccess,
                    askReason: access?.reason || "",
                    remaining: access?.remaining ?? null,
                });
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [user?.id, isAnonymous, experienceId]);
}
