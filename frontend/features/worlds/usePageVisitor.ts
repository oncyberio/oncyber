import { useContext, useEffect, useState } from "react";
import { UserContext } from "@components/context/UserContext";
import { presentAccount } from "@features/frame/accountIdentity";
import { guestId } from "@utils/guestIdentity";
import { worldAccount, worldVisitorMessage } from "./worldVisitor";

/**
 * The visitor as the page presents them to a world: null until the account
 * and its avatar have been read. The same object until one of them changes.
 */
export function usePageVisitor(gate?: { type: string }) {
    const { userData, user, isSignedIn } = useContext(UserContext);
    const [visitor, setVisitor] = useState<{
        key: string;
        message: object;
    } | null>(null);
    const account = isSignedIn ? userData : null;
    useEffect(() => {
        let cancelled = false;
        void presentAccount(account).then((presentation) => {
            if (cancelled) return;
            const message = worldVisitorMessage(
                !!account,
                presentation,
                account?.settings?.default_vrm_scale,
                {
                    account: worldAccount(user?.id, account),
                    gate,
                    guestId: guestId(),
                }
            );
            const key = JSON.stringify(message);
            setVisitor((current) =>
                current?.key === key ? current : { key, message }
            );
        });
        return () => {
            cancelled = true;
        };
    }, [
        isSignedIn,
        account?.username,
        account?.avatar,
        account?.settings?.vrm,
        account?.settings?.default_vrm_scale,
        user?.id,
        gate?.type,
    ]);
    return visitor;
}
