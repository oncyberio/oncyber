/** Where the studio sends someone who needs to pick a template. */
export const BROWSE_TEMPLATES_HREF = "/studio/new-gallery";

/**
 * Someone who opens the studio with no world of their own should pick a
 * template first, before the studio (and its empty void) renders. A
 * `templateId` means they already chose one, "Blank canvas" included.
 */
export function needsTemplateFirst(opts: {
    isAnonymous: boolean;
    hasLocalWorld: boolean;
    exhibit: unknown;
    templateId: unknown;
}): boolean {
    if (opts.templateId) return false;
    if (opts.isAnonymous) return !opts.hasLocalWorld;
    return opts.exhibit == null;
}
