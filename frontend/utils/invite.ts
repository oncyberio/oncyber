import { UserExhibit } from "@uitypes/user";
import { amplitude_logAnalyticsEvent } from "./analytics";

import { inviteAccess } from "./saveToDb";

export const isInvite = (router) => {
    const inviteId = window.localStorage.getItem("inviteId");

    return router.query.inviteId || inviteId;
};

interface InviteAccess {
    success: boolean;
    message: string;
    exhibit?: any;
}

export async function handleInviteAccess(
    inviteId,
    walletId
): Promise<InviteAccess> {
    amplitude_logAnalyticsEvent("open_collab_link", {
        inviteId: inviteId,
        invitedUser: walletId,
    });

    const invite = await inviteAccess(inviteId);

    if (invite.success) {
        const { exhibit, message } = invite;

        amplitude_logAnalyticsEvent("accessed_invite_link", {
            exhibitId: exhibit.id,
            invitedUser: walletId,
            inviteId: inviteId,
            ownerId: exhibit.owner, // The one who invited the user
            exhibitOwnerId: exhibit?.owner,
            exhibitName: exhibit?.info?.headline,
            collabs: exhibit?.editors?.length > 1,
            number_of_artworks: Object.keys(exhibit?.artworks || {}).length,
        });

        return {
            success: true,
            message: message,
            exhibit,
        };
    } else {
        const { message } = invite;

        amplitude_logAnalyticsEvent("failed_accessing_invite_link", {
            inviteId: inviteId,
            message: message,
        });

        return {
            success: false,
            message,
        };
    }
}

export type UserRole = "owner" | "admin-curator" | "co-curator" | "delegator";

const roleLevels = {
    owner: 100,
    "admin-curator": 50,
    "co-curator": 10,
    delegator: 10,
} as const;

const roles = Object.keys(roleLevels) as UserRole[];

export function canChangeRole(source: UserRole, target: UserRole) {
    //
    const srcLevel = roleLevels[source];

    const targetLevel = roleLevels[target];

    if (srcLevel == null || targetLevel == null) {
        //
        throw new Error("Unkown role");
    }

    return srcLevel > targetLevel;
}

export function getUserRole(userExhibit: UserExhibit): UserRole {
    //

    if (roles.includes(userExhibit.privilege)) return userExhibit.privilege;

    if (userExhibit.isAdminCurator) return "admin-curator";

    if (userExhibit.isCurator || userExhibit.invited) return "co-curator";

    if (!userExhibit.invited) return "owner";

    return null;
}
