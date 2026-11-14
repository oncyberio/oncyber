/** A visitor as the space's player list reports them. */
export type SpacePlayer = {
    sessionId?: string;
    userId?: string;
    userData?: {
        avatar?: string;
        username?: string;
        walletId?: string;
        isAdmin?: boolean;
    };
};

export type SpacePerson = {
    id: string;
    name: string;
    avatar?: string;
    isLocal?: boolean;
    role?: "admin";
};

/**
 * The space's moderators and visitors as the lobby's People panel lists
 * them: you first, then moderators, then everyone else by name.
 */
export function spacePeople(
    admins: readonly SpacePlayer[],
    users: readonly SpacePlayer[],
    selfSessionId?: string
): SpacePerson[] {
    const seen = new Set<string>();
    const people: SpacePerson[] = [];
    for (const player of [...(admins || []), ...(users || [])]) {
        const id = player?.sessionId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const data = player.userData || {};
        people.push({
            id,
            name: data.username || data.walletId || "Visitor",
            avatar: data.avatar || undefined,
            isLocal: id === selfSessionId || undefined,
            role: data.isAdmin ? "admin" : undefined,
        });
    }
    const rank = (person: SpacePerson) =>
        person.isLocal ? 0 : person.role ? 1 : 2;
    return people.sort(
        (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)
    );
}
