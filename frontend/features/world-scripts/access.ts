/**
 * Whether to ask the server what the signed-in account may do with a
 * space's scripts, and the asking, once per space per page.
 *
 * Nearly every visitor is neither the owner nor an editor of the space
 * they are in, and the page already has the space (its owner and editors
 * are on it): for them the answer is known and nothing is asked. The
 * server decides for the others, and decides again on every request
 * whatever the page thinks (pages/api/_v2/worldScripts).
 */

/** What the server says the account may do (worldScripts.access). */
export interface ScriptAccess {
    canEdit: boolean;
    canAsk: boolean;
    earlyAccess: boolean;
    askReason: string;
}

export interface AccessSpace {
    id: string;
    owner?: unknown;
    editors?: unknown;
}

/**
 * The address says to ask anyway: `?scripts=1`. For a site admin, who may
 * edit any space's scripts without being one of its editors and whom the
 * page cannot tell from any other visitor. Anyone can add it; all it buys
 * is the question, and the server's answer for anyone else is no.
 */
export const ASK_PARAMETER = "scripts";

export function asksInAddress(search: string) {
    try {
        const value = new URLSearchParams(search).get(ASK_PARAMETER);
        return value != null && value !== "0" && value !== "false";
    } catch {
        return false;
    }
}

/** The space's owner or one of its editors, as the server would find. */
export function ownsOrEdits(space: AccessSpace, userId: string) {
    const id = userId.toLowerCase();
    const editors = [
        space.owner,
        ...(Array.isArray(space.editors) ? space.editors : []),
    ];
    return editors.some(
        (editor) => typeof editor === "string" && editor.toLowerCase() === id
    );
}

/** Whether there is anything to ask the server for this visitor here. */
export function shouldAskAccess(
    space: AccessSpace | null | undefined,
    userId: string | null | undefined,
    search = ""
) {
    if (!space?.id || !userId) return false;
    return ownsOrEdits(space, userId) || asksInAddress(search);
}

const asked = new Map<string, Promise<ScriptAccess | null>>();

/**
 * The server's answer for this account and space, asked once for as long
 * as the page lives: coming back to a space does not ask again. Null when
 * it could not be asked (and so may be, next time).
 */
export function askAccess(
    spaceId: string,
    userId: string,
    ask: (input: { experienceId: string }) => Promise<any>
): Promise<ScriptAccess | null> {
    const key = `${userId.toLowerCase()} ${spaceId}`;
    let answer = asked.get(key);
    if (!answer) {
        answer = ask({ experienceId: spaceId }).then(
            (access) => ({
                canEdit: !!access?.canEdit,
                canAsk: !!access?.allowed,
                earlyAccess: !!access?.earlyAccess,
                askReason: access?.reason || "",
            }),
            (): null => {
                asked.delete(key);
                return null;
            }
        );
        asked.set(key, answer);
    }
    return answer;
}

/** For tests: nothing has been asked yet. */
export function forgetAccess() {
    asked.clear();
}
