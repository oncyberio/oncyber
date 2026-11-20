import React, { useContext, useMemo } from "react";
import { UserContext } from "@components/context/UserContext";
import { DEFAULT_VRMS, useVrm } from "@components/context/VrmContext";
import AvatarCarousel from "@features/lobby/AvatarCarousel";
import { spaceAvatarChoices } from "./spaceAvatarChoices";

/** The lobby's avatar picker, choosing through the space's avatar state. */
export default function SpaceAvatarPicker({ onClose }: { onClose(): void }) {
    const {
        uploadedVrms,
        ownedVrms,
        activeVrm,
        loading,
        loadingOwned,
        onSelectVrm,
    } = useVrm();
    const { authenticated, isAnonymous } = useContext(UserContext);
    const items = useMemo(
        () =>
            spaceAvatarChoices(
                uploadedVrms || [],
                ownedVrms || [],
                DEFAULT_VRMS
            ),
        [uploadedVrms, ownedVrms]
    );
    return (
        <AvatarCarousel
            items={items}
            selectedId={activeVrm?.id}
            loading={loading}
            ownedLoading={loadingOwned}
            ownedHint={
                authenticated && !isAnonymous
                    ? undefined
                    : "Sign in to wear avatars you upload or hold in your wallet."
            }
            onSelect={(item) => {
                if (item.id === activeVrm?.id) return;
                const picked = items.find((entry) => entry.id === item.id);
                onSelectVrm(item.id, picked?.source || "DEFAULT");
            }}
            onClose={onClose}
        />
    );
}
