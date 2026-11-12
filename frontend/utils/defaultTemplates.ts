// Cyber Warehouse, used by /brand, is an approved free starter.
// Older catalog records do not yet include its free tag.
export function withDefaultTemplateTags<
    T extends { slug: string; tag: string[] }
>(room: T): T {
    if (room.slug !== "cyberwarehouse" || room.tag?.includes("free"))
        return room;
    return { ...room, tag: [...(room.tag || []), "free"] };
}
