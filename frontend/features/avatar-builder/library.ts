import { decodeLook } from "./look";
export type Build = { id: string; name: string; code: string };
export const libraryKey = "oncyber.avatar-studio.library.v1";
export const draftKey = "oncyber.avatar-studio.draft.v1";
export function readBuilds(raw: string | null): Build[] {
    try {
        const parsed: unknown = JSON.parse(raw ?? "[]");
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(
                (b): b is Build =>
                    b &&
                    typeof b.id === "string" &&
                    b.id.length <= 64 &&
                    typeof b.name === "string" &&
                    b.name.trim().length > 0 &&
                    b.name.length <= 40 &&
                    !!decodeLook(b.code)
            )
            .slice(0, 24);
    } catch {
        return [];
    }
}
