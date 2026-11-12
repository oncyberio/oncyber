import { Experience } from "@uitypes/experience";
import { ExhibitRole } from "@uitypes/user";

export function getSpaceSlug(experience: Experience) {
    return experience.info.customLink || `s@${experience.id}`;
}

export function isEditor(experience: Experience, userId: string) {
    if (userId == null) return false;
    return (experience.editors || []).some(
        (it) => it.toLowerCase() === userId.toLowerCase()
    );
}

const exhibitRoleRanks: Record<ExhibitRole, number> = {
    //
    owner: 1000,
    "admin-curator": 500,
    "co-curator": 100,
    delegator: 50,
};

export function getRoleRank(role: ExhibitRole) {
    //
    return exhibitRoleRanks[role] ?? 0;
}
