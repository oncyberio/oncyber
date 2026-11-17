/** Where the studio sends someone who needs to pick a template. */
export const BROWSE_TEMPLATES_HREF = "/studio/new-gallery";

/**
 * Someone who opens the studio with no world of their own gets a
 * placeholder (`mock`) world in the empty void. Unless they chose that
 * ("Blank canvas" links here with `templateId=@@empty`), send them to
 * browse templates instead.
 */
export function shouldBrowseTemplates(
    exhibit: { mock?: boolean; info?: { room?: string } } | null | undefined,
    templateId: unknown
): boolean {
    return !!exhibit?.mock && exhibit.info?.room === "@@empty" && !templateId;
}
