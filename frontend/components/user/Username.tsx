import { useProfile } from "@components/hooks/useProfile";
import { formatWalletAddress } from "@utils/format";
import { useMemo } from "react";

export function Username({ id, style = {}, className = "" }) {
    //
    const profile = useProfile({ id });

    return (
        <div className={className} style={style}>
            {profile.username
                ? `@${profile.username}`
                : formatWalletAddress(profile.id)}
        </div>
    );
}
