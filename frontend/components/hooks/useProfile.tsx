import { User } from "@uitypes/user";
import { useEffect, useState } from "react";
import { getUserByWalletId } from "../../utils/saveToDb";

export function mergeUserData(user: Partial<User>, newUser: Partial<User>) {
    //
    let result = { ...newUser };
    result.avatar ??= user.avatar;
    result.username ??= user.username;

    return result;
}

export function useProfile(user: {
    id: string;
    avatar?: string;
    username?: string;
}) {
    //
    const [profile, setProfile] = useState<Partial<User>>(user);

    useEffect(() => {
        (async () => {
            if (user?.id) {
                // we search getUserByWalletId when theres an @
                const d = await getUserByWalletId("@" + user.id);

                if (d.success) {
                    const newUser = mergeUserData(user, d.user);
                    setProfile(newUser);
                }
            }
        })();
    }, [user?.id]);

    return profile;
}
