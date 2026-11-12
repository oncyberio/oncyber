import { Account as EventAccount } from "@dapp/types/AssetEvent";
import { useProfile } from "@hooks/useProfile";

function formatAccountId(id: string) {
    if (id.length < 12) return id;

    const end = id.length;

    return `${id.slice(0, 6)}...`;
}

export interface AccountProps {
    account: EventAccount;
}

export function Account({ account }: AccountProps) {
    const profile = useProfile({
        id: account?.address?.toLowerCase(),
    });

    return (
        <span className="account">
            {profile?.username ||
                account?.username ||
                formatAccountId(account?.address || "")}
        </span>
    );
}
