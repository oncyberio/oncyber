export const TEMPLATE_CATEGORIES = [
    { value: "all", label: "All templates" },
    { value: "free", label: "Free" },
    { value: "factory", label: "Oncyber Labs" },
    { value: "curated", label: "Curated" },
    { value: "andfriends", label: "& Friends" },
    { value: "community", label: "Community" },
    { value: "ethereum", label: "Ethereum" },
    { value: "polygon", label: "Polygon" },
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]["value"];

export function parseTemplateCategory(value: unknown): TemplateCategory {
    return (
        TEMPLATE_CATEGORIES.find((category) => category.value === value)
            ?.value || "all"
    );
}

function matchesTemplateCategory(
    room: { tag?: string[]; blockchain?: string },
    category: TemplateCategory
) {
    if (category === "all") return true;
    if (category === "ethereum" || category === "polygon")
        return room.blockchain === category;
    if (category === "community")
        return room.tag?.some((tag) =>
            [
                "oncyber-ethereum-community",
                "oncyber-polygon-community",
            ].includes(tag)
        );
    return room.tag?.includes(category);
}

const normalize = (value: string) =>
    value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
export function matchesTemplate(query: string, ...fields: unknown[]) {
    const text = normalize(
        fields.filter((value) => typeof value === "string").join(" ")
    );
    return normalize(query)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => text.includes(word));
}
export function templateSearchPatch(query: string) {
    return {
        templateSearch: query.trim(),
    };
}
export function selectTemplateRooms<
    T extends {
        slug: string;
        name?: string;
        description?: string;
        tag?: string[];
        author?: any;
        contractName?: string;
        blockchain?: string;
    }
>(
    groups: { owned: T[]; uploaded: T[]; purchase: T[] },
    query: string,
    category: TemplateCategory = "all"
): T[] {
    const available = [...groups.owned, ...groups.uploaded, ...groups.purchase];
    return available.filter(
        (room) =>
            matchesTemplateCategory(room, category) &&
            matchesTemplate(
                query,
                room.name,
                room.slug,
                room.description,
                room.author?.name,
                room.author?.displayName,
                room.contractName,
                room.tag?.join(" ")
            )
    );
}
