import React, { useContext, useMemo, useState } from "react";
import { UPDATE_USER_DATA, UserContext } from "@components/context/UserContext";
import AvatarCarousel from "@features/lobby/AvatarCarousel";
import useOwnedLobbyAvatars, {
    ownedFirst,
} from "@features/lobby/useOwnedLobbyAvatars";
import { flashWallets } from "@features/lobby/useFlashNfts";
import VRMS from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import {
    readTravelAvatar,
    rememberTravelAvatar,
    type TravelAvatar,
} from "@utils/travelAvatar";
import { settingsWithAvatar } from "./pageAvatar";

/**
 * The page's avatar picker for whatever it frames (./pageAvatar.ts): the
 * lobby's picker, with the visitor's own avatars read by the page, which
 * holds the account. A choice is saved to the account (for a signed-in
 * visitor), kept for the rest of the visit, and handed to `onChosen`,
 * which tells the frame.
 */
export default function PageAvatarPicker({
    wearing,
    onChosen,
    onClose,
}: {
    /** The avatar the frame says it is wearing now, if it said. */
    wearing?: string;
    onChosen(avatar: TravelAvatar): void;
    onClose(): void;
}) {
    const account = useContext(UserContext);
    const { authenticated, isAnonymous, user, userData, token } = account;
    const signedIn = !!authenticated && !isAnonymous;
    const owned = useOwnedLobbyAvatars(
        signedIn ? user?.id || userData?.walletId || "" : "",
        flashWallets(account),
        true
    );
    const choices = useMemo(
        () =>
            ownedFirst(
                owned.items,
                Object.values(VRMS).map((item) => ({
                    id: item.id,
                    name: item.name,
                    url: item.url,
                    img: item.image,
                }))
            ),
        [owned.items]
    );
    // What the visitor is wearing: what the frame says, else this visit's
    // choice, else the saved one.
    const [chosen, setChosen] = useState(
        () =>
            wearing || readTravelAvatar(userData)?.id || userData?.settings?.vrm
    );
    return (
        <AvatarCarousel
            items={choices}
            selectedId={chosen}
            loading={false}
            ownedLoading={owned.loading}
            ownedHint={
                signedIn
                    ? undefined
                    : "Sign in to wear avatars you upload or hold in your wallet."
            }
            error={owned.error}
            onSelect={(item) => {
                if (item.id === chosen) return;
                const avatar = { id: item.id, name: item.name, url: item.url };
                setChosen(item.id);
                rememberTravelAvatar(userData, avatar);
                const settings = settingsWithAvatar(userData?.settings, avatar);
                if (settings) {
                    account.dispatch?.({
                        type: UPDATE_USER_DATA,
                        payload: { settings },
                    });
                    if (signedIn && user?.id && token)
                        // Loaded when needed: the account helpers are large.
                        void import("@utils/saveToDb")
                            .then(({ updateUser }) =>
                                updateUser(token, { settings }, user.id)
                            )
                            .catch(() => {
                                // Worn for this visit; only the saved one is stale.
                            });
                }
                onChosen(avatar);
            }}
            onClose={onClose}
        />
    );
}
